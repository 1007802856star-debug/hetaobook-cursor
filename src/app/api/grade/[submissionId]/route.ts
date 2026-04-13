import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

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

    // Check if already graded
    const existingResult = await db.gradingResult.findUnique({
      where: { studentWorkId: submissionId }
    })
    if (existingResult) {
      return NextResponse.json({ error: '该作业已批改，请勿重复批改' }, { status: 400 })
    }

    // Update status to grading
    await db.studentWork.update({
      where: { id: submissionId },
      data: { status: 'grading' }
    })

    const { assignment } = submission

    // Build the AI prompt
    const criteriaText = assignment.criteria.length > 0
      ? assignment.criteria.map(c =>
          `- ${c.criterion}（权重: ${c.weight}，满分: ${c.maxScore}分）：${c.description}`
        ).join('\n')
      : '- 综合评价（权重: 1.0，满分: 100分）：根据作业整体质量评分'

    const backgroundText = assignment.backgrounds.length > 0
      ? assignment.backgrounds.map(b => b.content).join('\n')
      : '无'

    const criteriaNames = assignment.criteria.length > 0
      ? assignment.criteria.map(c => c.criterion)
      : ['综合评价']

    const userPrompt = `作业题目：${assignment.title}
作业描述：${assignment.description || '无'}
科目：${assignment.subject || '未指定'}

批改要求：
${criteriaText}

背景知识：
${backgroundText}

学生姓名：${submission.studentName}
学号：${submission.studentId || '未提供'}

作业内容：
${submission.content}

请严格按照批改要求进行评价，返回JSON格式结果。评分维度名称必须为：${criteriaNames.join('、')}`

    try {
      const zai = await ZAI.create()
      const completion = await zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `你是一位经验丰富的专业教师，擅长对学生作业进行详细、公正的批改和评价。你需要根据给定的批改要求和背景知识，对学生提交的作业进行全面评价。

请返回纯JSON格式（不要包含markdown代码块标记），包含以下字段：
{
  "totalScore": 数字（总分），
  "evaluation": 字符串（总体评价，100-200字），
  "modifications": 字符串（具体修改建议，详细指出需要修改的地方），
  "feedback": 字符串（反馈意见，鼓励性的建设性反馈），
  "strengths": 字符串（优点，指出做得好的地方），
  "weaknesses": 字符串（不足之处，指出需要改进的问题），
  "suggestions": 字符串（改进建议，提供具体的改进方向），
  "criteriaScores": 数组，每项包含：
  {
    "criterionName": 字符串（维度名称，必须与批改要求中的名称一致），
    "score": 数字（该维度得分），
    "maxScore": 数字（该维度满分），
    "comment": 字符串（该维度的评语，50-100字）
  }
}

评分要求：
1. 严格按照各维度的权重和满分进行评分
2. totalScore应该是各维度得分的加权平均（映射到100分制）
3. 评价要具体、有针对性，避免空泛的描述
4. 修改建议要指出具体的问题位置和修改方向
5. 反馈要有鼓励性，同时指出不足
6. 评语要结合作业内容给出具体例子`
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        temperature: 0.3,
      })

      const aiContent = completion.choices?.[0]?.message?.content || ''

      // Parse AI response - handle potential markdown code blocks
      let jsonStr = aiContent.trim()
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
      }

      let result
      try {
        result = JSON.parse(jsonStr)
      } catch {
        console.error('Failed to parse AI response:', jsonStr)
        // If parsing fails, create a fallback result
        result = {
          totalScore: 0,
          evaluation: aiContent.substring(0, 200),
          modifications: '',
          feedback: '',
          strengths: '',
          weaknesses: '',
          suggestions: '',
          criteriaScores: assignment.criteria.map(c => ({
            criterionName: c.criterion,
            score: 0,
            maxScore: c.maxScore,
            comment: '评分解析失败'
          }))
        }
      }

      // Calculate max score from criteria
      const maxScore = assignment.criteria.length > 0
        ? 100
        : 100

      // Save the grading result
      const gradingResult = await db.gradingResult.create({
        data: {
          studentWorkId: submissionId,
          totalScore: Math.min(result.totalScore || 0, maxScore),
          maxScore,
          evaluation: result.evaluation || '',
          modifications: result.modifications || '',
          feedback: result.feedback || '',
          strengths: result.strengths || '',
          weaknesses: result.weaknesses || '',
          suggestions: result.suggestions || '',
        }
      })

      // Save criteria scores
      if (result.criteriaScores && Array.isArray(result.criteriaScores)) {
        for (const cs of result.criteriaScores) {
          // Find matching criteria
          const matchedCriteria = assignment.criteria.find(
            c => c.criterion === cs.criterionName
          )

          if (matchedCriteria) {
            await db.criteriaScore.create({
              data: {
                criteriaId: matchedCriteria.id,
                studentWorkId: submissionId,
                resultId: gradingResult.id,
                score: Math.min(cs.score || 0, matchedCriteria.maxScore),
                comment: cs.comment || '',
              }
            })
          }
        }
      }

      // Update submission status
      await db.studentWork.update({
        where: { id: submissionId },
        data: { status: 'graded' }
      })

      // Return the complete result
      const fullResult = await db.gradingResult.findUnique({
        where: { id: gradingResult.id },
        include: { scores: true }
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
