import { NextResponse } from 'next/server'
import { bigmodelChatCompletion, completionTextFromBigmodel, getBigmodelModelId } from '@/lib/bigmodel'

// Cache model info to avoid repeated API calls
let cachedModelInfo: { connected: boolean; model: string } | null = null
let lastCheckTime = 0
const CHECK_INTERVAL = 5 * 60 * 1000 // Re-check every 5 minutes

export async function GET() {
  try {
    const now = Date.now()

    // Return cached result if still fresh
    if (cachedModelInfo && (now - lastCheckTime) < CHECK_INTERVAL) {
      return NextResponse.json(cachedModelInfo)
    }

    // Verify by doing a tiny request (catch invalid credentials/quota issues)
    const completion = await bigmodelChatCompletion({
      messages: [{ role: 'user', content: 'ping' }],
      temperature: 0,
      max_tokens: 5,
    })

    if ((completion as any)?.error) {
      const err = (completion as any).error
      const msg =
        typeof err === 'string'
          ? err
          : err && typeof err === 'object'
            ? JSON.stringify(
                {
                  message: (err as any).message,
                  code: (err as any).code,
                  status: (err as any).status,
                  error: (err as any).error,
                  details: (err as any).details,
                },
                null,
                0
              )
            : String(err || 'unknown error')
      throw new Error(`ZAI API error: ${msg}`)
    }

    const text = completionTextFromBigmodel(completion)
    if (text || completion) {
      const id = getBigmodelModelId()
      const label =
        id === 'glm-4-plus'
          ? 'GLM-4-Plus'
          : id.toLowerCase() === 'glm-4.6v' || id.toLowerCase() === 'glm-4-6v'
            ? 'GLM-4.6V'
            : id
      cachedModelInfo = { connected: true, model: label }
      lastCheckTime = now
      return NextResponse.json(cachedModelInfo)
    } else {
      cachedModelInfo = {
        connected: false,
        model: '未连接',
      }
      lastCheckTime = now
      return NextResponse.json(cachedModelInfo)
    }
  } catch (error) {
    console.error('Model status check failed:', error)
    return NextResponse.json({
      connected: false,
      model: '未连接',
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
