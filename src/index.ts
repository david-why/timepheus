import {
  getUserHint,
  getUserOptout,
  optinUser,
  optoutUser,
  setUserHint,
} from './database'
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

function getTzOffset(zone: string, refDate: Date = new Date()) {
  const ref = new Date(refDate)
  ref.setMilliseconds(0)
  const zonedNow = new Date(
    ref.toLocaleString('en-US', {
      timeZone: zone,
    }),
  )
  const utcNow = new Date(
    ref.toLocaleString('en-US', {
      timeZone: 'UTC',
    }),
  )
  return (zonedNow.getTime() - utcNow.getTime()) / 1000 / 60
}

function parseMessageData({
  text,
  tz,
}: {
  text: string
  tz: string
}): PrivTimeValue['d'] {
  const results = chrono.parse(text, { timezone: getTzOffset(tz) })
  const data: PrivTimeValue['d'] = []
  for (const result of results) {
    if (
      !result.start.isCertain('hour') &&
      !result.start.isCertain('minute') &&
      !result.start.isCertain('second')
    )
      continue
    const result2 =
      chrono.parse(result.text, {
        timezone: getTzOffset(tz, result.start.date()),
      })[0] ?? result
    data.push([
      result2.text,
      Math.floor(result2.start.date().getTime() / 1000),
      result2.end ? Math.floor(result2.end.date().getTime() / 1000) : null,
    ])
  }
  return data
}

async function checkPostedMessage(message: Message) {
  const user = await getUserInfo(message.user)
  const data = parseMessageData({ text: message.text, tz: user.tz })
  if (!data.length) return
  await Promise.all([sendMessageOrReact(message, data), checkUserHint(message)])
}

async function checkUserHint(message: Message) {
  const hasHinted = await getUserHint(message.user)
  if (!hasHinted) {
    await Promise.all([setUserHint(message.user), sendUserHint(message)])
  }
}

async function sendUserHint(message: Message) {
  await postMessage({
    channel: message.channel,
    thread_ts: message.thread_ts,
    ephemeral: true,
    user: message.user,
    markdown_text: `:timepheus_clock: hi there, i'm timepheus! i help you convert dates & times in your messages to everyone's local time. if you don't like me _sob sob_ you can turn me off :pleading_face: by using the "/timepheus-optout" command, and i'll react instead of reply _(you will only see this message once)_`,
  })
}

async function sendMessageOrReact(
  message: Message,
  data: [string, number, number | null][],
) {
  if (await getUserOptout(message.user)) {
    return await addReaction({
      channel: message.channel,
      name: REACTION_EMOJI,
      timestamp: message.ts,
    })
  } else {
    return await sendLocalMessage({ ...message, data })
  }
}

async function sendLocalMessage(
  {
    channel,
    thread_ts,
    ts,
    data,
  }: {
    user: string
    channel: string
    thread_ts?: string
    ts: string
    data: [string, number, number | null][]
  },
  { userId, ephemeral = false }: { userId?: string; ephemeral?: boolean } = {},
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
  const postThread = ephemeral ? thread_ts : (thread_ts ?? ts)
  await postMessage({
    channel,
    thread_ts: postThread,
    ephemeral,
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
  const user = await getUserInfo(event.item_user)
  const data = parseMessageData({
    text: message.text,
    tz: user.tz,
  })
  await sendLocalMessage(
    {
      user: event.item_user,
      channel: event.item.channel,
      ts: event.item.ts,
      thread_ts: event.item.thread_ts,
      data,
    },
    { userId: event.user, ephemeral: true },
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
    if (event.user !== botUserId) {
      await checkMessageReaction(event)
    }
  }
}

async function handleOptoutCommand(data: SlackSlashCommandRequest) {
  optoutUser(data.user_id)
  return new Response(
    `you have opted out from my help :( now, i will only add the :${REACTION_EMOJI}: reaction and will not reply publicly. to opt in again, use "/timepheus-optin". hope to see you again soon!`,
  )
}

async function handleOptinCommand(data: SlackSlashCommandRequest) {
  optinUser(data.user_id)
  return new Response(
    'hey there! nice to see you again!! _(you have opted back in to timepheus messages)_',
  )
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
    '/slack/command/optout': async (req) => {
      const verified = await getVerifiedData(req)
      if (!verified.success) return new Response(null, { status: 500 })
      const { data: encodedData } = verified
      const data = new URLSearchParams(
        encodedData,
      ).toJSON() as unknown as SlackSlashCommandRequest

      return await handleOptoutCommand(data)
    },
    '/slack/command/optin': async (req) => {
      const verified = await getVerifiedData(req)
      if (!verified.success) return new Response(null, { status: 500 })
      const { data: encodedData } = verified
      const data = new URLSearchParams(
        encodedData,
      ).toJSON() as unknown as SlackSlashCommandRequest

      return await handleOptinCommand(data)
    },
  },
  port: PORT,
})

console.log('Server started on port', PORT)
