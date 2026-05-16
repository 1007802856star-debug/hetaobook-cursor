-- Optional manual SQL (PostgreSQL) if you sync schema outside Prisma.
-- With `prisma db push`, columns are dropped from schema.prisma automatically.

ALTER TABLE "grading_result" DROP COLUMN IF EXISTS "modifications";
ALTER TABLE "grading_result" DROP COLUMN IF EXISTS "feedback";
ALTER TABLE "grading_result" DROP COLUMN IF EXISTS "strengths";
ALTER TABLE "grading_result" DROP COLUMN IF EXISTS "weaknesses";
ALTER TABLE "grading_result" DROP COLUMN IF EXISTS "suggestions";

ALTER TABLE "criteria_score" DROP COLUMN IF EXISTS "comment";
