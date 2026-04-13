import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Fix stale statuses: any submission with status='grading' for more than 5 minutes
    // should be reset to 'submitted' (likely a failed grading attempt)
    const staleThreshold = new Date(Date.now() - 5 * 60 * 1000)
    const staleGrading = await db.studentWork.findMany({
      where: {
        assignmentId: id,
        status: 'grading',
        updatedAt: { lt: staleThreshold }
      }
    })
    if (staleGrading.length > 0) {
      await db.studentWork.updateMany({
        where: {
          id: { in: staleGrading.map(s => s.id) },
        },
        data: { status: 'submitted' }
      })
    }

    // Also fix: submissions with status='graded' but no result, or status='submitted' with result
    const submissions = await db.studentWork.findMany({
      where: { assignmentId: id },
      orderBy: { submittedAt: 'desc' },
      include: {
        result: {
          include: {
            scores: {
              include: {
                criteria: { select: { criterion: true, maxScore: true } }
              }
            }
          }
        }
      }
    })

    // Fix inconsistencies
    for (const s of submissions) {
      if (s.status === 'graded' && !s.result) {
        // Has graded status but no result - reset to submitted
        await db.studentWork.update({
          where: { id: s.id },
          data: { status: 'submitted' }
        })
        s.status = 'submitted'
      } else if (s.status === 'submitted' && s.result) {
        // Has result but still marked as submitted - update to graded
        await db.studentWork.update({
          where: { id: s.id },
          data: { status: 'graded' }
        })
        s.status = 'graded'
      }
    }

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

    // Support single or batch submissions with dynamic fields
    const items: Array<Record<string, string>> = body.items || [body]

    if (!items.length) {
      return NextResponse.json({ error: '没有提交内容' }, { status: 400 })
    }

    const results: Array<{
      id: string
      assignmentId: string
      studentName: string
      studentId: string
      content: string
      filePath: string
      fileType: string
      status: string
      submittedAt: Date
      createdAt: Date
      updatedAt: Date
    }> = []
    for (const item of items) {
      if (!item.studentName?.trim()) continue

      // Separate known fields from extra fields
      const studentName = item.studentName.trim()
      const studentId = item.studentId?.trim() || ''
      const content = item.content?.trim() || ''

      // Collect extra custom fields into content prefix
      const knownKeys = ['studentName', 'studentId', 'content']
      const extraParts: string[] = []
      for (const [key, value] of Object.entries(item)) {
        if (!knownKeys.includes(key) && value?.trim()) {
          extraParts.push(`${key}: ${value.trim()}`)
        }
      }

      // Build final content: extra fields + original content
      const finalContent = [extraParts.join('\n'), content].filter(Boolean).join('\n')

      if (!finalContent) continue

      const submission = await db.studentWork.create({
        data: {
          assignmentId: id,
          studentName,
          studentId,
          content: finalContent,
          filePath: item.filePath || '',
          fileType: item.fileType || (content ? 'text' : 'file'),
          status: 'submitted',
        }
      })
      results.push(submission)
    }

    return NextResponse.json(results, { status: 201 })
  } catch (error) {
    console.error('Failed to create submission:', error)
    return NextResponse.json({ error: '提交失败，请重试' }, { status: 500 })
  }
}
