import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const assignment = await db.assignment.findUnique({
      where: { id },
      include: {
        criteria: { orderBy: { order: 'asc' } },
        backgrounds: { orderBy: { order: 'asc' } },
        submissions: {
          orderBy: { submittedAt: 'desc' },
          include: { result: true }
        }
      }
    })

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    }

    return NextResponse.json(assignment)
  } catch (error) {
    console.error('Failed to fetch assignment:', error)
    return NextResponse.json({ error: 'Failed to fetch assignment' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { title, description, subject } = body

    const assignment = await db.assignment.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(description !== undefined && { description: description.trim() }),
        ...(subject !== undefined && { subject: subject.trim() }),
      }
    })

    return NextResponse.json(assignment)
  } catch (error) {
    console.error('Failed to update assignment:', error)
    return NextResponse.json({ error: 'Failed to update assignment' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.assignment.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete assignment:', error)
    return NextResponse.json({ error: 'Failed to delete assignment' }, { status: 500 })
  }
}
