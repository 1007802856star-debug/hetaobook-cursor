import { NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

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

    // Only verify SDK initialization (no API call needed)
    const zai = await ZAI.create()

    if (zai) {
      cachedModelInfo = {
        connected: true,
        model: 'GLM-4-Plus',
      }
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
    })
  }
}
