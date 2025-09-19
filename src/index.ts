import { DateTime } from 'luxon'
import { getVerifiedData } from './signature'
import { authTest, getUserInfo, postMessage } from './slack'

const PORT = Number(process.env.PORT || 3000)

const TIME_REGEX =
  /\{(.*?!)?(?:(?:(\d{4})\/)?(\d{1,2})\/(\d{1,2})\s*)?(?:(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?\}/g

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

async function handleTimeMessage(
  origMessage: { text: string; channel: string; thread_ts?: string },
  userId: string,
  {
    ephemeral,
    passive = false,
  }: { ephemeral?: string; passive?: boolean } = {},
) {
  if (!TIME_REGEX.test(origMessage.text)) {
    if (!passive) {
      await postMessage({
        channel: origMessage.channel,
        markdown_text: `_timepheus sighed exasperatedly._ **WHY DID YOU PING ME???** i'm so busy and i keep getting harassed by people like you...!!`,
        thread_ts: origMessage.thread_ts,
      })
    }
    return
  }
  const user = await getUserInfo(userId)
  let text = ``
  TIME_REGEX.lastIndex = 0
  const dts: [string, number, number, number][] = []
  for (const match of origMessage.text.matchAll(TIME_REGEX)) {
    const [segment, fmt, y, m, d, H, M, S] = match
    console.log(y, m, d, H, M, S)
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
      dts.push([segment, dateCount, timeCount, dt.toMillis()])
    }
    text += `\`${segment}\`: ${segmentText}\n`
  }
  text = text.trim()
  const blocks: unknown[] = [{ type: 'markdown', text: text }]
  if (!ephemeral) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'convert to my timezone' },
          action_id: 'timepheus_privtime',
          value: JSON.stringify(dts),
        },
      ],
    })
  }
  await postMessage({
    channel: origMessage.channel,
    blocks,
    thread_ts: origMessage.thread_ts,
    ephemeral: !!ephemeral,
    user: ephemeral,
  })
}

async function handleEvent(event: SlackEvent): Promise<void> {
  if (event.type === 'app_mention') {
    await handleTimeMessage(event, event.user)
  } else if (event.type === 'message') {
    if (!event.text.includes(`<@${botUserId}>`) && event.app_id !== SLACK_APP_ID) {
      await handleTimeMessage(event, event.user, { passive: true })
    }
  }
}

async function handleInteractivity(interaction: SlackInteraction) {
  if (interaction.type == 'block_actions') {
    const id = interaction.actions[0]?.action_id
    if (id === 'timepheus_privtime') {
      await handleTimeMessage(
        { ...interaction.message, channel: interaction.channel.id },
        interaction.user.id,
        { ephemeral: interaction.user.id },
      )
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
      const data = JSON.parse(jsonData)

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
