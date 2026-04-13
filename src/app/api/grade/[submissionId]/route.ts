import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

// Helper: fuzzy match criterion name
function matchCriterionName(aiName: string, criteriaNames: string[]): string | null {
  // Exact match first
  if (criteriaNames.includes(aiName)) return aiName

  // Normalize and try partial match
  const normalize = (s: string) => s.replace(/[\s\-—–·•、]/g, '').toLowerCase()
  const normalizedAi = normalize(aiName)

  for (const cn of criteriaNames) {
    if (normalize(cn) === normalizedAi) return cn
  }

  // Try contains match
  for (const cn of criteriaNames) {
    if (normalize(cn).includes(normalizedAi) || normalizedAi.includes(normalize(cn))) return cn
  }

  return null
}

// Helper: robust JSON extraction from AI response
function extractJSON(text: string): any {
  // Try direct parse
  try {
    return JSON.parse(text)
  } catch {}

  // Try removing markdown code blocks
  let cleaned = text.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }
  try {
    return JSON.parse(cleaned)
  } catch {}

  // Try to find JSON object in the text
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0])
    } catch {}
  }

  // Try to find JSON array
  const arrMatch = cleaned.match(/\[[\s\S]*\]/)
  if (arrMatch) {
    try {
      return JSON.parse(arrMatch[0])
    } catch {}
  }

  return null
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const { submissionId } = await params

    // Get the submission with assignment details
    const submission = await db.studentWork.findUnique({
      where: { id: submissionId },
      include: {
        assignment: {
          include: {
            criteria: { orderBy: { order: 'asc' } },
            backgrounds: { orderBy: { order: 'asc' } },
          }
        }
      }
    })

    if (!submission) {
      return NextResponse.json({ error: '未找到该作业提交' }, { status: 404 })
    }

    // Check if already graded - if result exists, delete it and re-grade
    const existingResult = await db.gradingResult.findUnique({
      where: { studentWorkId: submissionId }
    })
    if (existingResult) {
      // Delete existing result and criteria scores to allow re-grading
      await db.criteriaScore.deleteMany({
        where: { resultId: existingResult.id }
      })
      await db.gradingResult.delete({
        where: { id: existingResult.id }
      })
    }

    // Update status to grading
    await db.studentWork.update({
      where: { id: submissionId },
      data: { status: 'grading' }
    })

    const { assignment } = submission

    // Calculate total max score from criteria (sum of all dimensions)
    const totalMaxScore = assignment.criteria.length > 0
      ? assignment.criteria.reduce((sum, c) => sum + c.maxScore, 0)
      : 100

    // Build the AI prompt
    const criteriaText = assignment.criteria.length > 0
      ? assignment.criteria.map(c =>
          `- ${c.criterion}（满分: ${c.maxScore}分）：${c.description}`
        ).join('\n')
      : '- 综合评价（满分: 100分）：根据作业整体质量评分'

    const backgroundText = assignment.backgrounds.length > 0
      ? assignment.backgrounds.map(b => b.content).join('\n')
      : '无'

    const criteriaNames = assignment.criteria.length > 0
      ? assignment.criteria.map(c => c.criterion)
      : ['综合评价']

    const criteriaListStr = criteriaNames.map((name, i) => `${i + 1}. "${name}"`).join('\n')

    const userPrompt = `作业题目：${assignment.title}
作业描述：${assignment.description || '无'}
科目：${assignment.subject || '未指定'}

批改要求（各维度满分之和为${totalMaxScore}分）：
${criteriaText}

背景知识：
${backgroundText}

学生姓名：${submission.studentName}
学号：${submission.studentId || '未提供'}

作业内容：
${submission.content}

请严格按照批改要求进行评价，返回JSON格式结果。
评分维度名称必须严格使用以下名称：
${criteriaListStr}`

    try {
      const zai = await ZAI.create()
      const completion = await zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `你是一位经验丰富的专业教师，擅长对学生作业进行详细、公正的批改和评价。你需要根据给定的批改要求和背景知识，对学生提交的作业进行全面评价。

请返回纯JSON格式（不要包含markdown代码块标记\`\`\`），包含以下字段：
{
  "evaluation": "总体评价（100-200字）",
  "modifications": "具体修改建议，详细指出需要修改的地方",
  "feedback": "反馈意见，鼓励性的建设性反馈",
  "strengths": "优点，指出做得好的地方",
  "weaknesses": "不足之处，指出需要改进的问题",
  "suggestions": "改进建议，提供具体的改进方向",
  "criteriaScores": [
    {
      "criterionName": "维度名称（必须与批改要求中的名称完全一致）",
      "score": 数字（该维度得分，不超过该维度满分），
      "comment": "该维度的评语（50-100字）"
    }
  ]
}

重要评分规则：
1. 每个维度的score不得超过该维度的满分
2. totalScore不需要返回，系统会自动将各维度得分加总计算
3. 评价要具体、有针对性，避免空泛的描述
4. 修改建议要指出具体的问题位置和修改方向
5. 反馈要有鼓励性，同时指出不足
6. 评语要结合作业内容给出具体例子
7. 必须返回所有维度的评分，不要遗漏
8. criterionName必须与批改要求中的维度名称完全一致，包括标点符号`
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        temperature: 0.3,
      })

      const aiContent = completion.choices?.[0]?.message?.content || ''

      // Parse AI response with robust extraction
      let result = extractJSON(aiContent)

      if (!result) {
        console.error('Failed to extract JSON from AI response:', aiContent.substring(0, 500))
        // If parsing fails, create a fallback result
        result = {
          evaluation: aiContent.substring(0, 200),
          modifications: 'AI返回格式异常，无法解析具体修改建议',
          feedback: 'AI返回格式异常，无法解析反馈意见',
          strengths: '',
          weaknesses: '',
          suggestions: '',
          criteriaScores: assignment.criteria.map(c => ({
            criterionName: c.criterion,
            score: 0,
            comment: '评分解析失败'
          }))
        }
      }

      // Ensure all text fields have values
      result.evaluation = result.evaluation || '无评价'
      result.modifications = result.modifications || ''
      result.feedback = result.feedback || ''
      result.strengths = result.strengths || ''
      result.weaknesses = result.weaknesses || ''
      result.suggestions = result.suggestions || ''

      // Save the grading result (totalScore will be calculated from criteria scores)
      const gradingResult = await db.gradingResult.create({
        data: {
          studentWorkId: submissionId,
          totalScore: 0, // Will be updated after saving criteria scores
          maxScore: totalMaxScore,
          evaluation: result.evaluation,
          modifications: result.modifications,
          feedback: result.feedback,
          strengths: result.strengths,
          weaknesses: result.weaknesses,
          suggestions: result.suggestions,
        }
      })

      // Save criteria scores and calculate total
      let calculatedTotalScore = 0
      if (result.criteriaScores && Array.isArray(result.criteriaScores)) {
        for (const cs of result.criteriaScores) {
          // Find matching criteria with fuzzy matching
          const matchedName = matchCriterionName(cs.criterionName || '', criteriaNames)
          const matchedCriteria = matchedName
            ? assignment.criteria.find(c => c.criterion === matchedName)
            : null

          if (matchedCriteria) {
            const score = Math.min(Math.max(cs.score || 0, 0), matchedCriteria.maxScore)
            calculatedTotalScore += score
            await db.criteriaScore.create({
              data: {
                criteriaId: matchedCriteria.id,
                studentWorkId: submissionId,
                resultId: gradingResult.id,
                score,
                comment: cs.comment || '',
              }
            })
          }
        }
      }

      // If no criteria scores were saved, try to assign scores by position
      if (result.criteriaScores && Array.isArray(result.criteriaScores)) {
        const savedScores = await db.criteriaScore.count({
          where: { resultId: gradingResult.id }
        })
        if (savedScores === 0 && result.criteriaScores.length === assignment.criteria.length) {
          for (let i = 0; i < assignment.criteria.length; i++) {
            const cs = result.criteriaScores[i]
            const criteria = assignment.criteria[i]
            const score = Math.min(Math.max(cs?.score || 0, 0), criteria.maxScore)
            calculatedTotalScore += score
            await db.criteriaScore.create({
              data: {
                criteriaId: criteria.id,
                studentWorkId: submissionId,
                resultId: gradingResult.id,
                score,
                comment: cs?.comment || '',
              }
            })
          }
        }
      }

      // If still no criteria scores, create default zero scores
      if (assignment.criteria.length > 0) {
        const savedScores = await db.criteriaScore.count({
          where: { resultId: gradingResult.id }
        })
        if (savedScores === 0) {
          for (const criteria of assignment.criteria) {
            await db.criteriaScore.create({
              data: {
                criteriaId: criteria.id,
                studentWorkId: submissionId,
                resultId: gradingResult.id,
                score: 0,
                comment: '未能解析该维度评分',
              }
            })
          }
        }
      }

      // Update the total score (sum of all dimension scores)
      await db.gradingResult.update({
        where: { id: gradingResult.id },
        data: { totalScore: calculatedTotalScore }
      })

      // Update submission status
      await db.studentWork.update({
        where: { id: submissionId },
        data: { status: 'graded' }
      })

      // Return the complete result
      const fullResult = await db.gradingResult.findUnique({
        where: { id: gradingResult.id },
        include: {
          scores: {
            include: {
              criteria: { select: { criterion: true, maxScore: true } }
            }
          }
        }
      })

      return NextResponse.json(fullResult)
    } catch (aiError) {
      console.error('AI grading failed:', aiError)
      // Reset status
      await db.studentWork.update({
        where: { id: submissionId },
        data: { status: 'submitted' }
      })
      return NextResponse.json({ error: 'AI批改失败：' + (aiError instanceof Error ? aiError.message : '未知错误') }, { status: 500 })
    }
  } catch (error) {
    console.error('Grading error:', error)
    return NextResponse.json({ error: '批改过程中出错' }, { status: 500 })
  }
}
