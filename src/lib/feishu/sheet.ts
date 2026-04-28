import { feishuRequest, getSpreadsheetToken } from '@/lib/feishu/client'

export type FeishuSheetMeta = {
  sheetId: string
  title: string
}

type EnsureSheetResult = {
  sheet: FeishuSheetMeta
  isNew: boolean
}

function normalizeSheetTitle(raw: string) {
  const title = (raw || '未命名作业').trim()
  // Feishu sheet title has length limits; keep it short and safe.
  return title.slice(0, 80)
}

export async function listSheets() {
  const spreadsheetToken = getSpreadsheetToken()
  if (!spreadsheetToken) throw new Error('Missing FEISHU_SPREADSHEET_TOKEN')

  const payload = await feishuRequest(`/open-apis/sheets/v3/spreadsheets/${spreadsheetToken}/sheets/query`, {
    method: 'GET',
  })
  const sheets = (((payload.data as any)?.sheets || []) as any[]).map((s) => ({
    sheetId: String(s.sheet_id || s.sheetId || ''),
    title: String(s.title || ''),
  }))
  return sheets.filter((s) => s.sheetId && s.title)
}

export async function ensureSheet(title: string): Promise<EnsureSheetResult> {
  const spreadsheetToken = getSpreadsheetToken()
  if (!spreadsheetToken) throw new Error('Missing FEISHU_SPREADSHEET_TOKEN')

  const safeTitle = normalizeSheetTitle(title)
  const existing = await listSheets()
  const matched = existing.find((s) => s.title === safeTitle)
  if (matched) return { sheet: matched, isNew: false }

  const payload = await feishuRequest(`/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/sheets_batch_update`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          addSheet: {
            properties: { title: safeTitle },
          },
        },
      ],
    }),
  })

  const reply = (((payload.data as any)?.replies || [])[0] || {}) as any
  const added = (reply.addSheet?.properties || reply.addSheet || {}) as any
  const sheetId = String(added.sheetId || added.sheet_id || '')
  const finalTitle = String(added.title || safeTitle)
  if (!sheetId) {
    // Fall back to querying once more if response shape changes.
    const refreshed = await listSheets()
    const fallback = refreshed.find((s) => s.title === safeTitle)
    if (!fallback) throw new Error('Failed to create feishu sheet tab')
    return { sheet: fallback, isNew: true }
  }

  return {
    sheet: { sheetId, title: finalTitle },
    isNew: true,
  }
}

export async function getSpreadsheetUrl(sheetId?: string) {
  const spreadsheetToken = getSpreadsheetToken()
  if (!spreadsheetToken) throw new Error('Missing FEISHU_SPREADSHEET_TOKEN')

  const base = `https://sheet.feishu.cn/sheets/${spreadsheetToken}`
  return sheetId ? `${base}?sheet=${encodeURIComponent(sheetId)}` : base
}

