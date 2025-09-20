import { getVerifiedData } from './signature'
import { addReaction, authTest, getUserInfo, postMessage } from './slack'
import * as chrono from 'chrono-node'

const PORT = Number(process.env.PORT || 3000)

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

interface Message {
  ts: string
  text: string
  channel: string
  user: string
  thread_ts?: string
  // and other stuff we don't care about
}

interface PrivTimeValue {
  c: string
  t?: string
  d: [string, number, number | null][]
}

async function checkPostedMessage(message: Message) {
  const { text, channel, thread_ts, user: userId } = message
  const user = await getUserInfo(userId)
  const results = chrono.parse(text, { timezone: user.tz })
  if (!results.length) return
  const data: PrivTimeValue['d'] = []
  for (const result of results) {
    if (
      !result.start.isCertain('hour') &&
      !result.start.isCertain('minute') &&
      !result.start.isCertain('second')
    )
      return
    console.log(result.start.date(), result.end?.date())
    data.push([
      result.text,
      Math.floor(result.start.date().getTime() / 1000),
      result.end ? Math.floor(result.end.date().getTime() / 1000) : null,
    ])
  }
  await Promise.all([
    addReaction({
      channel,
      name: 'tw_alarm_clock',
      timestamp: message.ts,
    }),
    postMessage({
      channel,
      blocks: [
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'convert to my timezone' },
              action_id: 'timepheus_privtime3',
              value: JSON.stringify({
                c: channel,
                t: thread_ts,
                d: data,
              } satisfies PrivTimeValue),
            },
          ],
        },
      ],
      thread_ts,
    }),
  ])
}

async function sendLocalMessage(value: string, userId: string) {
  const {
    c: channel,
    t: thread_ts,
    d: data,
  } = JSON.parse(value) as PrivTimeValue
  const block: SlackRichTextBlock = { type: 'rich_text', elements: [] }
  for (const [segment, tsStart, tsEnd] of data) {
    const elements: SlackRichTextElement[] = [
      {
        type: 'text',
        text: segment,
        style: { code: true },
      },
      {
        type: 'text',
        text: ': ',
      },
      {
        type: 'date',
        timestamp: tsStart,
        format: '{date_slash} at {time} ({ago})',
        fallback: '<Failed to display time>',
      },
    ]
    if (typeof tsEnd === 'number') {
      elements.push(
        { type: 'text', text: ' to ' },
        {
          type: 'date',
          timestamp: tsEnd,
          format: '{date_slash} at {time} ({ago})',
          fallback: '<Failed to display time>',
        },
      )
    }
    block.elements.push({ type: 'rich_text_section', elements })
  }
  console.log(block.elements[0]?.elements)
  await postMessage({
    channel,
    thread_ts,
    ephemeral: true,
    user: userId,
    blocks: [block],
  })
}

async function handleEvent(event: SlackEvent): Promise<void> {
  if (event.type === 'app_mention') {
    await checkPostedMessage(event)
  } else if (event.type === 'message') {
    if (!event.app_id && !event.text.includes(`<@${botUserId}>`)) {
      await checkPostedMessage(event)
    }
  }
}

async function handleInteractivity(interaction: SlackInteraction) {
  if (interaction.type == 'block_actions') {
    const id = interaction.actions[0]?.action_id
    if (id === 'timepheus_privtime3') {
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
