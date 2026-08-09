// modules/fees-finance/hooks/useFees.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../core/auth/AuthContext';
import {
  listFeeCategories,
  listFeeStructures,
  listScholarships,
  listInvoices,
  getInvoiceDetail,
  getStudentFeePlan,
  getLedgerEntries,
  getMonthlyFinancialSummary,
} from '../api/queries';
import {
  createFeeCategory,
  createFeeStructure,
  createScholarship,
  assignScholarship,
  generateFeePlanForStudent,
  createInvoice,
  recordPayment,
} from '../api/mutations';
import type { ListInvoicesParams } from '../api/queries';
import type { FeeCategoryInput, FeeStructureInput, ScholarshipInput, InvoiceInput, PaymentInput } from '../schemas/fees.schema';

export const feesKeys = {
  categories: (schoolId?: string) => ['fees', 'categories', schoolId] as const,
  structures: (schoolId?: string, yearId?: string) => ['fees', 'structures', schoolId, yearId] as const,
  scholarships: (schoolId?: string) => ['fees', 'scholarships', schoolId] as const,
  invoices: (params: Omit<ListInvoicesParams, 'schoolId'> & { schoolId?: string }) => ['fees', 'invoices', params] as const,
  invoiceDetail: (id?: string) => ['fees', 'invoiceDetail', id] as const,
  feePlan: (studentId?: string, yearId?: string) => ['fees', 'plan', studentId, yearId] as const,
  ledger: (schoolId?: string, from?: string, to?: string) => ['fees', 'ledger', schoolId, from, to] as const,
  summary: (schoolId?: string, year?: number) => ['fees', 'summary', schoolId, year] as const,
};

export function useFeeCategories() {
  const { activeSchoolId } = useAuth();
  return useQuery({
    queryKey: feesKeys.categories(activeSchoolId ?? undefined),
    enabled: !!activeSchoolId,
    queryFn: () => listFeeCategories(activeSchoolId!),
  });
}

export function useFeeStructures(academicYearId: string | undefined) {
  const { activeSchoolId } = useAuth();
  return useQuery({
    queryKey: feesKeys.structures(activeSchoolId ?? undefined, academicYearId),
    enabled: !!activeSchoolId && !!academicYearId,
    queryFn: () => listFeeStructures(activeSchoolId!, academicYearId!),
  });
}

export function useScholarships() {
  const { activeSchoolId } = useAuth();
  return useQuery({
    queryKey: feesKeys.scholarships(activeSchoolId ?? undefined),
    enabled: !!activeSchoolId,
    queryFn: () => listScholarships(activeSchoolId!),
  });
}

export function useInvoicesList(params: Omit<ListInvoicesParams, 'schoolId'>) {
  const { activeSchoolId } = useAuth();
  return useQuery({
    queryKey: feesKeys.invoices({ ...params, schoolId: activeSchoolId ?? undefined }),
    enabled: !!activeSchoolId,
    queryFn: () => listInvoices({ ...params, schoolId: activeSchoolId! }),
    placeholderData: (prev) => prev,
  });
}

export function useInvoiceDetail(invoiceId: string | undefined) {
  return useQuery({
    queryKey: feesKeys.invoiceDetail(invoiceId),
    enabled: !!invoiceId,
    queryFn: () => getInvoiceDetail(invoiceId!),
  });
}

export function useStudentFeePlan(studentId: string | undefined, academicYearId: string | undefined) {
  return useQuery({
    queryKey: feesKeys.feePlan(studentId, academicYearId),
    enabled: !!studentId && !!academicYearId,
    queryFn: () => getStudentFeePlan(studentId!, academicYearId!),
  });
}

export function useLedgerEntries(fromDate: string, toDate: string) {
  const { activeSchoolId } = useAuth();
  return useQuery({
    queryKey: feesKeys.ledger(activeSchoolId ?? undefined, fromDate, toDate),
    enabled: !!activeSchoolId,
    queryFn: () => getLedgerEntries(activeSchoolId!, fromDate, toDate),
  });
}

export function useMonthlyFinancialSummary(year: number) {
  const { activeSchoolId } = useAuth();
  return useQuery({
    queryKey: feesKeys.summary(activeSchoolId ?? undefined, year),
    enabled: !!activeSchoolId,
    queryFn: () => getMonthlyFinancialSummary(activeSchoolId!, year),
  });
}

export function useCreateFeeCategory() {
  const { activeSchoolId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: FeeCategoryInput) => createFeeCategory(activeSchoolId!, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: feesKeys.categories(activeSchoolId ?? undefined) }),
  });
}

export function useCreateFeeStructure(academicYearId: string) {
  const { activeSchoolId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: FeeStructureInput) => createFeeStructure(activeSchoolId!, academicYearId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: feesKeys.structures(activeSchoolId ?? undefined, academicYearId) }),
  });
}

export function useCreateScholarship() {
  const { activeSchoolId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ScholarshipInput) => createScholarship(activeSchoolId!, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: feesKeys.scholarships(activeSchoolId ?? undefined) }),
  });
}

export function useAssignScholarship(academicYearId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ studentId, scholarshipId }: { studentId: string; scholarshipId: string }) =>
      assignScholarship(studentId, scholarshipId, academicYearId),
    onSuccess: (_d, vars) => queryClient.invalidateQueries({ queryKey: feesKeys.feePlan(vars.studentId, academicYearId) }),
  });
}

export function useGenerateFeePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ studentId, classId, academicYearId }: { studentId: string; classId: string; academicYearId: string }) =>
      generateFeePlanForStudent(studentId, classId, academicYearId),
    onSuccess: (_d, vars) => queryClient.invalidateQueries({ queryKey: feesKeys.feePlan(vars.studentId, vars.academicYearId) }),
  });
}

export function useCreateInvoice() {
  const { organization, activeSchoolId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: InvoiceInput) => createInvoice(organization!.id, activeSchoolId!, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fees', 'invoices'] }),
  });
}

export function useRecordPayment(invoiceId: string) {
  const { activeSchoolId, profile } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PaymentInput) => recordPayment(activeSchoolId!, invoiceId, profile!.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: feesKeys.invoiceDetail(invoiceId) });
      queryClient.invalidateQueries({ queryKey: ['fees', 'invoices'] });
      queryClient.invalidateQueries({ queryKey: ['fees', 'ledger'] });
      queryClient.invalidateQueries({ queryKey: ['fees', 'summary'] });
    },
  });
}
