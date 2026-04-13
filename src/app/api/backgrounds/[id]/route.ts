import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { content, category, source, order } = body

    const validCategories = ['grading_standard', 'reference_answer', 'knowledge']
    const updateData: Record<string, unknown> = {}
    if (content !== undefined) updateData.content = content.trim()
    if (category !== undefined && validCategories.includes(category)) updateData.category = category
    if (source !== undefined) updateData.source = source.trim()
    if (order !== undefined) updateData.order = order

    const background = await db.background.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(background)
  } catch (error) {
    console.error('Failed to update background:', error)
    return NextResponse.json({ error: 'Failed to update background' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.background.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete background:', error)
    return NextResponse.json({ error: 'Failed to delete background' }, { status: 500 })
  }
}
