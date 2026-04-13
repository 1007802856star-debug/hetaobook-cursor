import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const results = await db.gradingResult.findMany({
      where: {
        studentWork: { assignmentId: id }
      },
      include: {
        studentWork: {
          select: { studentName: true, studentId: true }
        },
        scores: {
          include: {
            criteria: { select: { criterion: true, maxScore: true } }
          }
        }
      },
      orderBy: { totalScore: 'desc' }
    })

    return NextResponse.json(results)
  } catch (error) {
    console.error('Failed to fetch results:', error)
    return NextResponse.json({ error: 'Failed to fetch results' }, { status: 500 })
  }
}
