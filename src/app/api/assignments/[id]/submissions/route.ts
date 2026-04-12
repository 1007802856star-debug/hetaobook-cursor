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

    // Support single or batch submissions with dynamic fields
    const items: Array<Record<string, string>> = body.items || [body]

    if (!items.length) {
      return NextResponse.json({ error: '没有提交内容' }, { status: 400 })
    }

    const results = []
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
    return NextResponse.json({ error: 'Failed to create submission' }, { status: 500 })
  }
}
