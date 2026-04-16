import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Get all graded submissions for this assignment
    const results = await db.gradingResult.findMany({
      where: {
        studentWork: { assignmentId: id }
      },
      include: {
        studentWork: {
          select: { studentName: true, studentId: true }
        },
        scores: {
          include: {
            criteria: { select: { criterion: true, maxScore: true } }
          }
        }
      }
    })

    const submissions = await db.studentWork.findMany({
      where: { assignmentId: id }
    })

    // Get the assignment's criteria to calculate total maxScore
    const assignment = await db.assignment.findUnique({
      where: { id },
      include: { criteria: true }
    })

    if (results.length === 0) {
      return NextResponse.json({
        totalSubmissions: submissions.length,
        gradedCount: 0,
        averageScore: 0,
        maxScore: 0,
        minScore: 0,
        totalMaxScore: assignment?.criteria.reduce((sum, c) => sum + c.maxScore, 0) || 100,
        scoreDistribution: [],
        criteriaAverages: [],
        commonWeaknesses: [],
        topWorks: [],
      })
    }

    // Calculate statistics
    const scores = results.map(r => r.totalScore)
    const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length
    const maxScore = Math.max(...scores)
    const minScore = Math.min(...scores)

    // Calculate total max score from criteria (or use the maxScore from the first result as fallback)
    const totalMaxScore = assignment?.criteria.reduce((sum, c) => sum + c.maxScore, 0)
      || results[0]?.maxScore
      || 100

    // Score distribution - dynamic ranges based on totalMaxScore
    const scoreDistribution = generateScoreDistribution(scores, totalMaxScore)

    // Criteria averages
    const criteriaMap = new Map<string, { name: string; scores: number[]; maxScore: number }>()
    for (const result of results) {
      for (const cs of result.scores) {
        const cName = cs.criteria?.criterion || '未知维度'
        if (!criteriaMap.has(cs.criteriaId)) {
          criteriaMap.set(cs.criteriaId, { name: cName, scores: [], maxScore: cs.criteria?.maxScore || 100 })
        }
        criteriaMap.get(cs.criteriaId)!.scores.push(cs.score)
      }
    }

    const criteriaAverages = Array.from(criteriaMap.values()).map(c => ({
      name: c.name,
      average: c.scores.reduce((a, b) => a + b, 0) / c.scores.length,
      maxScore: c.maxScore,
    }))

    // Common weaknesses - collect all weaknesses and find common themes
    const allWeaknesses = results.map(r => r.weaknesses).filter(Boolean)
    const commonWeaknesses = allWeaknesses.length > 0
      ? allWeaknesses.slice(0, 5)
      : []

    // Top works
    const topWorks = results
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 5)
      .map(r => ({
        studentName: r.studentWork.studentName,
        score: r.totalScore,
        maxScore: r.maxScore,
      }))

    return NextResponse.json({
      totalSubmissions: submissions.length,
      gradedCount: results.length,
      averageScore: Math.round(averageScore * 10) / 10,
      maxScore: Math.round(maxScore * 10) / 10,
      minScore: Math.round(minScore * 10) / 10,
      totalMaxScore,
      scoreDistribution,
      criteriaAverages,
      commonWeaknesses,
      topWorks,
    })
  } catch (error) {
    console.error('Failed to fetch statistics:', error)
    return NextResponse.json({ error: 'Failed to fetch statistics' }, { status: 500 })
  }
}

function generateScoreDistribution(scores: number[], totalMaxScore: number) {
  // Generate distribution based on percentage of totalMaxScore
  const percentageRanges = [
    { range: '不及格 (<60%)', minPct: 0, maxPct: 0.6 },
    { range: '及格 (60-69%)', minPct: 0.6, maxPct: 0.7 },
    { range: '中等 (70-79%)', minPct: 0.7, maxPct: 0.8 },
    { range: '良好 (80-89%)', minPct: 0.8, maxPct: 0.9 },
    { range: '优秀 (90-100%)', minPct: 0.9, maxPct: 1.01 },
  ]

  return percentageRanges.map(r => {
    const minScore = r.minPct * totalMaxScore
    const maxScoreVal = r.maxPct * totalMaxScore
    return {
      range: r.range,
      count: scores.filter(s => s >= minScore && s < maxScoreVal).length,
      min: Math.round(minScore * 10) / 10,
      max: Math.round((r.maxPct === 1.01 ? totalMaxScore : maxScoreVal) * 10) / 10,
    }
  })
}
