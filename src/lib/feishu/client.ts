type FeishuErrorPayload = {
  code?: number
  msg?: string
  message?: string
  [key: string]: unknown
}

const FEISHU_BASE_URL = (process.env.FEISHU_BASE_URL || 'https://open.feishu.cn').replace(/\/+$/, '')

let cachedToken: { value: string; expiresAt: number } | null = null

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

export function getSpreadsheetToken() {
  return process.env.FEISHU_SPREADSHEET_TOKEN || process.env.FEISHU_SHEET_TOKEN || ''
}

async function parseJsonSafe(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text()
  if (!text) return {}
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return { raw: text }
  }
}

function throwIfFeishuError(payload: Record<string, unknown>, fallback: string) {
  const code = Number(payload.code ?? payload.StatusCode ?? 0)
  if (code && code !== 0) {
    const msg = String((payload as FeishuErrorPayload).msg || (payload as FeishuErrorPayload).message || fallback)
    throw new Error(`${fallback}: [${code}] ${msg}`)
  }
}

export async function getTenantAccessToken() {
  const now = Date.now()
  if (cachedToken && cachedToken.expiresAt > now) return cachedToken.value

  const appId = requireEnv('FEISHU_APP_ID')
  const appSecret = requireEnv('FEISHU_APP_SECRET')

  const res = await fetch(`${FEISHU_BASE_URL}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      app_id: appId,
      app_secret: appSecret,
    }),
  })

  const payload = await parseJsonSafe(res)
  if (!res.ok) {
    throw new Error(`Failed to fetch tenant token: HTTP ${res.status}`)
  }
  throwIfFeishuError(payload, 'Failed to fetch tenant token')

  const token = String(payload.tenant_access_token || '')
  if (!token) throw new Error('Failed to fetch tenant token: missing tenant_access_token')

  const expire = Number(payload.expire || 7200)
  cachedToken = {
    value: token,
    // Keep 60s buffer to avoid edge-expiry issues.
    expiresAt: now + Math.max(60, expire - 60) * 1000,
  }
  return token
}

export async function feishuRequest(path: string, init: RequestInit = {}) {
  const token = await getTenantAccessToken()
  const res = await fetch(`${FEISHU_BASE_URL}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const payload = await parseJsonSafe(res)
  if (!res.ok) {
    throw new Error(`Feishu request failed: HTTP ${res.status} ${path}`)
  }
  throwIfFeishuError(payload, `Feishu request failed: ${path}`)
  return payload
}

