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

    if (results.length === 0) {
      return NextResponse.json({
        totalSubmissions: submissions.length,
        gradedCount: 0,
        averageScore: 0,
        maxScore: 0,
        minScore: 0,
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

    // Score distribution
    const ranges = [
      { range: '0-59', min: 0, max: 59 },
      { range: '60-69', min: 60, max: 69 },
      { range: '70-79', min: 70, max: 79 },
      { range: '80-89', min: 80, max: 89 },
      { range: '90-100', min: 90, max: 100 },
    ]

    const scoreDistribution = ranges.map(r => ({
      range: r.range,
      count: scores.filter(s => s >= r.min && s <= r.max).length
    }))

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
      }))

    return NextResponse.json({
      totalSubmissions: submissions.length,
      gradedCount: results.length,
      averageScore: Math.round(averageScore * 10) / 10,
      maxScore: Math.round(maxScore * 10) / 10,
      minScore: Math.round(minScore * 10) / 10,
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
