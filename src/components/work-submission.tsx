'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Upload, Plus, Trash2, FileText, FileSpreadsheet, X, ChevronDown, Link2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { useToast } from '@/hooks/use-toast'

interface Assignment {
  id: string
  title: string
  subject: string
}

interface Submission {
  id: string
  studentName: string
  studentId: string
  content: string
  filePath: string
  fileType: string
  status: string
  submittedAt: string
  result?: { totalScore: number; maxScore: number } | null
}

interface CustomField {
  id: string
  name: string
  placeholder: string
}

interface ExcelPreview {
  headers: string[]
  rows: Record<string, string>[]
  totalRows: number
  fileName: string
}

const DEFAULT_FIELDS: CustomField[] = [
  { id: 'studentName', name: '姓名', placeholder: '提交人姓名' },
  { id: 'studentId', name: '学号', placeholder: '如：2024001' },
]

export function WorkSubmission() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const { selectedAssignmentId, setSelectedAssignmentId, assignmentVersion } = useAppStore()
  const { toast } = useToast()

  // Custom fields
  const [customFields, setCustomFields] = useState<CustomField[]>(DEFAULT_FIELDS)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [showAddField, setShowAddField] = useState(false)
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldPlaceholder, setNewFieldPlaceholder] = useState('')

  // File upload
  const [uploadMode, setUploadMode] = useState<'file' | 'text'>('file')
  const [textContent, setTextContent] = useState('')
  const [uploading, setUploading] = useState(false)
  const [excelPreview, setExcelPreview] = useState<ExcelPreview | null>(null)
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})
  const [showMappingDialog, setShowMappingDialog] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const fetchAssignments = useCallback(async () => {
    try {
      const res = await fetch('/api/assignments')
      const data = await res.json()
      setAssignments(data)
      if (selectedAssignmentId && !selectedId) {
        setSelectedId(selectedAssignmentId)
      } else if (data.length > 0 && !selectedId) {
        setSelectedId(data[0].id)
      }
    } catch {
      toast({ title: '加载失败', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [selectedAssignmentId, selectedId, toast])

  const fetchSubmissions = useCallback(async () => {
    if (!selectedId) return
    try {
      const res = await fetch(`/api/assignments/${selectedId}/submissions`)
      const data = await res.json()
      setSubmissions(data)
    } catch {
      toast({ title: '加载提交列表失败', variant: 'destructive' })
    }
  }, [selectedId, toast])

  useEffect(() => { fetchAssignments() }, [fetchAssignments])
  useEffect(() => { fetchAssignments() }, [assignmentVersion])
  useEffect(() => { if (selectedId) fetchSubmissions() }, [selectedId, fetchSubmissions])

  // Custom field management
  const handleAddField = () => {
    if (!newFieldName.trim()) {
      toast({ title: '请输入字段名称', variant: 'destructive' })
      return
    }
    const id = `custom_${Date.now()}`
    setCustomFields(prev => [...prev, { id, name: newFieldName.trim(), placeholder: newFieldPlaceholder.trim() || newFieldName.trim() }])
    setNewFieldName('')
    setNewFieldPlaceholder('')
    setShowAddField(false)
  }

  const handleRemoveField = (id: string) => {
    if (id === 'studentName') return // Can't remove studentName
    setCustomFields(prev => prev.filter(f => f.id !== id))
    setFieldValues(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  // File upload handling
  const handleFileUpload = async (files: FileList | File[]) => {
    if (!selectedId) {
      toast({ title: '请先选择作业', variant: 'destructive' })
      return
    }

    const file = files[0]
    if (!file) return

    // Check file type
    const validTypes = ['.xlsx', '.xls', '.csv', '.txt', '.docx', '.pdf']
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
    if (!validTypes.includes(ext)) {
      toast({ title: '不支持的文件格式', description: '请上传 Excel、CSV、Word、PDF 或文本文件', variant: 'destructive' })
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        if (data.headers && data.headers.length > 0 && data.rows && data.rows.length > 0) {
          // Excel/CSV with structured data - show mapping dialog
          setExcelPreview(data)
          // Auto map: try to match common field names
          const autoMapping: Record<string, string> = {}
          for (const header of data.headers) {
            const lower = header.toLowerCase()
            if (lower.includes('姓名') || lower.includes('name') || lower === '名字') {
              autoMapping[header] = 'studentName'
            } else if (lower.includes('学号') || lower.includes('id') || lower === '编号') {
              autoMapping[header] = 'studentId'
            }
          }
          // Map remaining headers to custom fields or create new ones
          for (const header of data.headers) {
            if (!autoMapping[header]) {
              const matchedField = customFields.find(f =>
                f.name.toLowerCase() === header.toLowerCase() ||
                header.includes(f.name)
              )
              if (matchedField) {
                autoMapping[header] = matchedField.id
              }
            }
          }
          setColumnMapping(autoMapping)
          setShowMappingDialog(true)
        } else {
          // Text or other file - use content directly
          toast({ title: '文件已上传', description: '文件内容已读取' })
        }
      } else {
        const err = await res.json()
        toast({ title: '上传失败', description: err.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: '上传失败', variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  // Handle column mapping confirmation - submit data from Excel
  const handleMappingConfirm = async () => {
    if (!excelPreview || !selectedId) return

    // Create any new custom fields from unmapped columns
    const newFields: CustomField[] = []
    for (const header of excelPreview.headers) {
      const mappedTo = columnMapping[header]
      if (mappedTo && mappedTo.startsWith('new_')) {
        newFields.push({ id: mappedTo, name: header, placeholder: header })
      }
    }
    if (newFields.length > 0) {
      setCustomFields(prev => [...prev, ...newFields])
    }

    // Build submission items from mapped data
    const items: Array<Record<string, string>> = []
    for (const row of excelPreview.rows) {
      const item: Record<string, string> = {}
      for (const header of excelPreview.headers) {
        const mappedTo = columnMapping[header]
        if (mappedTo && mappedTo !== 'none') {
          item[mappedTo] = row[header] || ''
        }
      }
      // studentName is required
      if (item.studentName?.trim()) {
        // Build content from unmapped columns
        const contentParts: string[] = []
        for (const header of excelPreview.headers) {
          const mappedTo = columnMapping[header]
          if (!mappedTo || mappedTo === 'none' || mappedTo === 'new_content') {
            if (row[header]?.trim()) {
              contentParts.push(`${header}: ${row[header]}`)
            }
          }
        }
        item.content = contentParts.join('\n')
        items.push(item)
      }
    }

    if (items.length === 0) {
      toast({ title: '没有有效的数据行', description: '请检查列映射是否正确', variant: 'destructive' })
      return
    }

    try {
      const res = await fetch(`/api/assignments/${selectedId}/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      if (res.ok) {
        const data = await res.json()
        toast({ title: '导入成功', description: `已导入 ${data.length} 份作业` })
        setShowMappingDialog(false)
        setExcelPreview(null)
        setColumnMapping({})
        fetchSubmissions()
      } else {
        const err = await res.json()
        toast({ title: '导入失败', description: err.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: '导入失败', variant: 'destructive' })
    }
  }

  // Manual submit (text mode)
  const handleManualSubmit = async () => {
    if (!selectedId) {
      toast({ title: '请先选择作业', variant: 'destructive' })
      return
    }
    if (!fieldValues.studentName?.trim() || !textContent.trim()) {
      toast({ title: '请填写姓名和作业内容', variant: 'destructive' })
      return
    }

    const item: Record<string, string> = {
      ...fieldValues,
      content: textContent,
    }

    try {
      const res = await fetch(`/api/assignments/${selectedId}/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [item] }),
      })
      if (res.ok) {
        toast({ title: '提交成功' })
        setFieldValues({})
        setTextContent('')
        fetchSubmissions()
      } else {
        const err = await res.json()
        toast({ title: '提交失败', description: err.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: '提交失败', variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此提交？')) return
    try {
      const res = await fetch(`/api/submissions/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setSubmissions(prev => prev.filter(s => s.id !== id))
        toast({ title: '已删除' })
      }
    } catch {
      toast({ title: '删除失败', variant: 'destructive' })
    }
  }

  const handleSelectAssignment = (id: string) => {
    setSelectedId(id)
    setSelectedAssignmentId(id)
  }

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files)
    }
  }

  const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    submitted: { label: '待批改', variant: 'secondary' },
    grading: { label: '批改中', variant: 'outline' },
    graded: { label: '已批改', variant: 'default' },
  }

  if (loading) {
    return <div className="animate-pulse space-y-4"><div className="h-10 bg-gray-200 rounded" /><div className="h-40 bg-gray-200 rounded" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">作业上传</h2>
          <p className="text-sm text-gray-500">选择作业，配置字段，上传文件或手动提交</p>
        </div>
      </div>

      {/* Assignment selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Label className="shrink-0 font-medium">选择作业</Label>
            <Select value={selectedId} onValueChange={handleSelectAssignment}>
              <SelectTrigger className="w-72">
                <SelectValue placeholder="请选择作业" />
              </SelectTrigger>
              <SelectContent>
                {assignments.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.title} {a.subject ? `(${a.subject})` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedId && (
        <div className="space-y-6">
          {/* Submission Form Area */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-600" />
                提交管理
              </CardTitle>
              <CardDescription>
                配置字段信息，上传文件或手动录入作业
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Custom Fields Section */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-gray-700">提交人信息</Label>
                <div className="flex flex-wrap gap-3 items-end">
                  {customFields.map(field => (
                    <div key={field.id} className="flex items-center gap-1.5 group">
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-500 flex items-center gap-1">
                          {field.name}
                          {field.id !== 'studentName' && (
                            <button
                              onClick={() => handleRemoveField(field.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </Label>
                        <Input
                          placeholder={field.placeholder}
                          value={fieldValues[field.id] || ''}
                          onChange={e => setFieldValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                          className="w-40"
                        />
                      </div>
                    </div>
                  ))}

                  {/* Add Field Button */}
                  {showAddField ? (
                    <div className="flex items-end gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-500">字段名称</Label>
                        <Input
                          placeholder="如：班级"
                          value={newFieldName}
                          onChange={e => setNewFieldName(e.target.value)}
                          className="w-28"
                          autoFocus
                          onKeyDown={e => { if (e.key === 'Enter') handleAddField() }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-500">提示文字</Label>
                        <Input
                          placeholder="如：如：高三1班"
                          value={newFieldPlaceholder}
                          onChange={e => setNewFieldPlaceholder(e.target.value)}
                          className="w-36"
                        />
                      </div>
                      <Button size="sm" onClick={handleAddField} className="bg-emerald-600 hover:bg-emerald-700 h-9">
                        确定
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setShowAddField(false); setNewFieldName(''); setNewFieldPlaceholder('') }} className="h-9">
                        取消
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowAddField(true)}
                      className="h-9 border-dashed text-emerald-600 hover:text-emerald-700 hover:border-emerald-300"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      添加字段
                    </Button>
                  )}
                </div>
              </div>

              <Separator />

              {/* Upload Mode Toggle */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={uploadMode === 'file' ? 'default' : 'outline'}
                  onClick={() => setUploadMode('file')}
                  className={uploadMode === 'file' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                >
                  <FileSpreadsheet className="w-3 h-3 mr-1" />
                  上传文件
                </Button>
                <Button
                  size="sm"
                  variant={uploadMode === 'text' ? 'default' : 'outline'}
                  onClick={() => setUploadMode('text')}
                  className={uploadMode === 'text' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                >
                  <FileText className="w-3 h-3 mr-1" />
                  手动录入
                </Button>
              </div>

              {/* File Upload Area */}
              {uploadMode === 'file' && (
                <div className="space-y-3">
                  <div
                    className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                      isDragging
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-gray-300 hover:border-emerald-400 hover:bg-gray-50'
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept=".xlsx,.xls,.csv,.txt,.docx,.pdf"
                      onChange={e => e.target.files && handleFileUpload(e.target.files)}
                    />
                    {uploading ? (
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                        <p className="text-sm text-gray-600">正在解析文件...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                          <Upload className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">拖拽文件到此处，或点击上传</p>
                          <p className="text-xs text-gray-400 mt-1">
                            支持 Excel (.xlsx/.xls)、CSV、Word、PDF、文本文件，可多选
                          </p>
                        </div>
                        <Button size="sm" variant="outline" className="mt-2" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}>
                          <FileSpreadsheet className="w-3 h-3 mr-1" />
                          上传文件
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Excel Preview */}
                  {excelPreview && !showMappingDialog && (
                    <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm font-medium text-emerald-700">
                          {excelPreview.fileName} — 识别到 {excelPreview.totalRows} 行数据，{excelPreview.headers.length} 列
                        </span>
                      </div>
                      <div className="flex gap-2 text-xs text-emerald-600">
                        <span>列：{excelPreview.headers.join('、')}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Text Input Area */}
              {uploadMode === 'text' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-sm">作业内容 *</Label>
                    <Textarea
                      placeholder="粘贴或输入学生的作业内容..."
                      value={textContent}
                      onChange={e => setTextContent(e.target.value)}
                      rows={8}
                    />
                  </div>
                  <Button onClick={handleManualSubmit} className="bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="w-4 h-4 mr-2" />
                    提交作业
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Submissions Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">已提交作业</CardTitle>
                  <CardDescription>共 {submissions.length} 份提交</CardDescription>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                    待批改 {submissions.filter(s => s.status === 'submitted').length}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    已批改 {submissions.filter(s => s.status === 'graded').length}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {submissions.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">暂无提交</p>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>姓名</TableHead>
                        <TableHead>学号</TableHead>
                        <TableHead>文件</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>分数</TableHead>
                        <TableHead>时间</TableHead>
                        <TableHead className="w-10">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {submissions.map(s => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{s.studentName}</TableCell>
                          <TableCell className="text-gray-400 text-sm">{s.studentId || '-'}</TableCell>
                          <TableCell>
                            {s.filePath ? (
                              <Badge variant="outline" className="text-xs gap-1">
                                <FileSpreadsheet className="w-3 h-3" />
                                {s.filePath.split('_').pop()?.substring(0, 15) || '文件'}
                              </Badge>
                            ) : (
                              <span className="text-xs text-gray-400">文本输入</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusMap[s.status]?.variant || 'secondary'}>
                              {statusMap[s.status]?.label || s.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {s.result ? (
                              <span className={`font-medium ${s.result.totalScore / s.result.maxScore >= 0.8 ? 'text-emerald-600' : s.result.totalScore / s.result.maxScore >= 0.6 ? 'text-yellow-600' : 'text-red-600'}`}>
                                {s.result.totalScore}
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-xs text-gray-400">
                            {new Date(s.submittedAt).toLocaleDateString('zh-CN')}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
                              onClick={() => handleDelete(s.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Column Mapping Dialog */}
      <Dialog open={showMappingDialog} onOpenChange={setShowMappingDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-emerald-600" />
              列映射配置
            </DialogTitle>
            <p className="text-sm text-gray-500 mt-1">
              将 Excel 中的列映射到系统字段，未映射的列将合并为作业内容
            </p>
          </DialogHeader>

          {excelPreview && (
            <div className="space-y-4">
              {/* File info */}
              <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-lg">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span className="text-sm text-emerald-700 font-medium">{excelPreview.fileName}</span>
                <span className="text-xs text-emerald-600">{excelPreview.totalRows} 行 × {excelPreview.headers.length} 列</span>
              </div>

              {/* Mapping table */}
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead>Excel 列名</TableHead>
                      <TableHead>示例数据</TableHead>
                      <TableHead>映射到系统字段</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {excelPreview.headers.map(header => {
                      const sampleData = excelPreview.rows.slice(0, 2).map(r => r[header]).filter(Boolean).join('、')
                      return (
                        <TableRow key={header}>
                          <TableCell className="font-medium">{header}</TableCell>
                          <TableCell className="text-sm text-gray-500 max-w-[200px] truncate">{sampleData || '-'}</TableCell>
                          <TableCell>
                            <Select
                              value={columnMapping[header] || 'none'}
                              onValueChange={val => setColumnMapping(prev => ({ ...prev, [header]: val }))}
                            >
                              <SelectTrigger className="w-44">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">不映射（作为内容）</SelectItem>
                                {customFields.map(f => (
                                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                                ))}
                                <SelectItem value={`new_${header}`}>新建字段: {header}</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Preview first few rows */}
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">数据预览（前3行）</Label>
                <div className="border rounded-lg overflow-x-auto max-h-40">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {excelPreview.headers.map(h => (
                          <TableHead key={h} className="text-xs whitespace-nowrap">{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {excelPreview.rows.slice(0, 3).map((row, i) => (
                        <TableRow key={i}>
                          {excelPreview.headers.map(h => (
                            <TableCell key={h} className="text-xs whitespace-nowrap max-w-[150px] truncate">{row[h]}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => { setShowMappingDialog(false); setExcelPreview(null) }}>
                  取消
                </Button>
                <Button onClick={handleMappingConfirm} className="bg-emerald-600 hover:bg-emerald-700">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  确认导入 {excelPreview.totalRows} 行数据
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {assignments.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Upload className="w-12 h-12 text-gray-300 mb-4" />
            <p className="text-gray-500">请先在"作业管理"中创建作业</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
