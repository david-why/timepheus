import { DateTime } from "luxon"
import { getVerifiedData } from "./signature"
import { getUserInfo } from "./slack"

const PORT = Number(process.env.PORT || 3000)

const TIME_REGEX =
  /\{(?:.*?!)?(?:(?:(\d{4})\/)?(\d{1,2})\/(\d{1,2})\s*)?(?:(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?\}/g

function toNumberOrUndefined(text: string | undefined) {
  if (!text) return undefined
  const num = Number(text)
  if (isNaN(num)) return undefined
  return num
}

async function handleEvent(event: SlackEvent): Promise<void> {
  if (event.type === "app_mention") {
    const text = event.text
    const user = await getUserInfo(event.user)
    for (const match of text.matchAll(TIME_REGEX)) {
      const [_, fmt, y, m, d, H, M, S] = match
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
    }
  }
}

Bun.serve({
  routes: {
    "/slack/events-endpoint": async (req) => {
      const verified = await getVerifiedData(req)
      if (!verified.success) return new Response(null, { status: 500 })
      const { data } = verified
      console.log(JSON.stringify(data))

      if (data.type === "url_verification") {
        return new Response(data.challenge)
      } else if (data.type === "event_callback") {
        handleEvent(data.event) // intentionally not awaited
        return new Response()
      }
      return new Response()
    },
  },
  port: PORT,
})

console.log("Server started on port", PORT)
