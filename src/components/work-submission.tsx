'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { Upload, Plus, Trash2, FileText, Users } from 'lucide-react'
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
  status: string
  submittedAt: string
  result?: { totalScore: number } | null
}

export function WorkSubmission() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [submitMode, setSubmitMode] = useState<'single' | 'batch'>('single')
  const [singleForm, setSingleForm] = useState({ studentName: '', studentId: '', content: '' })
  const [batchText, setBatchText] = useState('')
  const { selectedAssignmentId, setSelectedAssignmentId } = useAppStore()
  const { toast } = useToast()

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
  useEffect(() => { if (selectedId) fetchSubmissions() }, [selectedId, fetchSubmissions])

  const handleSubmit = async () => {
    if (!selectedId) {
      toast({ title: '请先选择作业', variant: 'destructive' })
      return
    }

    try {
      let items = []

      if (submitMode === 'single') {
        if (!singleForm.studentName.trim() || !singleForm.content.trim()) {
          toast({ title: '请填写学生姓名和作业内容', variant: 'destructive' })
          return
        }
        items = [singleForm]
      } else {
        // Batch mode: parse text
        // Format: 学生姓名[|学号]: 作业内容 (separated by ---)
        const blocks = batchText.split(/---+/).map(b => b.trim()).filter(Boolean)
        for (const block of blocks) {
          const lines = block.split('\n')
          const firstLine = lines[0]
          const nameMatch = firstLine.match(/^(.+?)(?:[|｜](.*?))?:\s*(.*)$/)
          if (nameMatch) {
            items.push({
              studentName: nameMatch[1].trim(),
              studentId: nameMatch[2]?.trim() || '',
              content: (nameMatch[3] + '\n' + lines.slice(1).join('\n')).trim(),
            })
          } else {
            // Try simpler format: first line is name, rest is content
            items.push({
              studentName: firstLine.trim(),
              studentId: '',
              content: lines.slice(1).join('\n').trim(),
            })
          }
        }
      }

      if (items.length === 0) {
        toast({ title: '没有有效的提交内容', variant: 'destructive' })
        return
      }

      const res = await fetch(`/api/assignments/${selectedId}/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })

      if (res.ok) {
        const data = await res.json()
        toast({ title: '提交成功', description: `已提交 ${data.length} 份作业` })
        setSingleForm({ studentName: '', studentId: '', content: '' })
        setBatchText('')
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
          <p className="text-sm text-gray-500">选择作业并上传学生作品</p>
        </div>
      </div>

      {/* Assignment selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Label className="shrink-0">选择作业</Label>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Submission Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-600" />
                提交作业
              </CardTitle>
              <CardDescription>
                支持单份提交或批量提交
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={submitMode === 'single' ? 'default' : 'outline'}
                  onClick={() => setSubmitMode('single')}
                  className={submitMode === 'single' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                >
                  <FileText className="w-3 h-3 mr-1" />
                  单份提交
                </Button>
                <Button
                  size="sm"
                  variant={submitMode === 'batch' ? 'default' : 'outline'}
                  onClick={() => setSubmitMode('batch')}
                  className={submitMode === 'batch' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                >
                  <Users className="w-3 h-3 mr-1" />
                  批量提交
                </Button>
              </div>

              <Separator />

              {submitMode === 'single' ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-sm">学生姓名 *</Label>
                      <Input
                        placeholder="张三"
                        value={singleForm.studentName}
                        onChange={e => setSingleForm({ ...singleForm, studentName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm">学号</Label>
                      <Input
                        placeholder="2024001"
                        value={singleForm.studentId}
                        onChange={e => setSingleForm({ ...singleForm, studentId: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">作业内容 *</Label>
                    <Textarea
                      placeholder="粘贴或输入学生的作业内容..."
                      value={singleForm.content}
                      onChange={e => setSingleForm({ ...singleForm, content: e.target.value })}
                      rows={8}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-sm">批量提交内容</Label>
                    <Textarea
                      placeholder={`格式说明：每位学生的内容用 "---" 分隔\n\n示例：\n张三|2024001: 这是张三的作业内容...\n可以多行\n\n---\n\n李四|2024002: 这是李四的作业内容...`}
                      value={batchText}
                      onChange={e => setBatchText(e.target.value)}
                      rows={12}
                    />
                  </div>
                  <p className="text-xs text-gray-400">
                    每位学生用 "---" 分隔，格式：姓名|学号: 内容
                  </p>
                </div>
              )}

              <Button onClick={handleSubmit} className="w-full bg-emerald-600 hover:bg-emerald-700">
                <Plus className="w-4 h-4 mr-2" />
                {submitMode === 'single' ? '提交作业' : '批量提交'}
              </Button>
            </CardContent>
          </Card>

          {/* Submissions List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">已提交作业</CardTitle>
              <CardDescription>共 {submissions.length} 份提交</CardDescription>
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
                        <TableHead>学生</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>分数</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {submissions.map(s => (
                        <TableRow key={s.id}>
                          <TableCell>
                            <div>
                              <span className="font-medium">{s.studentName}</span>
                              {s.studentId && <span className="text-xs text-gray-400 ml-1">{s.studentId}</span>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusMap[s.status]?.variant || 'secondary'}>
                              {statusMap[s.status]?.label || s.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {s.result ? `${s.result.totalScore}` : '-'}
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
