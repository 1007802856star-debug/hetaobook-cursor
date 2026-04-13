'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { BarChart3, TrendingUp, Award, AlertTriangle, BarChart2, PieChart } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from 'recharts'
import { useAppStore } from '@/lib/store'
import { useToast } from '@/hooks/use-toast'
import type { StatisticsData } from '@/types'

interface Assignment {
  id: string
  title: string
  subject: string
}

export function StatisticsAnalysis() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [stats, setStats] = useState<StatisticsData | null>(null)
  const [results, setResults] = useState<Array<{
    id: string
    totalScore: number
    maxScore: number
    evaluation: string
    strengths: string
    weaknesses: string
    studentWork: { studentName: string; studentId: string }
    scores: Array<{ score: number; comment: string; criteria: { criterion: string; maxScore: number } }>
  }>>([])
  const [loading, setLoading] = useState(true)
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

  const fetchData = useCallback(async () => {
    if (!selectedId) return
    try {
      const [statsRes, resultsRes] = await Promise.all([
        fetch(`/api/assignments/${selectedId}/statistics`),
        fetch(`/api/assignments/${selectedId}/results`),
      ])
      const statsData = await statsRes.json()
      const resultsData = await resultsRes.json()
      setStats(statsData)
      setResults(resultsData)
    } catch {
      toast({ title: '加载统计数据失败', variant: 'destructive' })
    }
  }, [selectedId, toast])

  useEffect(() => { fetchAssignments() }, [fetchAssignments])
  useEffect(() => { fetchAssignments() }, [assignmentVersion])
  useEffect(() => { if (selectedId) fetchData() }, [selectedId, fetchData])

  if (loading) {
    return <div className="animate-pulse space-y-4"><div className="h-10 bg-gray-200 rounded" /><div className="h-60 bg-gray-200 rounded" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">统计分析</h2>
          <p className="text-sm text-gray-500">查看作业批改的聚合统计与分析</p>
        </div>
      </div>

      {/* Assignment selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
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
          </div>
        </CardContent>
      </Card>

      {selectedId && stats && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-emerald-600">平均分</p>
                    <p className="text-2xl font-bold text-emerald-900">{stats.averageScore}<span className="text-sm font-normal text-emerald-600">/{stats.totalMaxScore || 100}</span></p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
                    <Award className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-blue-600">最高分</p>
                    <p className="text-2xl font-bold text-blue-900">{stats.maxScore}<span className="text-sm font-normal text-blue-600">/{stats.totalMaxScore || 100}</span></p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center">
                    <BarChart2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-orange-600">最低分</p>
                    <p className="text-2xl font-bold text-orange-900">{stats.minScore}<span className="text-sm font-normal text-orange-600">/{stats.totalMaxScore || 100}</span></p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center">
                    <PieChart className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-purple-600">已批改</p>
                    <p className="text-2xl font-bold text-purple-900">{stats.gradedCount}/{stats.totalSubmissions}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-teal-50 to-teal-100 border-teal-200">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-teal-500 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-teal-600">满分</p>
                    <p className="text-2xl font-bold text-teal-900">{stats.totalMaxScore || 100}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Score distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-emerald-600" />
                  成绩分布
                </CardTitle>
                <CardDescription>各分数段的学生人数</CardDescription>
              </CardHeader>
              <CardContent>
                {stats.scoreDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={stats.scoreDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="range" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" name="人数" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-gray-400">暂无数据</div>
                )}
              </CardContent>
            </Card>

            {/* Criteria radar chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  各维度得分对比
                </CardTitle>
                <CardDescription>各评分维度的平均得分率</CardDescription>
              </CardHeader>
              <CardContent>
                {stats.criteriaAverages.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={stats.criteriaAverages.map(c => ({
                      name: c.name.length > 4 ? c.name.substring(0, 4) + '…' : c.name,
                      得分率: Math.round((c.average / c.maxScore) * 100),
                      满分: 100,
                    }))}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="name" />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} />
                      <Radar name="得分率" dataKey="得分率" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                      <Radar name="满分" dataKey="满分" stroke="#e5e7eb" fill="#e5e7eb" fillOpacity={0.1} />
                      <Legend />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-gray-400">暂无数据</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Common weaknesses & Top works */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Common weaknesses */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  常见问题
                </CardTitle>
                <CardDescription>从批改反馈中提取的共性问题</CardDescription>
              </CardHeader>
              <CardContent>
                {stats.commonWeaknesses.length > 0 ? (
                  <div className="space-y-3">
                    {stats.commonWeaknesses.map((w, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
                        <Badge variant="outline" className="shrink-0 text-amber-700 bg-amber-100">问题 {i + 1}</Badge>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{w}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-4">暂无数据</p>
                )}
              </CardContent>
            </Card>

            {/* Top works */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Award className="w-5 h-5 text-emerald-600" />
                  优秀作业
                </CardTitle>
                <CardDescription>得分最高的作业</CardDescription>
              </CardHeader>
              <CardContent>
                {stats.topWorks.length > 0 ? (
                  <div className="space-y-2">
                    {stats.topWorks.map((w, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          i === 0 ? 'bg-yellow-400 text-yellow-900' :
                          i === 1 ? 'bg-gray-300 text-gray-700' :
                          i === 2 ? 'bg-amber-600 text-amber-100' :
                          'bg-emerald-200 text-emerald-700'
                        }`}>
                          {i + 1}
                        </div>
                        <span className="font-medium flex-1">{w.studentName}</span>
                        <Badge className="bg-emerald-100 text-emerald-700">{w.score}/{w.maxScore || stats.totalMaxScore || 100}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-4">暂无数据</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Full results table */}
          {results.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">成绩明细</CardTitle>
                <CardDescription>所有学生的批改成绩</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>排名</TableHead>
                        <TableHead>学生</TableHead>
                        <TableHead>学号</TableHead>
                        <TableHead>总分</TableHead>
                        {results[0]?.scores.map((s, i) => (
                          <TableHead key={i}>{s.criteria?.criterion || `维度${i + 1}`}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results
                        .sort((a, b) => b.totalScore - a.totalScore)
                        .map((r, i) => (
                          <TableRow key={r.id}>
                            <TableCell>
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                i === 0 ? 'bg-yellow-400 text-yellow-900' :
                                i === 1 ? 'bg-gray-300 text-gray-700' :
                                i === 2 ? 'bg-amber-600 text-amber-100' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                {i + 1}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{r.studentWork.studentName}</TableCell>
                            <TableCell className="text-gray-400">{r.studentWork.studentId || '-'}</TableCell>
                            <TableCell>
                              <span className={`font-bold ${
                                r.maxScore > 0 && r.totalScore / r.maxScore >= 0.9 ? 'text-emerald-600' :
                                r.maxScore > 0 && r.totalScore / r.maxScore >= 0.7 ? 'text-yellow-600' :
                                'text-red-600'
                              }`}>
                                {r.totalScore}/{r.maxScore}
                              </span>
                            </TableCell>
                            {r.scores.map((s, j) => (
                              <TableCell key={j}>{s.score}/{s.criteria?.maxScore || '-'}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {stats.gradedCount === 0 && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <BarChart3 className="w-12 h-12 text-gray-300 mb-4" />
                <p className="text-gray-500">暂无批改数据</p>
                <p className="text-sm text-gray-400 mt-1">请先在"智能批改"中完成批改</p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {assignments.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BarChart3 className="w-12 h-12 text-gray-300 mb-4" />
            <p className="text-gray-500">请先在"作业管理"中创建作业</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
