import { NextResponse } from 'next/server'
import { bigmodelChatCompletion, completionTextFromBigmodel } from '@/lib/bigmodel'

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
      model: 'glm-4-plus',
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
      cachedModelInfo = { connected: true, model: 'GLM-4-Plus' }
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
