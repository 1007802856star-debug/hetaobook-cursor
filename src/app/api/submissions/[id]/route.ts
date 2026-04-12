import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.studentWork.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete submission:', error)
    return NextResponse.json({ error: 'Failed to delete submission' }, { status: 500 })
  }
}
