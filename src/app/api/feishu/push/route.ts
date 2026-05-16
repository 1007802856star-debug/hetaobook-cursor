import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSheet, getSpreadsheetUrl } from '@/lib/feishu/sheet'
import {
  writeSheetData,
  clearSheetData,
  setSheetStyle,
  buildWideSheetRows,
  type PushWideRow,
} from '@/lib/feishu/writer'
import { grantAdminPermission } from '@/lib/feishu/permission'

/**
 * 飞书表格推送 API
 * POST /api/feishu/push
 * body: { assignmentId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { assignmentId } = body

    if (!assignmentId) {
      return NextResponse.json(
        { success: false, message: '缺少 assignmentId 参数' },
        { status: 400 }
      )
    }

    const assignment = await db.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        criteria: { orderBy: { order: 'asc' } },
        submissions: {
          include: {
            result: {
              include: {
                scores: {
                  include: {
                    criteria: { select: { id: true, criterion: true } },
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!assignment) {
      return NextResponse.json(
        { success: false, message: '作业不存在' },
        { status: 404 }
      )
    }

    const gradedSubmissions = assignment.submissions.filter((s) => s.result !== null)
    if (gradedSubmissions.length === 0) {
      return NextResponse.json(
        { success: false, message: '暂无批改结果可推送，请先完成批改' },
        { status: 400 }
      )
    }

    const criteriaOrder = assignment.criteria.map((c) => c.criterion.trim()).filter(Boolean)

    const results: PushWideRow[] = gradedSubmissions.map((s) => {
      const dimensionScores: Record<string, number | string> = {}
      for (const sc of s.result?.scores ?? []) {
        const name = sc.criteria?.criterion?.trim()
        if (name) dimensionScores[name] = sc.score
      }
      return {
        studentName: s.studentName,
        studentId: s.studentId,
        submittedAt: s.submittedAt?.toISOString?.() || s.createdAt?.toISOString?.() || '',
        content: s.content || '',
        totalScore: s.result?.totalScore || 0,
        maxScore: s.result?.maxScore || 100,
        evaluation: s.result?.evaluation || '',
        dimensionScores,
      }
    })

    const rows = buildWideSheetRows(assignment.title, criteriaOrder, results)
    const colCount = rows[0]?.length ?? 12
    const sheetTitle = assignment.title
    const { sheet, isNew } = await ensureSheet(sheetTitle)

    if (isNew) {
      await writeSheetData(sheet, rows, true)
      await setSheetStyle(sheet, rows.length + 1)
    } else {
      await clearSheetData(sheet, rows.length + 200, colCount)
      await writeSheetData(sheet, rows, true)
      await setSheetStyle(sheet, rows.length + 1)
    }

    let permMessage = ''
    try {
      const permResult = await grantAdminPermission()
      permMessage = permResult.success ? `，${permResult.message}` : ''
    } catch (e: any) {
      console.warn('添加管理权限失败（不影响推送结果）:', e?.message || String(e))
    }

    const url = await getSpreadsheetUrl(sheet.sheetId)
    return NextResponse.json({
      success: true,
      url,
      message: `已推送 ${results.length} 条批改结果到飞书表格${isNew ? '（新建Sheet）' : '（覆盖更新）'}${permMessage}`,
      sheetTitle,
      count: results.length,
      isNew,
    })
  } catch (error: any) {
    console.error('飞书推送失败:', error)
    return NextResponse.json(
      {
        success: false,
        message: `推送失败: ${error?.message || String(error)}`,
      },
      { status: 500 }
    )
  }
}

