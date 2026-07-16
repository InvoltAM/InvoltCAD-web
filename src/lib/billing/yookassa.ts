const SHOP_ID = process.env.YOOKASSA_SHOP_ID
const SECRET_KEY = process.env.YOOKASSA_SECRET_KEY
const WEBHOOK_TOKEN = process.env.YOOKASSA_WEBHOOK_TOKEN

export interface YooKassaPaymentRequest {
  amount: {
    value: string
    currency: string
  }
  confirmation: {
    type: 'redirect'
    return_url: string
  }
  capture: boolean
  description: string
  metadata?: Record<string, string>
}

export interface YooKassaPaymentResponse {
  id: string
  status: string
  amount: {
    value: string
    currency: string
  }
  confirmation?: {
    type: string
    confirmation_url?: string
  }
  metadata?: Record<string, string>
}

export async function createPayment(
  amountRub: number,
  description: string,
  returnUrl: string,
  metadata?: Record<string, string>
): Promise<YooKassaPaymentResponse> {
  if (!SHOP_ID || !SECRET_KEY) {
    throw new Error('YooKassa не настроена')
  }

  const auth = Buffer.from(`${SHOP_ID}:${SECRET_KEY}`).toString('base64')

  const response = await fetch('https://api.yookassa.ru/v3/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
      'Idempotence-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({
      amount: {
        value: amountRub.toFixed(2),
        currency: 'RUB',
      },
      confirmation: {
        type: 'redirect',
        return_url: returnUrl,
      },
      capture: true,
      description,
      metadata,
    } as YooKassaPaymentRequest),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`YooKassa error: ${error}`)
  }

  return response.json()
}

export async function getPayment(paymentId: string): Promise<YooKassaPaymentResponse> {
  if (!SHOP_ID || !SECRET_KEY) {
    throw new Error('YooKassa не настроена')
  }

  const auth = Buffer.from(`${SHOP_ID}:${SECRET_KEY}`).toString('base64')

  const response = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
    headers: {
      Authorization: `Basic ${auth}`,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`YooKassa error: ${error}`)
  }

  return response.json()
}

export function verifyWebhookToken(token: string | null): boolean {
  if (!WEBHOOK_TOKEN) return false
  return token === WEBHOOK_TOKEN
}
