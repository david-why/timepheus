import { DateTime } from 'luxon'
import { getVerifiedData } from './signature'
import { authTest, getUserInfo, postMessage } from './slack'

const PORT = Number(process.env.PORT || 3000)

const TIME_REGEX =
  /\{([dt]*?)?(?:(?:(\d{4})\/)?(\d{1,2})\/(\d{1,2})\s*)?(?:(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?\}/g

const { SLACK_APP_ID, SLACK_BOT_OAUTH_TOKEN } = process.env

if (!SLACK_APP_ID) {
  console.error('SLACK_APP_ID not set')
  process.exit(1)
}
if (!SLACK_BOT_OAUTH_TOKEN) {
  console.error('SLACK_BOT_OAUTH_TOKEN not set')
  process.exit(1)
}

console.log('Fetching user ID')
const botUserId = (await authTest()).user_id
console.log(`Bot user ID is ${botUserId}`)

function toNumberOrUndefined(text: string | undefined) {
  if (!text) return undefined
  const num = Number(text)
  if (isNaN(num)) return undefined
  return num
}

interface Message {
  ts: string
  text: string
  channel: string
  thread_ts?: string
  // and other stuff we don't care about
}

function getMessageURL(message: Message) {
  return `https://hackclub.slack.com/archives/${message.channel}/p${message.ts}`
}

async function checkPostedMessage(message: Message) {
  const { text, channel, thread_ts } = message
  if (!TIME_REGEX.test(text)) return
  TIME_REGEX.lastIndex = 0
  const data: string[] = []
  for (const match of message.text.matchAll(TIME_REGEX)) {
    data.push(match[0])
  }
  await postMessage({
    channel,
    blocks: [
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `<${getMessageURL(message)}|triggering msg>`,
          },
        ],
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'convert to my timezone' },
            action_id: 'timepheus_privtime2',
            value: JSON.stringify({
              c: message.channel,
              t: message.thread_ts,
              d: data,
            }),
          },
        ],
      },
    ],
    thread_ts,
  })
}

async function sendLocalMessage(value: string, userId: string) {
  const {
    c: channel,
    t: thread_ts,
    d: data,
  } = JSON.parse(value) as { c: string; t?: string; d: string[] }
  const user = await getUserInfo(userId)
  let text = ''
  for (const item of data) {
    TIME_REGEX.lastIndex = 0
    const arr = item.matchAll(TIME_REGEX).next().value
    console.log(item, arr)
    const [segment, fmt, y, m, d, H, M, S] = arr!
    const dt = DateTime.fromObject(
      {
        year: toNumberOrUndefined(y),
        month: toNumberOrUndefined(m),
        day: toNumberOrUndefined(d),
        hour: toNumberOrUndefined(H),
        minute: toNumberOrUndefined(M),
        second: toNumberOrUndefined(S),
      },
      { zone: user.tz },
    )
    const dateCount = (fmt || 'dd').split('d').length - 1
    const timeCount = (fmt || 'tt').split('t').length - 1
    let segmentText = ''
    if (dateCount > 4 && timeCount > 4) {
      segmentText =
        '_timepheus sighed._ "so many `d` and `t` specified! do you actually want me dead???"'
    } else if (dateCount > 4) {
      segmentText =
        '_timepheus sighed._ "so many `d` specified! you really love the date don\'t you???"'
    } else if (timeCount > 4) {
      segmentText =
        '_timepheus sighed._ "so many `t` specified! what do you want from me???"'
    } else {
      segmentText = dt.toLocaleString({
        dateStyle: ([undefined, 'short', 'medium', 'long', 'full'] as const)[
          dateCount
        ],
        timeStyle: ([undefined, 'short', 'medium', 'long', 'full'] as const)[
          timeCount
        ],
      })
    }
    text += `\`${segment}\`: ${segmentText}\n`
  }
  text = text.trim()
  await postMessage({
    channel,
    thread_ts,
    ephemeral: true,
    user: userId,
    markdown_text: text,
  })
}

async function handleEvent(event: SlackEvent): Promise<void> {
  if (event.type === 'app_mention') {
    await checkPostedMessage(event)
  } else if (event.type === 'message') {
    if (
      !event.text.includes(`<@${botUserId}>`) &&
      event.app_id !== SLACK_APP_ID
    ) {
      await checkPostedMessage(event)
    }
  }
}

async function handleInteractivity(interaction: SlackInteraction) {
  if (interaction.type == 'block_actions') {
    const id = interaction.actions[0]?.action_id
    if (id === 'timepheus_privtime2') {
      await sendLocalMessage(interaction.actions[0]!.value, interaction.user.id)
    }
  }
}

Bun.serve({
  routes: {
    '/slack/events-endpoint': async (req) => {
      const verified = await getVerifiedData(req)
      if (!verified.success) return new Response(null, { status: 500 })
      const { data: jsonData } = verified
      console.log(jsonData)
      const data = JSON.parse(jsonData) as SlackRequest

      if (data.type === 'url_verification') {
        return new Response(data.challenge)
      } else if (data.type === 'event_callback') {
        handleEvent(data.event) // intentionally not awaited
        return new Response()
      }
      return new Response()
    },
    '/slack/interactivity-endpoint': async (req) => {
      const verified = await getVerifiedData(req)
      if (!verified.success) return new Response(null, { status: 500 })
      const { data: encodedData } = verified

      const params = new URLSearchParams(encodedData)
      const payload = params.get('payload')!
      const data = JSON.parse(payload) as SlackInteraction
      console.log(data)

      handleInteractivity(data)
      return new Response()
    },
  },
  port: PORT,
})

console.log('Server started on port', PORT)
