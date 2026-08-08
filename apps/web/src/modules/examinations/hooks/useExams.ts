// modules/examinations/hooks/useExams.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../core/auth/AuthContext';
import { listExams, getExamDetail, getMarksRoster, getRankings, getStudentReportCard, listQuestions } from '../api/queries';
import { createExam, addExamSchedule, updateExamStatus, bulkSaveMarks, createQuestion } from '../api/mutations';
import type { ExamInput, ExamScheduleInput, BulkMarksInput, QuestionInput } from '../schemas/exam.schema';

export const examKeys = {
  list: (schoolId?: string) => ['exams', 'list', schoolId] as const,
  detail: (examId?: string) => ['exams', 'detail', examId] as const,
  roster: (scheduleId?: string) => ['exams', 'roster', scheduleId] as const,
  rankings: (examId?: string, sectionId?: string) => ['exams', 'rankings', examId, sectionId] as const,
  reportCard: (examId?: string, studentId?: string) => ['exams', 'reportCard', examId, studentId] as const,
  questions: (schoolId?: string, subjectId?: string) => ['exams', 'questions', schoolId, subjectId] as const,
};

export function useExamsList() {
  const { activeSchoolId } = useAuth();
  return useQuery({
    queryKey: examKeys.list(activeSchoolId ?? undefined),
    enabled: !!activeSchoolId,
    queryFn: () => listExams(activeSchoolId!),
  });
}

export function useExamDetail(examId: string | undefined) {
  return useQuery({
    queryKey: examKeys.detail(examId),
    enabled: !!examId,
    queryFn: () => getExamDetail(examId!),
  });
}

export function useMarksRoster(examScheduleId: string | undefined) {
  return useQuery({
    queryKey: examKeys.roster(examScheduleId),
    enabled: !!examScheduleId,
    queryFn: () => getMarksRoster(examScheduleId!),
  });
}

export function useRankings(examId: string | undefined, sectionId: string | undefined) {
  return useQuery({
    queryKey: examKeys.rankings(examId, sectionId),
    enabled: !!examId && !!sectionId,
    queryFn: () => getRankings(examId!, sectionId!),
  });
}

export function useStudentReportCard(examId: string | undefined, studentId: string | undefined) {
  return useQuery({
    queryKey: examKeys.reportCard(examId, studentId),
    enabled: !!examId && !!studentId,
    queryFn: () => getStudentReportCard(examId!, studentId!),
  });
}

export function useQuestions(subjectId?: string) {
  const { activeSchoolId } = useAuth();
  return useQuery({
    queryKey: examKeys.questions(activeSchoolId ?? undefined, subjectId),
    enabled: !!activeSchoolId,
    queryFn: () => listQuestions(activeSchoolId!, subjectId),
  });
}

export function useCreateExam() {
  const { organization, activeSchoolId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ academicYearId, input }: { academicYearId: string; input: ExamInput }) =>
      createExam(organization!.id, activeSchoolId!, academicYearId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: examKeys.list(activeSchoolId ?? undefined) }),
  });
}

export function useAddExamSchedule(examId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ExamScheduleInput) => addExamSchedule(examId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: examKeys.detail(examId) }),
  });
}

export function useUpdateExamStatus(examId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: 'scheduled' | 'ongoing' | 'completed' | 'published') => updateExamStatus(examId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: examKeys.detail(examId) });
      queryClient.invalidateQueries({ queryKey: ['exams', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['exams', 'rankings'] });
    },
  });
}

export function useBulkSaveMarks() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BulkMarksInput) => bulkSaveMarks(profile!.id, input),
    onSuccess: (_data, input) => queryClient.invalidateQueries({ queryKey: examKeys.roster(input.examScheduleId) }),
  });
}

export function useCreateQuestion() {
  const { activeSchoolId, profile } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: QuestionInput) => createQuestion(activeSchoolId!, profile!.id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exams', 'questions'] }),
  });
}
