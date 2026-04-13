import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const assignments = await db.assignment.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { criteria: true, backgrounds: true, submissions: true }
        }
      }
    })
    return NextResponse.json(assignments)
  } catch (error) {
    console.error('Failed to fetch assignments:', error)
    return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { title, description, subject } = body

    if (!title?.trim()) {
      return NextResponse.json({ error: '标题不能为空' }, { status: 400 })
    }

    const assignment = await db.assignment.create({
      data: {
        title: title.trim(),
        description: description?.trim() || '',
        subject: subject?.trim() || '',
      }
    })

    return NextResponse.json(assignment, { status: 201 })
  } catch (error) {
    console.error('Failed to create assignment:', error)
    return NextResponse.json({ error: 'Failed to create assignment' }, { status: 500 })
  }
}
