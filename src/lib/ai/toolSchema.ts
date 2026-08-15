export interface AiAction {
  type: string
  [key: string]: unknown
}

export interface AiChatResponse {
  message: string
  actions?: AiAction[]
}

export interface AiAddDeviceAction extends AiAction {
  type: 'addDevice'
  wallId: string
  deviceType: string
  t: number
  offset?: number
  side?: number
  name?: string
}

export interface AiAddFreeDeviceAction extends AiAction {
  type: 'addFreeDevice'
  deviceType: string
  x: number
  y: number
  name?: string
}

export interface AiAddCableAction extends AiAction {
  type: 'addCable'
  fromDeviceId: string
  toDeviceId: string
  cableType?: string
  crossSection?: number
}

export interface AiSetRoomNameAction extends AiAction {
  type: 'setRoomName'
  roomIndex: number
  name: string
}

export interface AiAutoDesignAction extends AiAction {
  type: 'autoDesign'
}

export type KnownAiAction =
  | AiAddDeviceAction
  | AiAddFreeDeviceAction
  | AiAddCableAction
  | AiSetRoomNameAction
  | AiAutoDesignAction

export function isKnownAction(action: AiAction): action is KnownAiAction {
  return [
    'addDevice',
    'addFreeDevice',
    'addCable',
    'setRoomName',
    'autoDesign',
  ].includes(action.type)
}

export function parseAiResponse(raw: string): AiChatResponse {
  let cleaned = raw.trim()
  // Убираем markdown-блоки ```json ... ```
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
  }

  const parsed = JSON.parse(cleaned) as AiChatResponse
  if (typeof parsed.message !== 'string') {
    throw new Error('Ответ AI не содержит message')
  }
  return {
    message: parsed.message,
    actions: Array.isArray(parsed.actions) ? parsed.actions : [],
  }
}
