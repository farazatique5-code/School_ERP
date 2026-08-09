// modules/library/api/mutations.ts
import { supabase } from '../../../core/supabase/client';
import { ApiError } from '../../organizations/api/mutations';
import { bookSchema, issueSchema, type BookInput, type IssueInput } from '../schemas/library.schema';

function generateBarcode(schoolCode: string) {
  return `${schoolCode}-BK-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
}

export async function createBook(schoolId: string, schoolCode: string, input: BookInput) {
  const parsed = bookSchema.parse(input);

  const { data: book, error: bookError } = await supabase
    .from('library_books')
    .insert({
      school_id: schoolId,
      title: parsed.title,
      author: parsed.author || null,
      isbn: parsed.isbn || null,
      publisher: parsed.publisher || null,
      category: parsed.category || null,
      shelf_location: parsed.shelfLocation || null,
    })
    .select()
    .single();
  if (bookError) throw new ApiError(bookError.code ?? 'create_failed', bookError.message);

  const copies = Array.from({ length: parsed.copyCount }, () => ({
    book_id: book.id,
    barcode: generateBarcode(schoolCode),
  }));
  const { error: copiesError } = await supabase.from('library_book_copies').insert(copies);
  if (copiesError) {
    await supabase.from('library_books').delete().eq('id', book.id); // compensating rollback
    throw new ApiError('copies_failed', copiesError.message);
  }

  return book;
}

export async function issueBook(issuedByProfileId: string, input: IssueInput) {
  const parsed = issueSchema.parse(input);

  const { data: copy, error: copyError } = await supabase
    .from('library_book_copies')
    .select('id, status')
    .eq('barcode', parsed.barcode)
    .maybeSingle();
  if (copyError) throw new ApiError('lookup_failed', copyError.message);
  if (!copy) throw new ApiError('barcode_not_found', 'No book copy found with this barcode.');

  const { data: issueId, error } = await supabase.rpc('fn_issue_book', {
    p_book_copy_id: copy.id,
    p_student_id: parsed.borrowerType === 'student' ? parsed.borrowerId : null,
    p_employee_profile_id: parsed.borrowerType === 'employee' ? parsed.borrowerId : null,
    p_due_date: parsed.dueDate,
    p_issued_by: issuedByProfileId,
  });
  if (error) {
    if (error.message?.includes('copy_not_available')) {
      throw new ApiError('copy_not_available', 'This copy is not available — it may already be issued or reserved.');
    }
    throw new ApiError('issue_failed', error.message);
  }
  return issueId as string;
}

export async function returnBook(issueId: string, finePerDay: number) {
  const { data: fine, error } = await supabase.rpc('fn_return_book', { p_issue_id: issueId, p_fine_per_day: finePerDay });
  if (error) throw new ApiError('return_failed', error.message);
  return fine as number;
}

export async function reserveBook(bookId: string, borrowerType: 'student' | 'employee', borrowerId: string) {
  const { data, error } = await supabase
    .from('library_reservations')
    .insert({
      book_id: bookId,
      student_id: borrowerType === 'student' ? borrowerId : null,
      employee_profile_id: borrowerType === 'employee' ? borrowerId : null,
    })
    .select()
    .single();
  if (error) throw new ApiError(error.code ?? 'reserve_failed', error.message);
  return data;
}
