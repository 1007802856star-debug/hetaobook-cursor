'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Plus, Pencil, Trash2, BookOpen, ChevronRight, GripVertical, X } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { useToast } from '@/hooks/use-toast'

interface Assignment {
  id: string
  title: string
  description: string
  subject: string
  createdAt: string
  updatedAt: string
  _count?: {
    criteria: number
    backgrounds: number
    submissions: number
  }
}

interface Criteria {
  id: string
  criterion: string
  description: string
  weight: number
  maxScore: number
  order: number
}

interface Background {
  id: string
  content: string
  source: string
  order: number
}

interface AssignmentDetail extends Assignment {
  criteria: Criteria[]
  backgrounds: Background[]
}

export function AssignmentManager() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<AssignmentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [newAssignment, setNewAssignment] = useState({ title: '', description: '', subject: '' })
  const [newCriteria, setNewCriteria] = useState({ criterion: '', description: '', weight: 1, maxScore: 100 })
  const [newBackground, setNewBackground] = useState({ content: '', source: '' })
  const { setSelectedAssignmentId } = useAppStore()
  const { toast } = useToast()

  const fetchAssignments = useCallback(async () => {
    try {
      const res = await fetch('/api/assignments')
      const data = await res.json()
      setAssignments(data)
    } catch {
      toast({ title: '加载失败', description: '无法获取作业列表', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const fetchDetail = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/assignments/${id}`)
      const data = await res.json()
      setDetail(data)
    } catch {
      toast({ title: '加载失败', description: '无法获取作业详情', variant: 'destructive' })
    }
  }, [toast])

  useEffect(() => { fetchAssignments() }, [fetchAssignments])

  useEffect(() => {
    if (selectedId) fetchDetail(selectedId)
  }, [selectedId, fetchDetail])

  const handleCreate = async () => {
    if (!newAssignment.title.trim()) {
      toast({ title: '请输入标题', variant: 'destructive' })
      return
    }
    try {
      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAssignment),
      })
      if (res.ok) {
        const data = await res.json()
        setAssignments(prev => [data, ...prev])
        setShowCreateDialog(false)
        setNewAssignment({ title: '', description: '', subject: '' })
        toast({ title: '创建成功', description: '作业已创建' })
        setSelectedId(data.id)
        setSelectedAssignmentId(data.id)
      }
    } catch {
      toast({ title: '创建失败', variant: 'destructive' })
    }
  }

  const handleUpdate = async () => {
    if (!detail) return
    try {
      const res = await fetch(`/api/assignments/${detail.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: detail.title,
          description: detail.description,
          subject: detail.subject,
        }),
      })
      if (res.ok) {
        setEditMode(false)
        fetchAssignments()
        toast({ title: '更新成功' })
      }
    } catch {
      toast({ title: '更新失败', variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此作业？所有相关的评分要求和提交记录都将被删除。')) return
    try {
      const res = await fetch(`/api/assignments/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setAssignments(prev => prev.filter(a => a.id !== id))
        if (selectedId === id) {
          setSelectedId(null)
          setDetail(null)
          setSelectedAssignmentId(null)
        }
        toast({ title: '删除成功' })
      }
    } catch {
      toast({ title: '删除失败', variant: 'destructive' })
    }
  }

  const handleAddCriteria = async () => {
    if (!detail || !newCriteria.criterion.trim()) {
      toast({ title: '请输入评分维度名称', variant: 'destructive' })
      return
    }
    try {
      const res = await fetch(`/api/assignments/${detail.id}/criteria`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newCriteria, order: detail.criteria.length }),
      })
      if (res.ok) {
        setNewCriteria({ criterion: '', description: '', weight: 1, maxScore: 100 })
        fetchDetail(detail.id)
        toast({ title: '评分维度已添加' })
      }
    } catch {
      toast({ title: '添加失败', variant: 'destructive' })
    }
  }

  const handleDeleteCriteria = async (criteriaId: string) => {
    if (!detail) return
    try {
      const res = await fetch(`/api/criteria/${criteriaId}`, { method: 'DELETE' })
      if (res.ok) {
        fetchDetail(detail.id)
        toast({ title: '评分维度已删除' })
      }
    } catch {
      toast({ title: '删除失败', variant: 'destructive' })
    }
  }

  const handleAddBackground = async () => {
    if (!detail || !newBackground.content.trim()) {
      toast({ title: '请输入背景知识内容', variant: 'destructive' })
      return
    }
    try {
      const res = await fetch(`/api/assignments/${detail.id}/backgrounds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newBackground, order: detail.backgrounds.length }),
      })
      if (res.ok) {
        setNewBackground({ content: '', source: '' })
        fetchDetail(detail.id)
        toast({ title: '背景知识已添加' })
      }
    } catch {
      toast({ title: '添加失败', variant: 'destructive' })
    }
  }

  const handleDeleteBackground = async (bgId: string) => {
    if (!detail) return
    try {
      const res = await fetch(`/api/backgrounds/${bgId}`, { method: 'DELETE' })
      if (res.ok) {
        fetchDetail(detail.id)
        toast({ title: '背景知识已删除' })
      }
    } catch {
      toast({ title: '删除失败', variant: 'destructive' })
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // Detail view
  if (detail) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedId(null); setDetail(null); setSelectedAssignmentId(null) }}>
            <ChevronRight className="w-4 h-4 rotate-180" />
            返回列表
          </Button>
        </div>

        {/* Assignment Info Card */}
        <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {editMode ? (
                  <div className="space-y-3">
                    <Input
                      value={detail.title}
                      onChange={e => setDetail({ ...detail, title: e.target.value })}
                      placeholder="作业标题"
                      className="text-lg font-semibold"
                    />
                    <Input
                      value={detail.subject}
                      onChange={e => setDetail({ ...detail, subject: e.target.value })}
                      placeholder="科目"
                    />
                    <Textarea
                      value={detail.description}
                      onChange={e => setDetail({ ...detail, description: e.target.value })}
                      placeholder="作业描述"
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleUpdate} className="bg-emerald-600 hover:bg-emerald-700">保存</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditMode(false)}>取消</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <CardTitle className="text-xl text-emerald-900">{detail.title}</CardTitle>
                    <CardDescription className="mt-1">
                      {detail.subject && <Badge variant="secondary" className="mr-2">{detail.subject}</Badge>}
                      {detail.description || '暂无描述'}
                    </CardDescription>
                  </>
                )}
              </div>
              {!editMode && (
                <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
                  <Pencil className="w-3 h-3 mr-1" />
                  编辑
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 text-sm text-gray-600">
              <span>评分维度: {detail.criteria.length}</span>
              <span>背景知识: {detail.backgrounds.length}</span>
              <span>提交数: {detail.submissions?.length || 0}</span>
            </div>
          </CardContent>
        </Card>

        {/* Criteria & Background */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Grading Criteria */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-amber-100 flex items-center justify-center">
                  <span className="text-amber-700 text-xs font-bold">评</span>
                </div>
                批改要求
              </CardTitle>
              <CardDescription>设定评分维度、权重和满分</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {detail.criteria.length > 0 && (
                <div className="space-y-2">
                  {detail.criteria.map(c => (
                    <div key={c.id} className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg border">
                      <GripVertical className="w-4 h-4 text-gray-400 mt-1 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{c.criterion}</span>
                          <Badge variant="outline" className="text-xs">权重 {c.weight}</Badge>
                          <Badge variant="outline" className="text-xs">满分 {c.maxScore}</Badge>
                        </div>
                        {c.description && <p className="text-xs text-gray-500 mt-1">{c.description}</p>}
                      </div>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-red-500" onClick={() => handleDeleteCriteria(c.id)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Separator />

              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700">添加评分维度</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="维度名称（如：内容完整性）"
                    value={newCriteria.criterion}
                    onChange={e => setNewCriteria({ ...newCriteria, criterion: e.target.value })}
                  />
                  <Input
                    placeholder="满分"
                    type="number"
                    value={newCriteria.maxScore}
                    onChange={e => setNewCriteria({ ...newCriteria, maxScore: Number(e.target.value) })}
                  />
                </div>
                <Input
                  placeholder="维度描述（选填）"
                  value={newCriteria.description}
                  onChange={e => setNewCriteria({ ...newCriteria, description: e.target.value })}
                />
                <div className="flex items-center gap-2">
                  <Label className="text-sm shrink-0">权重</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={newCriteria.weight}
                    onChange={e => setNewCriteria({ ...newCriteria, weight: Number(e.target.value) })}
                    className="w-24"
                  />
                  <Button size="sm" onClick={handleAddCriteria} className="bg-emerald-600 hover:bg-emerald-700 ml-auto">
                    <Plus className="w-3 h-3 mr-1" />
                    添加
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Background Knowledge */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center">
                  <span className="text-blue-700 text-xs font-bold">知</span>
                </div>
                背景知识
              </CardTitle>
              <CardDescription>提供批改所需的参考知识</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {detail.backgrounds.length > 0 && (
                <div className="space-y-2">
                  {detail.backgrounds.map(bg => (
                    <div key={bg.id} className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg border">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm whitespace-pre-wrap">{bg.content}</p>
                        {bg.source && <p className="text-xs text-gray-400 mt-1">来源: {bg.source}</p>}
                      </div>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-red-500" onClick={() => handleDeleteBackground(bg.id)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Separator />

              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700">添加背景知识</p>
                <Textarea
                  placeholder="输入背景知识内容，如参考答案、评分标准、知识点说明等"
                  value={newBackground.content}
                  onChange={e => setNewBackground({ ...newBackground, content: e.target.value })}
                  rows={4}
                />
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="来源（选填）"
                    value={newBackground.source}
                    onChange={e => setNewBackground({ ...newBackground, source: e.target.value })}
                    className="flex-1"
                  />
                  <Button size="sm" onClick={handleAddBackground} className="bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="w-3 h-3 mr-1" />
                    添加
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // List view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">作业列表</h2>
          <p className="text-sm text-gray-500">创建和管理作业、批改要求与背景知识</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-2" />
              新建作业
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>创建新作业</DialogTitle>
              <DialogDescription>填写作业基本信息，创建后可添加评分维度和背景知识</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>作业标题 *</Label>
                <Input
                  placeholder="如：第三章课后练习"
                  value={newAssignment.title}
                  onChange={e => setNewAssignment({ ...newAssignment, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>科目</Label>
                <Input
                  placeholder="如：高等数学"
                  value={newAssignment.subject}
                  onChange={e => setNewAssignment({ ...newAssignment, subject: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>描述</Label>
                <Textarea
                  placeholder="作业的详细说明"
                  value={newAssignment.description}
                  onChange={e => setNewAssignment({ ...newAssignment, description: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>取消</Button>
              <Button onClick={handleCreate} className="bg-emerald-600 hover:bg-emerald-700">创建</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {assignments.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BookOpen className="w-12 h-12 text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">还没有创建作业</p>
            <p className="text-gray-400 text-sm mt-1">点击上方"新建作业"开始</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assignments.map(a => (
            <Card
              key={a.id}
              className="cursor-pointer hover:shadow-md hover:border-emerald-300 transition-all group"
              onClick={() => { setSelectedId(a.id); setSelectedAssignmentId(a.id) }}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base group-hover:text-emerald-700 transition-colors">{a.title}</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all"
                    onClick={(e) => { e.stopPropagation(); handleDelete(a.id) }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                {a.subject && <Badge variant="secondary" className="w-fit text-xs">{a.subject}</Badge>}
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500 line-clamp-2">{a.description || '暂无描述'}</p>
                <div className="flex gap-3 mt-3 text-xs text-gray-400">
                  <span>{a._count?.criteria || 0} 评分维度</span>
                  <span>{a._count?.backgrounds || 0} 背景知识</span>
                  <span>{a._count?.submissions || 0} 份提交</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
