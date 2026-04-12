import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { assignmentId } = await request.json()

    if (!assignmentId) {
      return NextResponse.json({ error: '缺少作业ID' }, { status: 400 })
    }

    // Find all ungraded submissions
    const submissions = await db.studentWork.findMany({
      where: {
        assignmentId,
        status: 'submitted',
      }
    })

    if (submissions.length === 0) {
      return NextResponse.json({ message: '没有待批改的作业', graded: 0 })
    }

    // Grade each submission sequentially to avoid rate limits
    const results = []
    const errors = []

    for (const submission of submissions) {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/grade/${submission.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })

        if (res.ok) {
          const result = await res.json()
          results.push(result)
        } else {
          const err = await res.json()
          errors.push({ studentName: submission.studentName, error: err.error })
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (err) {
        errors.push({ studentName: submission.studentName, error: String(err) })
      }
    }

    return NextResponse.json({
      graded: results.length,
      errors: errors.length,
      errorDetails: errors,
    })
  } catch (error) {
    console.error('Batch grading error:', error)
    return NextResponse.json({ error: '批量批改失败' }, { status: 500 })
  }
}
