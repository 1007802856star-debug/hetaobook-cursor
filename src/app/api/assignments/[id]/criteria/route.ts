import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { criterion, description, weight, maxScore, order } = body

    if (!criterion?.trim()) {
      return NextResponse.json({ error: '评分维度名称不能为空' }, { status: 400 })
    }

    const criteria = await db.gradingCriteria.create({
      data: {
        assignmentId: id,
        criterion: criterion.trim(),
        description: description?.trim() || '',
        weight: weight ?? 1.0,
        maxScore: maxScore ?? 100.0,
        order: order ?? 0,
      }
    })

    return NextResponse.json(criteria, { status: 201 })
  } catch (error) {
    console.error('Failed to create criteria:', error)
    return NextResponse.json({ error: 'Failed to create criteria' }, { status: 500 })
  }
}
