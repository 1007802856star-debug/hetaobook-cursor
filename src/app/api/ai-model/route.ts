import { NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

// Cache the model info to avoid repeated API calls
let cachedModelInfo: { model: string; provider: string; verified: boolean } | null = null

export async function GET() {
  try {
    if (cachedModelInfo) {
      return NextResponse.json(cachedModelInfo)
    }

    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: [{ role: 'user', content: '请输出你的模型名称，只输出名称即可。' }],
      temperature: 0,
      max_tokens: 20,
    })

    const modelName = completion.model || 'unknown'
    const modelResponse = completion.choices?.[0]?.message?.content || ''

    cachedModelInfo = {
      model: modelName,
      provider: 'Z.ai',
      verified: true,
      displayName: modelName === 'glm-4-plus' ? 'GLM-4-Plus' : modelResponse || modelName,
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
