import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

type ParsedTable = {
  headers: string[]
  rows: Record<string, string>[]
  totalRows: number
  fileName: string
}

function parseExcel(fileName: string, bytes: Uint8Array): ParsedTable {
  const workbook = XLSX.read(bytes, { type: 'array' })
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) {
    throw new Error('Excel 文件中没有工作表')
  }

  const sheet = workbook.Sheets[firstSheetName]
  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
    blankrows: false,
  })

  if (!matrix.length) {
    throw new Error('Excel 文件为空')
  }

  const rawHeaders = (matrix[0] || []).map((v) => String(v ?? '').trim())
  const headers = rawHeaders.map((h, i) => (h ? h : `列${i + 1}`))
  const rows = matrix
    .slice(1)
    .map((line) => {
      const row: Record<string, string> = {}
      headers.forEach((header, idx) => {
        row[header] = String(line?.[idx] ?? '').trim()
      })
      return row
    })
    .filter((row) => Object.values(row).some(Boolean))

  return {
    headers,
    rows,
    totalRows: rows.length,
    fileName,
  }
}

function parseCsv(fileName: string, text: string): ParsedTable {
  const workbook = XLSX.read(text, { type: 'string' })
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) {
    throw new Error('CSV 文件为空')
  }
  const sheet = workbook.Sheets[firstSheetName]
  const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    raw: false,
    defval: '',
    blankrows: false,
  })

  const headers = jsonRows.length ? Object.keys(jsonRows[0]) : []
  const rows = jsonRows.map((item) => {
    const row: Record<string, string> = {}
    for (const [k, v] of Object.entries(item)) row[k] = String(v ?? '').trim()
    return row
  })

  return {
    headers,
    rows,
    totalRows: rows.length,
    fileName,
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: '缺少上传文件' }, { status: 400 })
    }

    const fileName = file.name || '上传文件'
    const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase()
    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer)

    if (ext === '.xlsx' || ext === '.xls') {
      const parsed = parseExcel(fileName, bytes)
      return NextResponse.json(parsed)
    }

    if (ext === '.csv') {
      const text = new TextDecoder('utf-8').decode(bytes)
      const parsed = parseCsv(fileName, text)
      return NextResponse.json(parsed)
    }

    if (ext === '.txt') {
      const text = new TextDecoder('utf-8').decode(bytes).trim()
      return NextResponse.json({
        headers: [],
        rows: [],
        totalRows: 0,
        fileName,
        content: text,
      })
    }

    return NextResponse.json(
      { error: '暂不支持该文件解析，请上传 Excel/CSV/TXT 文件' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Upload parse failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '上传解析失败' },
      { status: 500 }
    )
  }
}
