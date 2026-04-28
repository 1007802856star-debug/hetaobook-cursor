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
        model: body.model || 'glm-4-plus',
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

