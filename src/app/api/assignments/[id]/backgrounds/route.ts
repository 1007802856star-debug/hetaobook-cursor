import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { content, category, source, order } = body

    if (!content?.trim()) {
      return NextResponse.json({ error: '内容不能为空' }, { status: 400 })
    }

    const validCategories = ['grading_standard', 'reference_answer', 'knowledge']
    const bgCategory = validCategories.includes(category) ? category : 'knowledge'

    const background = await db.background.create({
      data: {
        assignmentId: id,
        category: bgCategory,
        content: content.trim(),
        source: source?.trim() || '',
        order: order ?? 0,
      }
    })

    return NextResponse.json(background, { status: 201 })
  } catch (error) {
    console.error('Failed to create background:', error)
    const message = error instanceof Error ? error.message : 'Failed to create background'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
