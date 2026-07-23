/** Kontrak adapter kanal notifikasi. */
export type NotificationDeliveryInput = {
  orgId: string
  recipient: string
  subject: string | null
  body: string
  payload: Record<string, unknown>
  idempotencyKey: string
}

export type NotificationDeliveryResult = {
  providerCode: string
  providerMessageId: string | null
  state: 'SENT' | 'DELIVERED'
  response: Record<string, unknown>
}

export interface NotificationProvider {
  readonly code: string
  send(input: NotificationDeliveryInput): Promise<NotificationDeliveryResult>
}
