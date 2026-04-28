import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ZAI from 'z-ai-web-dev-sdk'

export function coerceTextContent(content: unknown): string {
  if (typeof content === 'string') return content.trim()
  if (Array.isArray(content)) {
    // Some SDKs return multi-part content, e.g. [{type:'text', text:'...'}]
    const parts = content
      .map((p: any) => {
        if (typeof p === 'string') return p
        if (p && typeof p === 'object') {
          if (typeof p.text === 'string') return p.text
          if (typeof p.content === 'string') return p.content
        }
        return ''
      })
      .filter(Boolean)
    return parts.join('\n').trim()
  }
  if (content && typeof content === 'object') {
    const anyContent: any = content
    if (typeof anyContent.text === 'string') return anyContent.text.trim()
    if (typeof anyContent.content === 'string') return anyContent.content.trim()
  }
  return ''
}

export function getCompletionText(completion: any): string {
  // OpenAI-like: choices[0].message.content
  const content = completion?.choices?.[0]?.message?.content
  const text = coerceTextContent(content)
  if (text) return text

  // Some SDKs may put text in other fields
  const altCandidates = [
    completion?.choices?.[0]?.message?.text,
    completion?.choices?.[0]?.text,
    completion?.output_text,
    completion?.data?.output_text,
  ]
  for (const c of altCandidates) {
    const t = coerceTextContent(c)
    if (t) return t
  }

  // Last resort: walk the message object and find first non-empty string field.
  const message = completion?.choices?.[0]?.message
  const seen = new Set<any>()
  const queue: any[] = [message]
  while (queue.length) {
    const cur = queue.shift()
    if (!cur || typeof cur !== 'object') continue
    if (seen.has(cur)) continue
    seen.add(cur)

    for (const v of Object.values(cur)) {
      if (typeof v === 'string' && v.trim()) return v.trim()
      if (Array.isArray(v) || (v && typeof v === 'object')) queue.push(v)
    }
  }

  return ''
}

function ensureZaiConfigFile() {
  // z-ai-web-dev-sdk only searches:
  // 1) ./.z-ai-config
  // 2) ~/.z-ai-config
  // 3) /etc/.z-ai-config
  //
  // Vercel serverless runtime is read-only except /tmp. So we point HOME to /tmp
  // and write /tmp/.z-ai-config at runtime if env vars are present.
  const baseUrl = process.env.ZAI_BASE_URL
  const apiKey = process.env.ZAI_API_KEY
  const chatId = process.env.ZAI_CHAT_ID
  const userId = process.env.ZAI_USER_ID

  if (!baseUrl || !apiKey) return

  const home = process.env.HOME || tmpdir()
  const safeHome = home.startsWith('/tmp') ? home : tmpdir()
  process.env.HOME = safeHome

  const configPath = join(safeHome, '.z-ai-config')
  if (existsSync(configPath)) return

  mkdirSync(safeHome, { recursive: true })
  writeFileSync(
    configPath,
    JSON.stringify(
      {
        baseUrl,
        apiKey,
        chatId: chatId || '',
        userId: userId || '',
      },
      null,
      2
    )
  )
}

export async function createZaiClient() {
  ensureZaiConfigFile()
  return await ZAI.create()
}

