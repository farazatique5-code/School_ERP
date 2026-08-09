// modules/library/api/queries.ts
import { supabase } from '../../../core/supabase/client';

export interface ListBooksParams {
  schoolId: string;
  page: number;
  pageSize: number;
  search?: string;
}

export async function listBooks(params: ListBooksParams) {
  const { schoolId, page, pageSize, search } = params;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('library_books')
    .select('*, library_book_copies(id, status)', { count: 'exact' })
    .eq('school_id', schoolId);
  if (search) query = query.or(`title.ilike.%${search}%,author.ilike.%${search}%,isbn.ilike.%${search}%`);
  query = query.order('title').range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  const rows = (data ?? []).map((book: any) => ({
    ...book,
    totalCopies: book.library_book_copies?.length ?? 0,
    availableCopies: book.library_book_copies?.filter((c: any) => c.status === 'available').length ?? 0,
  }));
  return { rows, totalCount: count ?? 0 };
}

export async function getBookDetail(bookId: string) {
  const { data, error } = await supabase
    .from('library_books')
    .select('*, library_book_copies(*), library_reservations(*, student:students(first_name, last_name))')
    .eq('id', bookId)
    .single();
  if (error) throw error;
  return data;
}

export async function findCopyByBarcode(barcode: string) {
  const { data, error } = await supabase
    .from('library_book_copies')
    .select('*, book:library_books(title, author)')
    .eq('barcode', barcode)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listActiveIssues(schoolId: string) {
  const { data, error } = await supabase
    .from('library_issues')
    .select(
      `*, book_copy:library_book_copies(barcode, book:library_books(title)),
       student:students(first_name, last_name, student_code), employee:employees(profile:profiles(full_name))`,
    )
    .eq('school_id', schoolId)
    .in('status', ['issued', 'overdue'])
    .order('due_date');
  if (error) throw error;
  return data;
}

export async function getBorrowerHistory(studentId?: string, employeeProfileId?: string) {
  let query = supabase.from('library_issues').select('*, book_copy:library_book_copies(barcode, book:library_books(title))');
  query = studentId ? query.eq('student_id', studentId) : query.eq('employee_profile_id', employeeProfileId!);
  const { data, error } = await query.order('issue_date', { ascending: false });
  if (error) throw error;
  return data;
}
