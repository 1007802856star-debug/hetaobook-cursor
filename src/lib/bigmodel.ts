import { getCompletionText } from '@/lib/zai'

export type ChatCompletionBody = {
  model?: string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: any }>
  temperature?: number
  max_tokens?: number
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, '')
}

/** OpenAPI `model` id; override with env `ZAI_MODEL` (e.g. `glm-4.6v`). */
export function getBigmodelModelId(): string {
  return process.env.ZAI_MODEL?.trim() || 'glm-4-plus'
}

function resolveModelId(requested?: string): string {
  const id = requested?.trim()
  if (id) return id
  return getBigmodelModelId()
}

export async function bigmodelChatCompletion(body: ChatCompletionBody) {
  const baseUrl = process.env.ZAI_BASE_URL
  const apiKey = process.env.ZAI_API_KEY
  if (!baseUrl || !apiKey) {
    return { error: { code: 'CONFIG', message: 'Missing ZAI_BASE_URL or ZAI_API_KEY' } }
  }

  const url = `${normalizeBaseUrl(baseUrl)}/chat/completions`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: resolveModelId(body.model),
        messages: body.messages,
        temperature: body.temperature,
        max_tokens: body.max_tokens,
      }),
    })

    const text = await res.text()
    let json: any = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = null
    }

    if (!res.ok) {
      return {
        error: {
          code: String(res.status),
          message:
            (json && (json.error?.message || json.msg || json.message)) ||
            text ||
            `HTTP ${res.status}`,
        },
      }
    }

    return json
  } catch (e) {
    return {
      error: {
        code: 'NETWORK',
        message: e instanceof Error ? e.message : String(e),
      },
    }
  }
}

export function completionTextFromBigmodel(completion: any) {
  return getCompletionText(completion)
}

