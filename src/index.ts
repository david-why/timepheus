import { DateTime } from 'luxon'
import { getVerifiedData } from './signature'
import { getUserInfo } from './slack'

const PORT = Number(process.env.PORT || 3000)

const TIME_REGEX =
  /\{(.*?!)?(?:(?:(\d{4})\/)?(\d{1,2})\/(\d{1,2})\s*)?(?:(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?\}/g

function toNumberOrUndefined(text: string | undefined) {
  if (!text) return undefined
  const num = Number(text)
  if (isNaN(num)) return undefined
  return num
}

async function handleEvent(event: SlackEvent, data: SlackEventCallbackRequest): Promise<void> {
  if (event.type === 'app_mention') {
    const user = await getUserInfo(event.user)
    let text = ''
    for (const match of event.text.matchAll(TIME_REGEX)) {
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
      }
      text += `${segment}: ${segmentText}\n`
    }
    text = text.trim()
    console.log(text)
    console.log(JSON.stringify(data, null, 2))
  }
}

Bun.serve({
  routes: {
    '/slack/events-endpoint': async (req) => {
      const verified = await getVerifiedData(req)
      if (!verified.success) return new Response(null, { status: 500 })
      const { data } = verified
      console.log(JSON.stringify(data))

      if (data.type === 'url_verification') {
        return new Response(data.challenge)
      } else if (data.type === 'event_callback') {
        handleEvent(data.event, data) // intentionally not awaited
        return new Response()
      }
      return new Response()
    },
  },
  port: PORT,
})

console.log('Server started on port', PORT)
