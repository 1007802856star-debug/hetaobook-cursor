# Worklog

---
Task ID: 1
Agent: main
Task: Fix three bugs in the homework grading app

Work Log:
- Analyzed the uploaded screenshot showing 0/100 score and missing evaluation text
- Read all relevant source files (grading API, submissions API, AI grading component, statistics, etc.)
- Checked the database state and found maxScore was always 100 instead of sum of criteria maxScores (should be 15)
- Found 14 results had totalScore=0 with no strengths/weaknesses (AI response parsing failures)
- Found 6 submissions had status='submitted' but were stuck
- Fixed Bug 1: Changed grading API to calculate maxScore as sum of criteria maxScores, and totalScore as sum of dimension scores
- Fixed Bug 2: Improved AI response parsing with robust JSON extraction, fuzzy criterion name matching, position-based fallback
- Fixed Bug 3: Added stale status detection and fix in submissions API, updated AI grading component to count 'grading' status as pending
- Added re-grading capability (delete existing result and re-grade)
- Updated statistics API with dynamic score distribution and totalMaxScore
- Cleaned up database: deleted 19 failed results, updated results with correct maxScore, recalculated totalScore
- 19 submissions now have 'submitted' status and can be re-graded with the fixed API

Stage Summary:
- All three bugs fixed in code and database
- maxScore now correctly calculated as sum of criteria scores (e.g., 5+5+5=15 instead of 100)
- totalScore now correctly calculated as sum of dimension scores
- Improved AI response parsing robustness with fuzzy matching
- Submissions API now auto-fixes stale statuses
- Statistics properly display scores relative to total maxScore

---
Task ID: 2
Agent: main
Task: Complete assignment form restructuring - reinforce 题干/评分标准/参考答案/相关知识点 structure

Work Log:
- Verified existing code already has: 题干 label, three background categories (评分标准/参考答案/相关知识点), AI prompt with all categories
- Added grading standard validation in AI grading API (returns 400 error if no grading_standards exist)
- Changed "背景知识" card title to "评分依据" with clearer description
- Updated assignment list card label from "背景知识" to "评分依据"
- Added AssignmentDetail interface and fetch in AIGrading component
- Added warning banner in AI grading when missing 评分标准 or 评分维度
- Disabled batch/single grading buttons when canGrade is false
- All changes pass ESLint and Prisma schema is in sync

Stage Summary:
- 评分标准 is now enforced as required - API rejects grading without it
- UI clearly shows "评分依据" instead of "背景知识" with description explaining all three categories
- AI grading component warns users when grading standards are missing and disables grading buttons
- All previous functionality preserved
