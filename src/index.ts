import { getVerifiedData } from './signature'
import {
  addReaction,
  authTest,
  getMessage,
  getUserInfo,
  postMessage,
} from './slack'
import * as chrono from 'chrono-node'

const REACTION_EMOJI = 'timepheus_clk'

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

function parseMessageData({
  text,
  tz,
}: {
  text: string
  tz: string
}): PrivTimeValue['d'] {
  const results = chrono.parse(text, { timezone: tz })
  const data: PrivTimeValue['d'] = []
  for (const result of results) {
    if (
      !result.start.isCertain('hour') &&
      !result.start.isCertain('minute') &&
      !result.start.isCertain('second')
    )
      continue
    data.push([
      result.text,
      Math.floor(result.start.date().getTime() / 1000),
      result.end ? Math.floor(result.end.date().getTime() / 1000) : null,
    ])
  }
  return data
}

async function checkPostedMessage(message: Message) {
  const { text, channel, user: userId } = message
  const user = await getUserInfo(userId)
  const data = parseMessageData({ text, tz: user.tz })
  if (!data.length) return
  await addReaction({
    channel,
    name: REACTION_EMOJI,
    timestamp: message.ts,
  })
}

async function sendLocalMessage(
  {
    channel,
    thread_ts,
    data,
  }: {
    channel: string
    thread_ts?: string
    data: [string, number, number | null][]
  },
  userId: string,
) {
  if (!data) return
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
  await postMessage({
    channel,
    thread_ts,
    ephemeral: true,
    user: userId,
    blocks: [block],
  })
}

async function checkMessageReaction(event: SlackReactionAddedEvent) {
  if (event.reaction !== REACTION_EMOJI) return
  if (event.item.type !== 'message') return
  const message = await getMessage({
    channel: event.item.channel,
    ts: event.item.ts,
  })
  if (!message) return
  const user = await getUserInfo(event.user)
  await sendLocalMessage(
    {
      channel: event.item.channel,
      thread_ts: event.item.thread_ts,
      data: parseMessageData({
        text: message.text,
        tz: user.tz,
      }),
    },
    event.user,
  )
}

async function handleEvent(event: SlackEvent): Promise<void> {
  if (event.type === 'app_mention') {
    await checkPostedMessage(event)
  } else if (event.type === 'message') {
    if (!event.app_id && !event.text.includes(`<@${botUserId}>`)) {
      await checkPostedMessage(event)
    }
  } else if (event.type === 'reaction_added') {
    await checkMessageReaction(event)
  }
}

async function handleInteractivity(interaction: SlackInteraction) {
  if (interaction.type == 'block_actions') {
    const id = interaction.actions[0]?.action_id
    if (id === 'timepheus_privtime3') {
      const {
        c: channel,
        t: thread_ts,
        d: data,
      } = JSON.parse(interaction.actions[0]!.value) as PrivTimeValue
      await sendLocalMessage({ channel, thread_ts, data }, interaction.user.id)
    } else {
      await postMessage({
        channel: interaction.channel.id,
        thread_ts: interaction.message.thread_ts,
        ephemeral: true,
        user: interaction.user.id,
        markdown_text: `_timepheus looks at you with a pleading face._ i don't understand that, sowwy :pleading_face:`,
      })
    }
  }
}

Bun.serve({
  routes: {
    '/slack/events-endpoint': async (req) => {
      const verified = await getVerifiedData(req)
      if (!verified.success) return new Response(null, { status: 500 })
      const { data: jsonData } = verified
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

      handleInteractivity(data)
      return new Response()
    },
  },
  port: PORT,
})

console.log('Server started on port', PORT)
