interface SlackAppMentionEvent {
  type: "app_mention"
  user: string
  thread_ts?: string
  ts: string
  client_msg_id: string
  text: string
  team: string
  blocks: unknown[]
  channel: string
  event_ts: string
}

type SlackEvent = SlackAppMentionEvent

// request bodies sent by slack to our endpoint

interface SlackBaseRequest {
  token: string
}

interface SlackUrlVerificationRequest extends SlackBaseRequest {
  type: "url_verification"
  challenge: string
}

interface SlackEventCallbackRequest extends SlackBaseRequest {
  type: "event_callback"
  team_id: string
  api_app_id: string
  event: SlackEvent
  event_id: string
  event_time: number
}

type SlackRequest = SlackUrlVerificationRequest | SlackEventCallbackRequest
