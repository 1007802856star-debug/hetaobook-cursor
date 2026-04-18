import { NextResponse } from 'next/server'
import * as xlsx from 'xlsx'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: '请选择要上传的文件' }, { status: 400 })
    }

    const fileName = file.name
    const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase()

    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), 'upload')
    await mkdir(uploadDir, { recursive: true })

    // Save the file
    const timestamp = Date.now()
    const savedName = `${timestamp}_${fileName}`
    const savedPath = path.join(uploadDir, savedName)

    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(savedPath, buffer)

    // Parse Excel/CSV files
    if (['.xlsx', '.xls', '.csv'].includes(ext)) {
      const workbook = xlsx.read(buffer, { type: 'buffer' })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]

      // Convert to JSON with headers
      const jsonData = xlsx.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' })

      if (jsonData.length === 0) {
        return NextResponse.json({
          headers: [],
          rows: [],
          totalRows: 0,
          fileName,
          savedPath: savedName,
        })
      }

      const headers = Object.keys(jsonData[0])
      const rows = jsonData.map(row => {
        const cleanRow: Record<string, string> = {}
        for (const h of headers) {
          cleanRow[h] = String(row[h] || '').trim()
        }
        return cleanRow
      })

      return NextResponse.json({
        headers,
        rows,
        totalRows: rows.length,
        fileName,
        savedPath: savedName,
      })
    }

    // For text files, return the content
    if (ext === '.txt') {
      const text = new TextDecoder().decode(buffer)
      return NextResponse.json({
        headers: [],
        rows: [],
        totalRows: 0,
        fileName,
        savedPath: savedName,
        textContent: text,
      })
    }

    // For other file types (docx, pdf), just save and return basic info
    return NextResponse.json({
      headers: [],
      rows: [],
      totalRows: 0,
      fileName,
      savedPath: savedName,
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: '文件上传失败：' + (error instanceof Error ? error.message : '未知错误') },
      { status: 500 }
    )
  }
}
