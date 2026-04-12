import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

/**
 * Parse CSV text into structured data
 * Handles UTF-8 properly including BOM
 */
function parseCSV(text: string): { headers: string[], rows: Record<string, string>[] } {
  // Remove BOM if present
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.substring(1)
  }

  const lines = text.split(/\r?\n/).filter(line => line.trim())
  if (lines.length === 0) return { headers: [], rows: [] }

  // Simple CSV parser - handles quoted fields with commas
  function parseLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"'
            i++
          } else {
            inQuotes = false
          }
        } else {
          current += ch
        }
      } else {
        if (ch === '"') {
          inQuotes = true
        } else if (ch === ',') {
          result.push(current.trim())
          current = ''
        } else {
          current += ch
        }
      }
    }
    result.push(current.trim())
    return result
  }

  const headers = parseLine(lines[0])
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i])
    if (values.length === 0 || (values.length === 1 && values[0] === '')) continue
    const row: Record<string, string> = {}
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? ''
    }
    rows.push(row)
  }

  return { headers, rows }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: '没有上传文件' }, { status: 400 })
    }

    // Save file to upload directory
    const uploadDir = '/home/z/my-project/upload'
    await mkdir(uploadDir, { recursive: true })
    const filePath = path.join(uploadDir, `${Date.now()}_${file.name}`)
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Parse file based on type
    const fileName = file.name.toLowerCase()
    let parsedData: { headers: string[], rows: Record<string, string>[] } = { headers: [], rows: [] }

    if (fileName.endsWith('.csv')) {
      // Parse CSV with our custom parser for proper UTF-8 support
      const text = new TextDecoder('utf-8').decode(buffer)
      parsedData = parseCSV(text)
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      // Dynamic import xlsx for Excel files only
      const XLSX = await import('xlsx')
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '', raw: false })

      if (jsonData.length > 0) {
        const headers = Object.keys(jsonData[0])
        const rows = jsonData.map(row => {
          const obj: Record<string, string> = {}
          for (const key of headers) {
            obj[key] = String(row[key] ?? '')
          }
          return obj
        })
        parsedData = { headers, rows }
      }
    } else if (fileName.endsWith('.txt')) {
      // Parse text file with UTF-8
      const text = new TextDecoder('utf-8').decode(buffer)
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
      if (lines.length > 0) {
        parsedData = {
          headers: ['内容'],
          rows: lines.map(line => ({ '内容': line }))
        }
      }
    } else {
      // For other file types (docx, pdf), just store the file info
      parsedData = {
        headers: ['文件名', '类型'],
        rows: [{ '文件名': file.name, '类型': file.type || '未知' }]
      }
    }

    return NextResponse.json({
      fileName: file.name,
      filePath,
      fileSize: file.size,
      fileType: file.type,
      headers: parsedData.headers,
      rows: parsedData.rows,
      totalRows: parsedData.rows.length,
    })
  } catch (error) {
    console.error('File upload error:', error)
    return NextResponse.json({ error: '文件上传失败: ' + (error instanceof Error ? error.message : '未知错误') }, { status: 500 })
  }
}
