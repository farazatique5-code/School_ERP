// modules/library/hooks/useLibrary.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../core/auth/AuthContext';
import { listBooks, getBookDetail, findCopyByBarcode, listActiveIssues, getBorrowerHistory } from '../api/queries';
import { createBook, issueBook, returnBook, reserveBook } from '../api/mutations';
import type { ListBooksParams } from '../api/queries';
import type { BookInput, IssueInput } from '../schemas/library.schema';

export const libraryKeys = {
  books: (params: Omit<ListBooksParams, 'schoolId'> & { schoolId?: string }) => ['library', 'books', params] as const,
  bookDetail: (id?: string) => ['library', 'bookDetail', id] as const,
  activeIssues: (schoolId?: string) => ['library', 'activeIssues', schoolId] as const,
  borrowerHistory: (studentId?: string, employeeId?: string) => ['library', 'history', studentId, employeeId] as const,
};

export function useBooksList(params: Omit<ListBooksParams, 'schoolId'>) {
  const { activeSchoolId } = useAuth();
  return useQuery({
    queryKey: libraryKeys.books({ ...params, schoolId: activeSchoolId ?? undefined }),
    enabled: !!activeSchoolId,
    queryFn: () => listBooks({ ...params, schoolId: activeSchoolId! }),
    placeholderData: (prev) => prev,
  });
}

export function useBookDetail(bookId: string | undefined) {
  return useQuery({
    queryKey: libraryKeys.bookDetail(bookId),
    enabled: !!bookId,
    queryFn: () => getBookDetail(bookId!),
  });
}

export function useActiveIssues() {
  const { activeSchoolId } = useAuth();
  return useQuery({
    queryKey: libraryKeys.activeIssues(activeSchoolId ?? undefined),
    enabled: !!activeSchoolId,
    queryFn: () => listActiveIssues(activeSchoolId!),
  });
}

export function useBorrowerHistory(studentId?: string, employeeProfileId?: string) {
  return useQuery({
    queryKey: libraryKeys.borrowerHistory(studentId, employeeProfileId),
    enabled: !!studentId || !!employeeProfileId,
    queryFn: () => getBorrowerHistory(studentId, employeeProfileId),
  });
}

export function useCreateBook() {
  const { activeSchoolId, schools } = useAuth();
  const queryClient = useQueryClient();
  const schoolCode = schools.find((s) => s.id === activeSchoolId)?.code ?? 'LIB';
  return useMutation({
    mutationFn: (input: BookInput) => createBook(activeSchoolId!, schoolCode, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['library', 'books'] }),
  });
}

export function useFindCopyByBarcode() {
  return useMutation({ mutationFn: (barcode: string) => findCopyByBarcode(barcode) });
}

export function useIssueBook() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: IssueInput) => issueBook(profile!.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
    },
  });
}

export function useReturnBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ issueId, finePerDay }: { issueId: string; finePerDay: number }) => returnBook(issueId, finePerDay),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['library'] }),
  });
}

export function useReserveBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookId, borrowerType, borrowerId }: { bookId: string; borrowerType: 'student' | 'employee'; borrowerId: string }) =>
      reserveBook(bookId, borrowerType, borrowerId),
    onSuccess: (_d, vars) => queryClient.invalidateQueries({ queryKey: libraryKeys.bookDetail(vars.bookId) }),
  });
}
