// slack block kit types (partial ofc)

interface SlackRichTextBlock {
  type: 'rich_text'
  elements: SlackRichTextObject[]
  block_id?: string
}

interface SlackRichTextSection {
  type: 'rich_text_section'
  elements: SlackRichTextElement[]
}

type SlackRichTextObject = SlackRichTextSection

interface SlackRichTextTextElement {
  type: 'text'
  text: string
  style?: { bold?: boolean; italic?: boolean; strike?: boolean; code?: boolean }
}

interface SlackRichTextDateElement {
  type: 'date'
  timestamp: number
  format: string
  url?: string
  fallback?: string
}

interface SlackRichTextUserElement {
  type: 'user'
  user_id: string
  style?: {
    bold?: boolean
    italic?: boolean
    strike?: boolean
    highlight?: boolean
    client_highlight?: boolean
    unlink?: boolean
  }
}

type SlackRichTextElement =
  | SlackRichTextTextElement
  | SlackRichTextDateElement
  | SlackRichTextUserElement

interface SlackActionsBlock {
  type: 'actions'
  elements: SlackBlockElement[]
}

interface SlackButtonElement {
  type: 'button'
  text: SlackTextObject & { type: 'plain_text' }
  action_id?: string
  url?: string
  value?: string
  style?: 'primary' | 'danger'
  confirm?: unknown
  accessibility_label?: string
}

type SlackBlockElement = SlackButtonElement

interface SlackMarkdownBlock {
  type: 'markdown'
  text: string
  block_id?: string
}

type SlackBlock = SlackRichTextBlock | SlackActionsBlock | SlackMarkdownBlock

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

interface SlackReactionAddedEvent {
  type: 'reaction_added'
  user: string
  reaction: string
  item:
    | {
        type: 'message'
        channel: string
        ts: string
        thread_ts?: string
      }
    | { type: 'file' }
    | { type: 'file_comment' }
  item_user: string
  event_ts: string
}

type SlackEvent =
  | SlackAppMentionEvent
  | SlackMessageEvent
  | SlackReactionAddedEvent

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
  }
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

// slack slash commands

interface SlackSlashCommandRequest {
  token: string
  team_id: string
  team_domain: string
  channel_id: string
  channel_name: string
  user_id: string
  user_name: string
  command: string
  text: string
  api_app_id: string
  is_enterprise_install: 'true' | 'false'
  response_url: string
  trigger_id: string
}
