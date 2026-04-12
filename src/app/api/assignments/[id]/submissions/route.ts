import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const submissions = await db.studentWork.findMany({
      where: { assignmentId: id },
      orderBy: { submittedAt: 'desc' },
      include: {
        result: {
          include: { scores: true }
        }
      }
    })
    return NextResponse.json(submissions)
  } catch (error) {
    console.error('Failed to fetch submissions:', error)
    return NextResponse.json({ error: 'Failed to fetch submissions' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Support single or batch submissions
    const items: Array<{ studentName: string; studentId?: string; content: string }> = body.items || [body]

    if (!items.length) {
      return NextResponse.json({ error: '没有提交内容' }, { status: 400 })
    }

    const results = []
    for (const item of items) {
      if (!item.studentName?.trim() || !item.content?.trim()) continue

      const submission = await db.studentWork.create({
        data: {
          assignmentId: id,
          studentName: item.studentName.trim(),
          studentId: item.studentId?.trim() || '',
          content: item.content.trim(),
          fileType: 'text',
          status: 'submitted',
        }
      })
      results.push(submission)
    }

    return NextResponse.json(results, { status: 201 })
  } catch (error) {
    console.error('Failed to create submission:', error)
    return NextResponse.json({ error: 'Failed to create submission' }, { status: 500 })
  }
}
