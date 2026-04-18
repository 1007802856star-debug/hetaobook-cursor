import { NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

export async function GET() {
  try {
    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'user', content: '回复OK' }
      ],
      temperature: 0,
      max_tokens: 5,
    })

    const content = completion.choices?.[0]?.message?.content
    if (content) {
      return NextResponse.json({
        connected: true,
        model: 'GLM-4-Plus',
      })
    } else {
      return NextResponse.json({
        connected: false,
        model: '未连接',
      })
    }
  } catch (error) {
    console.error('Model status check failed:', error)
    return NextResponse.json({
      connected: false,
      model: '未连接',
    })
  }
}
