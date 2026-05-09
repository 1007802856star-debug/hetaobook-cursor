import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { bigmodelChatCompletion, completionTextFromBigmodel } from '@/lib/bigmodel'

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

    // Separate backgrounds by category for structured AI prompt
    const gradingStandards = assignment.backgrounds.filter(b => b.category === 'grading_standard')
    const referenceAnswers = assignment.backgrounds.filter(b => b.category === 'reference_answer')
    const knowledgePoints = assignment.backgrounds.filter(b => b.category === 'knowledge')

    // Validate: grading standards are required
    if (gradingStandards.length === 0) {
      // Reset status back to submitted
      await db.studentWork.update({
        where: { id: submissionId },
        data: { status: 'submitted' }
      })
      return NextResponse.json({ 
        error: '缺少评分标准，请先在作业管理中添加评分标准后再进行批改' 
      }, { status: 400 })
    }

    const gradingStandardText = gradingStandards.length > 0
      ? gradingStandards.map(b => b.content).join('\n')
      : '无'

    const referenceAnswerText = referenceAnswers.length > 0
      ? referenceAnswers.map(b => b.content).join('\n')
      : '无'

    const knowledgePointText = knowledgePoints.length > 0
      ? knowledgePoints.map(b => b.content).join('\n')
      : '无'

    const criteriaNames = assignment.criteria.length > 0
      ? assignment.criteria.map(c => c.criterion)
      : ['综合评价']

    const criteriaListStr = criteriaNames.map((name, i) => `${i + 1}. "${name}"`).join('\n')

    // Build structured system prompt with grading reference materials and assignment info
    const systemPrompt = `你是一位经验丰富的专业教师，擅长对学生作业进行详细、公正的批改和评价。

## 作业题目
${assignment.title}
题干：${assignment.description || '无'}
科目：${assignment.subject || '未指定'}

## 评分标准（核心依据）
${gradingStandardText}

## 参考答案
${referenceAnswerText}

## 相关知识点
${knowledgePointText}

## 批改维度
${criteriaText}
各维度满分之和为${totalMaxScore}分。

## 返回格式
请返回纯JSON格式（不要包含markdown代码块标记\`\`\`），包含以下字段：
{
  "evaluation": "总体评价（100-200字），结合作业内容、评分标准和参考答案综合评价",
  "strengths": "优点，指出做得好的地方",
  "weaknesses": "不足之处，指出与评分标准和参考答案的差距",
  "modifications": [
    {
      "dimension": "对应的评分维度名称（必须与批改维度名称完全一致）",
      "issue": "具体问题描述，指出该维度中存在的具体问题",
      "suggestion": "具体修改建议话术，给出可直接使用的修改指导，包括：指出问题位置、说明正确做法、给出修改示例。例如：'第2段中关于XX的论述不够准确，建议修改为：……，因为根据知识点XX，正确的理解应该是……'"
    }
  ],
  "criteriaScores": [
    {
      "criterionName": "维度名称（必须与批改维度名称完全一致）",
      "score": 数字（该维度得分，不超过该维度满分），
      "comment": "该维度的评语（50-100字），结合评分标准说明得分原因"
    }
  ]
}

## 重要评分规则
1. 评分必须严格依据评分标准，对照参考答案判断正确性
2. 每个维度的score不得超过该维度的满分
3. totalScore不需要返回，系统会自动将各维度得分加总计算
4. 评价要具体、有针对性，避免空泛的描述
5. modifications数组中的每条修改建议必须包含具体话术，给出明确的修改方向和示例，不要只说'需要改进'而不说明如何改
6. 评语要结合作业内容给出具体例子，引用相关知识点
7. 必须返回所有维度的评分，不要遗漏
8. criterionName和dimension必须与批改维度名称完全一致，包括标点符号
9. 如果某个维度表现优秀无需修改，仍需在modifications中给出肯定性建议（如：'该维度表现优秀，建议继续保持……的方式'）`

    const userPrompt = `## 学生信息
姓名：${submission.studentName}
学号：${submission.studentId || '未提供'}

## 学生作业内容
${submission.content}

---

请严格按照批改维度要求进行评价，返回JSON格式结果。
评分维度名称必须严格使用以下名称：
${criteriaListStr}

重要提醒：modifications中的suggestion字段必须给出具体的修改建议话术，包含问题定位、正确做法和修改示例，而非笼统的改进方向。`

    try {
      const completion = await bigmodelChatCompletion({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
      })

      if ((completion as any)?.error) {
        const err = (completion as any).error
        const msg = String(err?.message || err?.error || err || 'unknown error')
        throw new Error(`ZAI API error: ${msg}`)
      }

      const aiContent = completionTextFromBigmodel(completion)
      if (!aiContent) {
        const msg = completion?.choices?.[0]?.message
        const msgKeys = msg && typeof msg === 'object' ? Object.keys(msg) : []
        const choiceKeys = completion?.choices?.[0] && typeof completion?.choices?.[0] === 'object'
          ? Object.keys(completion.choices[0])
          : []
        console.error('AI response empty. completion keys:', Object.keys(completion || {}))
        console.error('AI response empty. choice keys:', choiceKeys)
        console.error('AI response empty. message keys:', msgKeys)
      }

      // Parse AI response with robust extraction
      let result = extractJSON(aiContent)

      if (!result) {
        console.error(
          'Failed to extract JSON from AI response:',
          aiContent ? aiContent.substring(0, 500) : '(empty)'
        )
        // If parsing fails, create a fallback result
        result = {
          evaluation: aiContent ? aiContent.substring(0, 500) : 'AI 返回为空或无法解析',
          modifications: [],
          feedback: '',
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
      result.strengths = result.strengths || ''
      result.weaknesses = result.weaknesses || ''
      result.feedback = result.feedback || ''
      result.suggestions = result.suggestions || ''

      // Process modifications: convert structured array to JSON string for storage
      // Support both new format (array of objects) and old format (plain string)
      let modificationsStr = ''
      if (Array.isArray(result.modifications)) {
        modificationsStr = JSON.stringify(result.modifications)
      } else if (typeof result.modifications === 'string') {
        modificationsStr = result.modifications
      }

      // Save the grading result (totalScore will be calculated from criteria scores)
      const gradingResult = await db.gradingResult.create({
        data: {
          studentWorkId: submissionId,
          totalScore: 0, // Will be updated after saving criteria scores
          maxScore: totalMaxScore,
          evaluation: result.evaluation,
          modifications: modificationsStr,
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
