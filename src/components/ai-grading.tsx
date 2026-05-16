'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PenTool, Loader2, CheckCircle2, AlertCircle, Eye, Sparkles, ChevronDown, ChevronUp, RotateCcw, Send } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { useToast } from '@/hooks/use-toast'

/**
 * Smart text formatter that splits AI-generated feedback into individual points.
 * Handles formats like:
 * - Numbered lists: "1. xxx 2. xxx 3. xxx" or "1. xxx\n2. xxx"
 * - Semicolon-separated: "xxx；xxx；xxx"
 * - Bullet points: "• xxx • xxx" or "- xxx - xxx"
 */
function formatFeedbackText(text: string): string[] {
  if (!text) return []
  const trimmed = text.trim()
  if (!trimmed) return []

  // Check if text already has proper line breaks with multiple lines
  const lines = trimmed.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length > 1) {
    // Already has line breaks - just return each line
    return lines
  }

  // Single line or no meaningful breaks - try to split by patterns
  const singleLine = lines[0] || trimmed

  // Pattern 1: Numbered list like "1. xxx 2. xxx" or "1、xxx 2、xxx"
  // Split by number-dot or number-Chinese-dot patterns
  const numberedMatch = singleLine.match(/\d[.、．]\s/)
  if (numberedMatch) {
    // Split by numbered patterns, keeping the number prefix
    const parts = singleLine.split(/(?=\d[.、．]\s)/).map(s => s.trim()).filter(Boolean)
    if (parts.length > 1) return parts
  }

  // Pattern 2: Chinese semicolons separating points
  if (singleLine.includes('；')) {
    const parts = singleLine.split('；').map(s => s.trim()).filter(Boolean)
    if (parts.length > 1) return parts
  }

  // Pattern 3: Regular semicolons separating points
  if (singleLine.includes(';')) {
    const parts = singleLine.split(';').map(s => s.trim()).filter(Boolean)
    if (parts.length > 1) return parts
  }

  // Pattern 4: Bullet points with • or - (but not at the very start)
  const bulletMatch = singleLine.match(/[•·]\s/)
  if (bulletMatch) {
    const parts = singleLine.split(/[•·]\s/).map(s => s.trim()).filter(Boolean)
    if (parts.length > 1) return parts
  }

  // No splitting pattern found - return as single item
  return [singleLine]
}

/**
 * Renders formatted feedback text with each point on its own line
 */
function FormattedText({ text, className = '' }: { text: string; className?: string }) {
  const points = useMemo(() => formatFeedbackText(text), [text])

  if (points.length === 0) return null

  if (points.length === 1) {
    return <p className={`text-sm text-gray-600 ${className}`}>{points[0]}</p>
  }

  return (
    <ul className={`text-sm text-gray-600 space-y-1.5 ${className}`}>
      {points.map((point, i) => (
        <li key={i} className="flex gap-2">
          <span className="shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full bg-current opacity-40" />
          <span className="flex-1">{point}</span>
        </li>
      ))}
    </ul>
  )
}

interface Assignment {
  id: string
  title: string
  subject: string
  _count?: {
    criteria: number
    backgrounds: number
    submissions: number
  }
}

interface AssignmentDetail {
  id: string
  title: string
  subject: string
  description: string
  criteria: { id: string; criterion: string; maxScore: number }[]
  backgrounds: { id: string; category: string; content: string }[]
}

interface CriteriaScore {
  id: string
  criteriaId: string
  score: number
  criteria?: { criterion: string; maxScore: number }
}

interface GradingResult {
  id: string
  totalScore: number
  maxScore: number
  evaluation: string
  gradedAt: string
  scores: CriteriaScore[]
}

interface Submission {
  id: string
  studentName: string
  studentId: string
  content: string
  status: string
  submittedAt: string
  result?: GradingResult | null
}

export function AIGrading() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [gradingIds, setGradingIds] = useState<Set<string>>(new Set())
  const [batchGrading, setBatchGrading] = useState(false)
  const [pushingFeishu, setPushingFeishu] = useState(false)
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 })
  const [viewingResult, setViewingResult] = useState<GradingResult | null>(null)
  const [viewingStudent, setViewingStudent] = useState<string>('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [assignmentDetail, setAssignmentDetail] = useState<AssignmentDetail | null>(null)
  const { selectedAssignmentId, setSelectedAssignmentId, assignmentVersion } = useAppStore()
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
      toast({ title: '加载失败', variant: 'destructive' })
    }
  }, [selectedId, toast])

  useEffect(() => { fetchAssignments() }, [fetchAssignments])
  useEffect(() => { fetchAssignments() }, [assignmentVersion])
  useEffect(() => { if (selectedId) fetchSubmissions() }, [selectedId, assignmentVersion, fetchSubmissions])

  // Fetch assignment detail to check for grading standards
  useEffect(() => {
    if (!selectedId) {
      setAssignmentDetail(null)
      return
    }
    fetch(`/api/assignments/${selectedId}`)
      .then(res => res.json())
      .then(data => setAssignmentDetail(data))
      .catch(() => setAssignmentDetail(null))
  }, [selectedId, assignmentVersion])

  const handleGradeSingle = async (submissionId: string, studentName: string) => {
    setGradingIds(prev => new Set(prev).add(submissionId))
    try {
      const res = await fetch(`/api/grade/${submissionId}`, { method: 'POST' })
      if (res.ok) {
        const result = await res.json()
        toast({ title: '批改完成', description: `${studentName} 的作业已批改，得分：${result.totalScore}/${result.maxScore}` })
        fetchSubmissions()
      } else {
        const err = await res.json()
        toast({ title: '批改失败', description: err.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: '批改失败', variant: 'destructive' })
    } finally {
      setGradingIds(prev => {
        const next = new Set(prev)
        next.delete(submissionId)
        return next
      })
    }
  }

  const handleBatchGrade = async () => {
    if (!selectedId) return
    // Include both 'submitted' and any stuck 'grading' submissions
    const ungraded = submissions.filter(s => s.status === 'submitted' || s.status === 'grading')
    if (ungraded.length === 0) {
      toast({ title: '没有待批改的作业' })
      return
    }

    setBatchGrading(true)
    setBatchProgress({ current: 0, total: ungraded.length })

    let successCount = 0
    for (let i = 0; i < ungraded.length; i++) {
      const s = ungraded[i]
      setGradingIds(prev => new Set(prev).add(s.id))

      try {
        const res = await fetch(`/api/grade/${s.id}`, { method: 'POST' })
        if (res.ok) successCount++
      } catch {
        // continue with next
      }

      setGradingIds(prev => {
        const next = new Set(prev)
        next.delete(s.id)
        return next
      })
      setBatchProgress({ current: i + 1, total: ungraded.length })
    }

    setBatchGrading(false)
    fetchSubmissions()
    toast({ title: '批量批改完成', description: `成功批改 ${successCount}/${ungraded.length} 份作业` })
  }

  const handlePushToFeishu = async () => {
    if (!selectedId) return
    setPushingFeishu(true)
    try {
      const res = await fetch('/api/feishu/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId: selectedId }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast({
          title: '推送成功',
          description: data.message || '已推送到飞书表格',
        })
      } else {
        toast({
          title: '推送失败',
          description: data.message || '飞书推送失败，请检查配置',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: '推送失败',
        description: '网络错误，请稍后重试',
        variant: 'destructive',
      })
    } finally {
      setPushingFeishu(false)
    }
  }

  const handleViewResult = (result: GradingResult, studentName: string) => {
    setViewingResult(result)
    setViewingStudent(studentName)
  }

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const getScoreColor = (score: number, max: number) => {
    if (max === 0) return 'text-gray-600'
    const ratio = score / max
    if (ratio >= 0.9) return 'text-emerald-600'
    if (ratio >= 0.8) return 'text-green-600'
    if (ratio >= 0.7) return 'text-yellow-600'
    if (ratio >= 0.6) return 'text-orange-600'
    return 'text-red-600'
  }

  const getScoreBg = (score: number, max: number) => {
    if (max === 0) return 'bg-gray-50 border-gray-200'
    const ratio = score / max
    if (ratio >= 0.9) return 'bg-emerald-50 border-emerald-200'
    if (ratio >= 0.8) return 'bg-green-50 border-green-200'
    if (ratio >= 0.7) return 'bg-yellow-50 border-yellow-200'
    if (ratio >= 0.6) return 'bg-orange-50 border-orange-200'
    return 'bg-red-50 border-red-200'
  }

  if (loading) {
    return <div className="animate-pulse space-y-4"><div className="h-10 bg-gray-200 rounded" /><div className="h-40 bg-gray-200 rounded" /></div>
  }

  // Count ungraded: submitted + stuck grading
  const ungradedCount = submissions.filter(s => s.status === 'submitted' || s.status === 'grading').length
  const gradedCount = submissions.filter(s => s.status === 'graded').length

  // Check if the selected assignment has required grading standards
  const hasGradingStandards = assignmentDetail?.backgrounds.some(b => b.category === 'grading_standard') ?? true
  const hasCriteria = assignmentDetail ? assignmentDetail.criteria.length > 0 : true
  const canGrade = hasGradingStandards && hasCriteria

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">智能批改</h2>
        <p className="text-sm text-gray-500">AI驱动的作业评价与反馈</p>
      </div>



      {/* Assignment selector + batch grade */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 flex-wrap">
            <Select value={selectedId} onValueChange={(id) => { setSelectedId(id); setSelectedAssignmentId(id) }}>
              <SelectTrigger className="w-72">
                <SelectValue placeholder="请选择作业" />
              </SelectTrigger>
              <SelectContent>
                {assignments.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedId && (
              <div className="flex items-center gap-3 ml-auto">
                <div className="text-sm text-gray-500">
                  <span className="text-emerald-600 font-medium">{gradedCount}</span> 已批改 /
                  <span className="text-amber-600 font-medium ml-1">{ungradedCount}</span> 待批改
                </div>
                <Button
                  onClick={handleBatchGrade}
                  disabled={batchGrading || ungradedCount === 0 || !canGrade || pushingFeishu}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {batchGrading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      批改中 {batchProgress.current}/{batchProgress.total}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      一键批改 {ungradedCount > 0 ? `(${ungradedCount}份)` : ''}
                    </>
                  )}
                </Button>
                <Button
                  onClick={handlePushToFeishu}
                  disabled={batchGrading || pushingFeishu}
                  variant="outline"
                >
                  {pushingFeishu ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      推送中
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      推送到飞书
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
          {batchGrading && (
            <div className="mt-4">
              <Progress value={(batchProgress.current / batchProgress.total) * 100} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submissions List */}
      {selectedId && (
        <div className="space-y-3">
          {submissions.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <PenTool className="w-12 h-12 text-gray-300 mb-4" />
                <p className="text-gray-500">暂无提交的作业</p>
                <p className="text-sm text-gray-400 mt-1">请先在"作业上传"中提交学生作业</p>
              </CardContent>
            </Card>
          ) : (
            submissions.map(s => (
              <Card key={s.id} className={`transition-all ${s.status === 'graded' && s.result ? getScoreBg(s.result.totalScore, s.result.maxScore) : ''}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-4">
                    {/* Student info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{s.studentName}</span>
                        {s.studentId && <span className="text-xs text-gray-400">{s.studentId}</span>}
                        {s.status === 'graded' && s.result && (
                          <Badge className={`${getScoreColor(s.result.totalScore, s.result.maxScore)} bg-white`}>
                            {s.result.totalScore}/{s.result.maxScore}
                          </Badge>
                        )}
                        {s.status === 'submitted' && <Badge variant="secondary">待批改</Badge>}
                        {s.status === 'grading' && <Badge variant="outline" className="text-amber-600">批改中</Badge>}
                      </div>
                      {/* Show content preview */}
                      <p className="text-sm text-gray-500 mt-1 line-clamp-1">{s.content}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {(s.status === 'submitted' || s.status === 'grading') && (
                        <Button
                          size="sm"
                          onClick={() => handleGradeSingle(s.id, s.studentName)}
                          disabled={gradingIds.has(s.id) || batchGrading || !canGrade}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          {gradingIds.has(s.id) ? (
                            <><Loader2 className="w-3 h-3 mr-1 animate-spin" />批改中</>
                          ) : (
                            <><PenTool className="w-3 h-3 mr-1" />{s.status === 'grading' ? '重新批改' : '批改'}</>
                          )}
                        </Button>
                      )}
                      {s.status === 'graded' && s.result && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleExpand(s.id)}
                          >
                            {expandedIds.has(s.id) ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
                            {expandedIds.has(s.id) ? '收起' : '展开'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewResult(s.result!, s.studentName)}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            详情
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleGradeSingle(s.id, s.studentName)}
                            disabled={gradingIds.has(s.id) || batchGrading || !canGrade}
                            title="重新批改"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Expanded result preview */}
                  {expandedIds.has(s.id) && s.result && (
                    <div className="mt-4 pt-4 border-t">
                      {/* Criteria scores summary */}
                      {s.result.scores.length > 0 && (
                        <div className="mb-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                            {s.result.scores.map(cs => (
                              <div key={cs.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm">
                                <span className="text-gray-700 truncate mr-2">{cs.criteria?.criterion || '维度'}</span>
                                <span className={`font-medium ${getScoreColor(cs.score, cs.criteria?.maxScore || 100)}`}>
                                  {cs.score}/{cs.criteria?.maxScore || 100}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="space-y-3">
                        {s.result.evaluation && (
                          <div>
                            <p className="text-sm font-medium text-gray-700 mb-1.5">📋 总体评价</p>
                            <div className="bg-gray-50 p-3 rounded-lg">
                              <FormattedText text={s.result.evaluation} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Result Detail Dialog */}
      <Dialog open={!!viewingResult} onOpenChange={() => setViewingResult(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewingResult && (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  {viewingStudent} 的批改结果
                  <Badge className={`${getScoreColor(viewingResult.totalScore, viewingResult.maxScore)}`}>
                    {viewingResult.totalScore}/{viewingResult.maxScore}
                  </Badge>
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          {viewingResult && (
            <div className="space-y-4">
              {/* Score overview */}
              <div className="flex items-center justify-center p-6 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50">
                <div className="text-center">
                  <div className={`text-5xl font-bold ${getScoreColor(viewingResult.totalScore, viewingResult.maxScore)}`}>
                    {viewingResult.totalScore}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">满分 {viewingResult.maxScore}</div>
                </div>
              </div>

              {/* Criteria scores */}
              {viewingResult.scores.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">各维度得分</h4>
                  <div className="space-y-2">
                    {viewingResult.scores.map(cs => (
                      <div key={cs.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm font-medium min-w-[120px]">{cs.criteria?.criterion || '维度'}</span>
                        <div className="flex-1">
                          <Progress
                            value={(cs.score / (cs.criteria?.maxScore || 100)) * 100}
                            className="h-2"
                          />
                        </div>
                        <span className={`text-sm font-medium ${getScoreColor(cs.score, cs.criteria?.maxScore || 100)}`}>
                          {cs.score}/{cs.criteria?.maxScore || 100}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* Detailed feedback */}
              {viewingResult.evaluation && (
                <div>
                  <h4 className="font-medium text-emerald-700 mb-1.5">📋 总体评价</h4>
                  <div className="bg-emerald-50 p-3 rounded-lg">
                    <FormattedText text={viewingResult.evaluation} />
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {assignments.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AlertCircle className="w-12 h-12 text-gray-300 mb-4" />
            <p className="text-gray-500">请先在"作业管理"中创建作业</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
