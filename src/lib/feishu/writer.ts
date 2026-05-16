import { feishuRequest, getSpreadsheetToken } from '@/lib/feishu/client'

type RowValue = string | number | boolean | null

/** 0-based column index → Excel column label (0→A, 25→Z, 26→AA) */
export function columnIndexToLabel(zeroBasedIndex: number): string {
  let n = zeroBasedIndex + 1
  let label = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    label = String.fromCharCode(65 + rem) + label
    n = Math.floor((n - 1) / 26)
  }
  return label
}

export type PushWideRow = {
  studentName: string
  studentId: string
  submittedAt: string
  content: string
  totalScore: number
  maxScore: number
  evaluation: string
  /** criterion name → score for this row */
  dimensionScores: Record<string, number | string>
}

function fmtDate(isoLike: string) {
  const d = new Date(isoLike)
  if (Number.isNaN(d.getTime())) return isoLike || ''
  return d.toISOString().replace('T', ' ').slice(0, 19)
}

function safeText(v: unknown) {
  return String(v ?? '').trim()
}

function rowsToGrid(rows: RowValue[][]) {
  return rows.map((r) => r.map((v) => (v === null ? '' : v)))
}

/**
 * 宽表：固定列 + 按作业维度动态列（列名为维度名称，单元格为得分）+ 作业内容
 */
export function buildWideSheetRows(
  assignmentTitle: string,
  criteriaOrder: string[],
  rows: PushWideRow[]
): RowValue[][] {
  const fixedHeader: RowValue[] = [
    '作业标题',
    '学生姓名',
    '学号',
    '提交时间',
    '总分',
    '满分',
    '综合评价',
  ]
  const header: RowValue[] = [...fixedHeader, ...criteriaOrder.map((c) => safeText(c)), '作业内容']

  const dataRows: RowValue[][] = rows.map((r) => {
    const dimCells = criteriaOrder.map((name) => {
      const v = r.dimensionScores[name]
      if (v === '' || v === undefined || v === null) return ''
      const n = typeof v === 'number' ? v : Number(v)
      return Number.isFinite(n) ? n : safeText(v)
    })
    return [
      assignmentTitle,
      safeText(r.studentName),
      safeText(r.studentId),
      fmtDate(r.submittedAt),
      Number(r.totalScore || 0),
      Number(r.maxScore || 0),
      safeText(r.evaluation),
      ...dimCells,
      safeText(r.content),
    ]
  })

  return [header, ...dataRows]
}

export async function clearSheetData(
  sheet: { sheetId: string },
  clearRows = 2000,
  columnCount = 52
) {
  const spreadsheetToken = getSpreadsheetToken()
  if (!spreadsheetToken) throw new Error('Missing FEISHU_SPREADSHEET_TOKEN')

  const rows = Math.max(2, clearRows)
  const cols = Math.min(Math.max(columnCount, 8), 100)
  const emptyRows = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''))
  const lastCol = columnIndexToLabel(cols - 1)

  await feishuRequest(`/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values`, {
    method: 'PUT',
    body: JSON.stringify({
      valueRange: {
        range: `${sheet.sheetId}!A1:${lastCol}${rows}`,
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

  const colCount = rows[0]?.length ?? 1
  const lastCol = columnIndexToLabel(Math.max(colCount - 1, 0))
  const lastRow = Math.max(1, rows.length)

  await feishuRequest(`/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values`, {
    method: 'PUT',
    body: JSON.stringify({
      valueRange: {
        range: `${sheet.sheetId}!A1:${lastCol}${lastRow}`,
        values: rowsToGrid(rows),
      },
    }),
  })
}

export async function setSheetStyle(_sheet: { sheetId: string }, _rows: number) {
  return { success: true }
}
