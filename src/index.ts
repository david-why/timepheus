import { getVerifiedData } from "./signature"

const PORT = Number(process.env.PORT || 3000)

Bun.serve({
  routes: {
    "/slack/events-endpoint": async (req) => {
      const verified = await getVerifiedData(req)
      if (!verified.success) return new Response(null, { status: 500 })
      const { data } = verified
      console.log(JSON.stringify(data))
      if (data.type === "url_verification") {
        return new Response(data.challenge)
      }
      return new Response()
    },
  },
  port: PORT,
})

console.log("Server started on port", PORT)
