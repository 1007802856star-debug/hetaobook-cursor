import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { content, source, order } = body

    if (!content?.trim()) {
      return NextResponse.json({ error: '背景知识内容不能为空' }, { status: 400 })
    }

    const background = await db.background.create({
      data: {
        assignmentId: id,
        content: content.trim(),
        source: source?.trim() || '',
        order: order ?? 0,
      }
    })

    return NextResponse.json(background, { status: 201 })
  } catch (error) {
    console.error('Failed to create background:', error)
    return NextResponse.json({ error: 'Failed to create background' }, { status: 500 })
  }
}
