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
    locale: string
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
  const res = await fetch(
    `https://slack.com/api/users.info?include_locale=true&user=${userId}`,
    {
      headers: {
        authorization: `Bearer ${SLACK_BOT_OAUTH_TOKEN}`,
      },
    },
  )
  const data = (await res.json()) as GetUserInfoResponse | ErrorResponse
  if (!data.ok) {
    throw new Error(`Slack API returned error: ${data.error}`)
  }
  return data.user
}

interface PostMessageParams {
  channel: string
  markdown_text?: string
  thread_ts?: string
  blocks?: unknown[]
  ephemeral?: boolean
  user?: string
}

interface PostMessageResponse {
  ok: true
}

export async function postMessage(parameters: PostMessageParams) {
  const stringifiedParams = {
    ...parameters,
    blocks: parameters.blocks ? JSON.stringify(parameters.blocks) : undefined,
    ephemeral: undefined as string | undefined,
  }
  for (const key in stringifiedParams) {
    if (
      stringifiedParams[key as keyof typeof stringifiedParams] === undefined
    ) {
      delete stringifiedParams[key as keyof typeof stringifiedParams]
    }
  }
  const body = new URLSearchParams(
    stringifiedParams as Record<string, string>,
  ).toString()
  const res = await fetch(
    parameters.ephemeral
      ? `https://slack.com/api/chat.postEphemeral`
      : `https://slack.com/api/chat.postMessage`,
    {
      method: 'POST',
      body,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${SLACK_BOT_OAUTH_TOKEN}`,
      },
    },
  )
  const data = (await res.json()) as PostMessageResponse | ErrorResponse
  if (!data.ok) {
    console.error(data)
    throw new Error(`Slack chat.postMessage API returned error: ${data.error}`)
  }
}

interface AuthTestResponse {
  ok: true
  url: string
  team: string
  user: string
  team_id: string
  user_id: string
}

export async function authTest() {
  const res = await fetch(`https://slack.com/api/auth.test`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SLACK_BOT_OAUTH_TOKEN}`,
    },
  })
  const data = (await res.json()) as AuthTestResponse | ErrorResponse
  if (!data.ok) {
    console.error(data)
    throw new Error(`Slack auth.test API returned error: ${data.error}`)
  }
  return data
}
