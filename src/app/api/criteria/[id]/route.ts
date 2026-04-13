import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { criterion, description, weight, maxScore, order } = body

    const criteria = await db.gradingCriteria.update({
      where: { id },
      data: {
        ...(criterion !== undefined && { criterion: criterion.trim() }),
        ...(description !== undefined && { description: description.trim() }),
        ...(weight !== undefined && { weight }),
        ...(maxScore !== undefined && { maxScore }),
        ...(order !== undefined && { order }),
      }
    })

    return NextResponse.json(criteria)
  } catch (error) {
    console.error('Failed to update criteria:', error)
    return NextResponse.json({ error: 'Failed to update criteria' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.gradingCriteria.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete criteria:', error)
    return NextResponse.json({ error: 'Failed to delete criteria' }, { status: 500 })
  }
}
