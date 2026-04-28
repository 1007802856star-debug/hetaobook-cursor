import { feishuRequest, getSpreadsheetToken } from '@/lib/feishu/client'

type RowValue = string | number | boolean | null

export type PushResultRow = {
  studentName: string
  studentId: string
  submittedAt: string
  content: string
  totalScore: number
  maxScore: number
  evaluation: string
  modifications: string
  feedback: string
  strengths: string
  weaknesses: string
  suggestions: string
}

function fmtDate(isoLike: string) {
  const d = new Date(isoLike)
  if (Number.isNaN(d.getTime())) return isoLike || ''
  return d.toISOString().replace('T', ' ').slice(0, 19)
}

function safeText(v: unknown) {
  return String(v ?? '').trim()
}

function normalizeModifications(raw: string) {
  if (!raw) return ''
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return safeText(raw)
    return parsed
      .map((item: any, i: number) => {
        const dim = safeText(item?.dimension || item?.criterion || `建议${i + 1}`)
        const issue = safeText(item?.issue)
        const suggestion = safeText(item?.suggestion || item?.content)
        return [dim, issue, suggestion].filter(Boolean).join(' | ')
      })
      .filter(Boolean)
      .join('\n')
  } catch {
    return safeText(raw)
  }
}

function rowsToGrid(rows: RowValue[][]) {
  return rows.map((r) => r.map((v) => (v === null ? '' : v)))
}

export function buildRowsFromResults(results: PushResultRow[], assignmentTitle: string): RowValue[][] {
  const header: RowValue[] = [
    '作业标题',
    '学生姓名',
    '学号',
    '提交时间',
    '总分',
    '满分',
    '总体评价',
    '优点',
    '不足',
    '修改建议',
    '补充反馈',
    '建议提升',
    '作业内容',
  ]

  const dataRows: RowValue[][] = results.map((r) => [
    assignmentTitle,
    safeText(r.studentName),
    safeText(r.studentId),
    fmtDate(r.submittedAt),
    Number(r.totalScore || 0),
    Number(r.maxScore || 0),
    safeText(r.evaluation),
    safeText(r.strengths),
    safeText(r.weaknesses),
    normalizeModifications(r.modifications),
    safeText(r.feedback),
    safeText(r.suggestions),
    safeText(r.content),
  ])

  return [header, ...dataRows]
}

export async function clearSheetData(sheet: { sheetId: string }, clearRows = 2000) {
  const spreadsheetToken = getSpreadsheetToken()
  if (!spreadsheetToken) throw new Error('Missing FEISHU_SPREADSHEET_TOKEN')

  const rows = Math.max(2, clearRows)
  const emptyRows = Array.from({ length: rows }, () => Array.from({ length: 26 }, () => ''))

  // Some Feishu tenants do not expose values_batch_clear. Use a plain values overwrite
  // with empty cells, which is compatible with the same write API we already use.
  await feishuRequest(`/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values`, {
    method: 'PUT',
    body: JSON.stringify({
      valueRange: {
        range: `${sheet.sheetId}!A1:Z${rows}`,
        values: emptyRows,
      },
    }),
  })
}

export async function writeSheetData(
  sheet: { sheetId: string },
  rows: RowValue[][],
  _includeHeader = true
) {
  const spreadsheetToken = getSpreadsheetToken()
  if (!spreadsheetToken) throw new Error('Missing FEISHU_SPREADSHEET_TOKEN')

  const lastRow = Math.max(1, rows.length)
  await feishuRequest(`/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values`, {
    method: 'PUT',
    body: JSON.stringify({
      valueRange: {
        range: `${sheet.sheetId}!A1:Z${lastRow}`,
        values: rowsToGrid(rows),
      },
    }),
  })
}

// Keep this API to be compatible with your existing route logic.
// Styling is optional: if this endpoint changes or fails, push should still succeed.
export async function setSheetStyle(_sheet: { sheetId: string }, _rows: number) {
  return { success: true }
}

