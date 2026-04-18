import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    databaseUrl: process.env.DATABASE_URL ? 'configured' : 'missing',
    nodeEnv: process.env.NODE_ENV || 'unknown',
  })
}
