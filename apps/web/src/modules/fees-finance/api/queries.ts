// modules/fees-finance/api/queries.ts
import { supabase } from '../../../core/supabase/client';

export async function listFeeCategories(schoolId: string) {
  const { data, error } = await supabase.from('fee_categories').select('*').eq('school_id', schoolId).order('name');
  if (error) throw error;
  return data;
}

export async function listFeeStructures(schoolId: string, academicYearId: string) {
  const { data, error } = await supabase
    .from('fee_structures')
    .select('*, class:classes(name), fee_category:fee_categories(name)')
    .eq('school_id', schoolId)
    .eq('academic_year_id', academicYearId);
  if (error) throw error;
  return data;
}

export async function listScholarships(schoolId: string) {
  const { data, error } = await supabase.from('scholarships').select('*').eq('school_id', schoolId).order('name');
  if (error) throw error;
  return data;
}

export interface ListInvoicesParams {
  schoolId: string;
  page: number;
  pageSize: number;
  status?: string;
  search?: string;
}

export async function listInvoices(params: ListInvoicesParams) {
  const { schoolId, page, pageSize, status, search } = params;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('fee_invoices')
    .select('*, student:students(first_name, last_name, student_code)', { count: 'exact' })
    .eq('school_id', schoolId);

  if (status) query = query.eq('status', status);
  if (search) {
    query = query.or(`student.first_name.ilike.%${search}%,student.last_name.ilike.%${search}%,invoice_number.ilike.%${search}%`);
  }

  query = query.order('due_date', { ascending: false }).range(from, to);
  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: data ?? [], totalCount: count ?? 0 };
}

export async function getInvoiceDetail(invoiceId: string) {
  const { data, error } = await supabase
    .from('fee_invoices')
    .select('*, student:students(first_name, last_name, student_code), fee_invoice_items(*, fee_category:fee_categories(name)), fee_payments(*)')
    .eq('id', invoiceId)
    .single();
  if (error) throw error;
  return data;
}

export async function getStudentFeePlan(studentId: string, academicYearId: string) {
  const { data, error } = await supabase
    .from('fee_plans')
    .select('*, fee_plan_items(*, fee_category:fee_categories(name))')
    .eq('student_id', studentId)
    .eq('academic_year_id', academicYearId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getLedgerEntries(schoolId: string, fromDate: string, toDate: string) {
  const { data, error } = await supabase
    .from('ledger_entries')
    .select('*')
    .eq('school_id', schoolId)
    .gte('entry_date', fromDate)
    .lte('entry_date', toDate)
    .order('entry_date', { ascending: false });
  if (error) throw error;
  return data;
}

/** Real "monthly revenue" aggregate — the direct data source for the
 * AI Finance Assistant (Phase 16) to eventually wrap in natural language. */
export async function getMonthlyFinancialSummary(schoolId: string, year: number) {
  const { data, error } = await supabase
    .from('ledger_entries')
    .select('entry_type, amount, entry_date')
    .eq('school_id', schoolId)
    .gte('entry_date', `${year}-01-01`)
    .lte('entry_date', `${year}-12-31`);
  if (error) throw error;

  const byMonth = new Map<number, { income: number; expense: number }>();
  for (let m = 1; m <= 12; m++) byMonth.set(m, { income: 0, expense: 0 });
  for (const row of data ?? []) {
    const month = new Date(row.entry_date).getMonth() + 1;
    const entry = byMonth.get(month)!;
    if (row.entry_type === 'income') entry.income += Number(row.amount);
    else entry.expense += Number(row.amount);
  }
  return Array.from(byMonth.entries()).map(([month, v]) => ({ month, ...v, net: v.income - v.expense }));
}
