const { SLACK_BOT_OAUTH_TOKEN } = process.env

interface ErrorResponse {
  ok: false
  error: string
}

interface GetUserInfoResponse {
  ok: true
  user: {
    id: string
    team_id: string
    name: string
    deleted: boolean
    color: string
    real_name: string
    tz: string
    tz_label: string
    tz_offset: number
    profile: {
      avatar_hash: string
      display_name: string
      real_name_normalized: string
      display_name_normalized: string
      team: string
      // and some more stuff
    }
    // and even more stuff...
  }
}

export async function getUserInfo(userId: string) {
  const res = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
    headers: {
      authorization: `Bearer ${SLACK_BOT_OAUTH_TOKEN}`,
    },
  })
  const data = (await res.json()) as GetUserInfoResponse | ErrorResponse
  if (!data.ok) {
    throw new Error(`Slack API returned error: ${data.error}`)
  }
  return data.user
}
