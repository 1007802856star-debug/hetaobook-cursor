'use client'

import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BookOpen, Upload, PenTool, BarChart3, Cpu } from 'lucide-react'
import { AssignmentManager } from '@/components/assignment-manager'
import { WorkSubmission } from '@/components/work-submission'
import { AIGrading } from '@/components/ai-grading'
import { StatisticsAnalysis } from '@/components/statistics-analysis'
import { useAppStore } from '@/lib/store'

export default function Home() {
  const { activeTab, setActiveTab } = useAppStore()
  const [modelStatus, setModelStatus] = useState<{
    connected: boolean
    model: string
    error?: string
  } | null>(null)

  useEffect(() => {
    const checkModel = async () => {
      try {
        const res = await fetch('/api/model-status')
        const data = await res.json()
        setModelStatus(data)
      } catch {
        setModelStatus({ connected: false, model: '未连接' })
      }
    }
    checkModel()
    const interval = setInterval(checkModel, 60000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-200">
                <PenTool className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">智能作业批改系统</h1>
                <p className="text-sm text-gray-500">AI驱动的作业评价与反馈平台</p>
              </div>
            </div>
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                modelStatus?.connected
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                  : 'bg-gray-50 border-gray-200 text-gray-400'
              }`}
              title={
                modelStatus?.connected
                  ? undefined
                  : modelStatus?.error || '模型未就绪，请检查环境变量或网络'
              }
            >
              <Cpu className="w-3.5 h-3.5" />
              <span className="flex items-center gap-1.5">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                  modelStatus?.connected ? 'bg-emerald-500' : 'bg-gray-300'
                }`} />
                模型：{modelStatus?.model || '检测中...'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-white shadow-sm border rounded-xl p-1 h-auto">
            <TabsTrigger value="assignments" className="flex items-center gap-2 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-600 data-[state=active]:text-white rounded-lg transition-all">
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">作业管理</span>
              <span className="sm:hidden">管理</span>
            </TabsTrigger>
            <TabsTrigger value="submission" className="flex items-center gap-2 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-600 data-[state=active]:text-white rounded-lg transition-all">
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">作业上传</span>
              <span className="sm:hidden">上传</span>
            </TabsTrigger>
            <TabsTrigger value="grading" className="flex items-center gap-2 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-600 data-[state=active]:text-white rounded-lg transition-all">
              <PenTool className="w-4 h-4" />
              <span className="hidden sm:inline">智能批改</span>
              <span className="sm:hidden">批改</span>
            </TabsTrigger>
            <TabsTrigger value="statistics" className="flex items-center gap-2 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-600 data-[state=active]:text-white rounded-lg transition-all">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">统计分析</span>
              <span className="sm:hidden">统计</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="assignments" className="mt-6">
            <AssignmentManager />
          </TabsContent>

          <TabsContent value="submission" className="mt-6">
            <WorkSubmission />
          </TabsContent>

          <TabsContent value="grading" className="mt-6">
            <AIGrading />
          </TabsContent>

          <TabsContent value="statistics" className="mt-6">
            <StatisticsAnalysis />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
