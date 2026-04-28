import { NextResponse } from 'next/server'
import { bigmodelChatCompletion, completionTextFromBigmodel } from '@/lib/bigmodel'
import { coerceTextContent } from '@/lib/zai'

// Cache the model info to avoid repeated API calls
let cachedModelInfo: { model: string; provider: string; verified: boolean; displayName: string } | null = null

function coerceModelName(completion: any): string {
  const candidates = [
    completion?.model,
    completion?.meta?.model,
    completion?.data?.model,
    completion?.result?.model,
    completion?.response?.model,
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim()
  }
  return ''
}

export async function GET() {
  try {
    if (cachedModelInfo) {
      return NextResponse.json(cachedModelInfo)
    }

    const completion = await bigmodelChatCompletion({
      messages: [{ role: 'user', content: '请输出你的模型名称，只输出名称即可。' }],
      temperature: 0,
      max_tokens: 20,
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
      return NextResponse.json({
        model: 'unavailable',
        provider: 'Z.ai',
        verified: false,
        displayName: `API错误：${msg}`,
      })
    }

    const sdkModel = coerceModelName(completion)
    const modelResponse =
      completionTextFromBigmodel(completion) ||
      coerceTextContent(completion?.choices?.[0]?.message?.content)
    const bestName = modelResponse || sdkModel
    const fallbackName = 'glm-4-plus'
    const effectiveName = bestName || fallbackName
    const verified = true

    cachedModelInfo = {
      model: effectiveName,
      provider: 'Z.ai',
      verified,
      displayName:
        effectiveName === 'glm-4-plus'
          ? 'GLM-4-Plus'
          : effectiveName,
    }

    return NextResponse.json(cachedModelInfo)
  } catch (error) {
    console.error('Failed to get AI model info:', error)
    return NextResponse.json({
      model: 'unavailable',
      provider: 'Z.ai',
      verified: false,
      displayName: 'AI模型（未连接）',
    })
  }
}
