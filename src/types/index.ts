// Type definitions for the homework grading app

export interface AssignmentWithDetails {
  id: string;
  title: string;
  description: string;
  subject: string;
  createdAt: string;
  updatedAt: string;
  criteria: GradingCriteriaItem[];
  backgrounds: BackgroundItem[];
  submissions: StudentWorkItem[];
}

export interface GradingCriteriaItem {
  id: string;
  assignmentId: string;
  criterion: string;
  description: string;
  weight: number;
  maxScore: number;
  order: number;
}

export interface BackgroundItem {
  id: string;
  assignmentId: string;
  content: string;
  source: string;
  order: number;
}

export interface StudentWorkItem {
  id: string;
  assignmentId: string;
  studentName: string;
  studentId: string;
  content: string;
  filePath: string;
  fileType: string;
  status: 'submitted' | 'grading' | 'graded';
  submittedAt: string;
  result?: GradingResultItem | null;
}

export interface GradingResultItem {
  id: string;
  studentWorkId: string;
  totalScore: number;
  maxScore: number;
  evaluation: string;
  modifications: string;
  feedback: string;
  strengths: string;
  weaknesses: string;
  suggestions: string;
  gradedAt: string;
  criteriaScores: CriteriaScoreItem[];
}

export interface CriteriaScoreItem {
  id: string;
  criteriaId: string;
  studentWorkId: string;
  score: number;
  comment: string;
  criterionName?: string;
  maxScore?: number;
}

export interface StatisticsData {
  totalSubmissions: number;
  gradedCount: number;
  averageScore: number;
  maxScore: number;
  minScore: number;
  scoreDistribution: { range: string; count: number }[];
  criteriaAverages: { name: string; average: number; maxScore: number }[];
  commonWeaknesses: string[];
  topWorks: { studentName: string; score: number }[];
}
