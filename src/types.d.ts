// slack events api events

interface SlackAppMentionEvent {
  type: 'app_mention'
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

interface SlackMessageEvent {
  type: 'message'
  user: string
  ts: string
  text: string
  thread_ts: string
  channel: string
  app_id?: string
  // ...
}

type SlackEvent = SlackAppMentionEvent | SlackMessageEvent

// request bodies sent by slack to our endpoint

interface SlackBaseRequest {
  token: string
}

interface SlackUrlVerificationRequest extends SlackBaseRequest {
  type: 'url_verification'
  challenge: string
}

interface SlackEventCallbackRequest extends SlackBaseRequest {
  type: 'event_callback'
  team_id: string
  api_app_id: string
  event: SlackEvent
  event_id: string
  event_time: number
}

type SlackRequest = SlackUrlVerificationRequest | SlackEventCallbackRequest

// slack interactivity events

interface SlackBlockActionsInteraction {
  type: 'block_actions'
  user: {
    id: string
    // ...
  }
  channel: {
    id: string
    // ...
  },
  message: {
    user: string
    ts: string
    thread_ts?: string
    text: string
    // ...
  }
  response_url: stirng
  actions: {
    action_id: string
    value: string
    // ...
  }[]
  // ...
}

type SlackInteraction = SlackBlockActionsInteraction
