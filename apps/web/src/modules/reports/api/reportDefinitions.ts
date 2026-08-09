// modules/reports/api/reportDefinitions.ts
import { supabase } from '../../../core/supabase/client';
import type { ExportColumn } from '../../../lib/export';

export interface ReportFilter {
  key: string;
  label: string;
  type: 'date' | 'text';
}

export interface ReportDefinition {
  id: string;
  label: string;
  module: string;
  description: string;
  filters: ReportFilter[];
  run: (schoolId: string, filterValues: Record<string, string>) => Promise<any[]>;
  columns: ExportColumn<any>[];
}

// A generic SQL/query builder exposed to end users would let them
// construct arbitrary queries against RLS-protected tables — a real
// attack surface, not just a UX shortcut. Registering specific, reviewed
// queries here (still executed as the signed-in user, so RLS still
// fully applies) is the responsible version of "Custom Report Builder."
export const REPORT_DEFINITIONS: ReportDefinition[] = [
  {
    id: 'students',
    label: 'Student Roster',
    module: 'Academics',
    description: 'All active students with class, section, and status.',
    filters: [],
    run: async (schoolId) => {
      const { data, error } = await supabase
        .from('students')
        .select('student_code, first_name, last_name, status, student_enrollments(class:classes(name), section:sections(name))')
        .eq('school_id', schoolId)
        .is('deleted_at', null);
      if (error) throw error;
      return (data ?? []).map((s: any) => ({
        code: s.student_code,
        name: `${s.first_name} ${s.last_name}`,
        class: s.student_enrollments?.[0]?.class?.name ?? '',
        section: s.student_enrollments?.[0]?.section?.name ?? '',
        status: s.status,
      }));
    },
    columns: [
      { header: 'Code', accessor: (r) => r.code },
      { header: 'Name', accessor: (r) => r.name },
      { header: 'Class', accessor: (r) => r.class },
      { header: 'Section', accessor: (r) => r.section },
      { header: 'Status', accessor: (r) => r.status },
    ],
  },
  {
    id: 'attendance-summary',
    label: 'Attendance Summary',
    module: 'Attendance',
    description: 'Per-section daily attendance counts within a date range.',
    filters: [
      { key: 'from', label: 'From', type: 'date' },
      { key: 'to', label: 'To', type: 'date' },
    ],
    run: async (schoolId, filters) => {
      let query = supabase.from('attendance_daily_stats').select('*').eq('school_id', schoolId);
      if (filters.from) query = query.gte('attendance_date', filters.from);
      if (filters.to) query = query.lte('attendance_date', filters.to);
      const { data, error } = await query.order('attendance_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    columns: [
      { header: 'Date', accessor: (r) => r.attendance_date },
      { header: 'Present', accessor: (r) => r.present_count },
      { header: 'Absent', accessor: (r) => r.absent_count },
      { header: 'Late', accessor: (r) => r.late_count },
      { header: 'Excused', accessor: (r) => r.excused_count },
    ],
  },
  {
    id: 'fee-collection',
    label: 'Fee Collection',
    module: 'Finance',
    description: 'Payments recorded within a date range.',
    filters: [
      { key: 'from', label: 'From', type: 'date' },
      { key: 'to', label: 'To', type: 'date' },
    ],
    run: async (schoolId, filters) => {
      let query = supabase
        .from('fee_payments')
        .select('receipt_number, amount, payment_date, payment_method, invoice:fee_invoices!inner(invoice_number, school_id, student:students(first_name, last_name))')
        .eq('invoice.school_id', schoolId);
      if (filters.from) query = query.gte('payment_date', filters.from);
      if (filters.to) query = query.lte('payment_date', filters.to);
      const { data, error } = await query.order('payment_date', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((p: any) => ({
        receipt: p.receipt_number,
        invoice: p.invoice?.invoice_number,
        student: `${p.invoice?.student?.first_name ?? ''} ${p.invoice?.student?.last_name ?? ''}`,
        amount: p.amount,
        date: p.payment_date,
        method: p.payment_method,
      }));
    },
    columns: [
      { header: 'Receipt #', accessor: (r) => r.receipt },
      { header: 'Invoice #', accessor: (r) => r.invoice },
      { header: 'Student', accessor: (r) => r.student },
      { header: 'Amount', accessor: (r) => r.amount },
      { header: 'Date', accessor: (r) => r.date },
      { header: 'Method', accessor: (r) => r.method },
    ],
  },
  {
    id: 'exam-performance',
    label: 'Exam Performance',
    module: 'Examination',
    description: 'Section rankings for published exams.',
    filters: [],
    run: async (schoolId) => {
      const { data, error } = await supabase
        .from('exam_rankings')
        .select('rank_in_section, total_marks, total_max_marks, percentage, exam:exams!inner(name, school_id), student:students(first_name, last_name, student_code)')
        .eq('exam.school_id', schoolId)
        .order('rank_in_section');
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        exam: r.exam?.name,
        student: `${r.student?.first_name} ${r.student?.last_name}`,
        code: r.student?.student_code,
        total: `${r.total_marks}/${r.total_max_marks}`,
        percentage: r.percentage,
        rank: r.rank_in_section,
      }));
    },
    columns: [
      { header: 'Exam', accessor: (r) => r.exam },
      { header: 'Student', accessor: (r) => r.student },
      { header: 'Code', accessor: (r) => r.code },
      { header: 'Total', accessor: (r) => r.total },
      { header: 'Percentage', accessor: (r) => r.percentage },
      { header: 'Rank', accessor: (r) => r.rank },
    ],
  },
  {
    id: 'employees',
    label: 'Employee Directory',
    module: 'HR',
    description: 'All staff with designation, department, and status.',
    filters: [],
    run: async (schoolId) => {
      const { data, error } = await supabase
        .from('employees')
        .select('employee_code, designation, employment_type, employment_status, profile:profiles(full_name, email), department:departments(name)')
        .eq('school_id', schoolId);
      if (error) throw error;
      return (data ?? []).map((e: any) => ({
        code: e.employee_code,
        name: e.profile?.full_name,
        email: e.profile?.email,
        designation: e.designation,
        department: e.department?.name ?? '',
        type: e.employment_type,
        status: e.employment_status,
      }));
    },
    columns: [
      { header: 'Code', accessor: (r) => r.code },
      { header: 'Name', accessor: (r) => r.name },
      { header: 'Email', accessor: (r) => r.email },
      { header: 'Designation', accessor: (r) => r.designation },
      { header: 'Department', accessor: (r) => r.department },
      { header: 'Type', accessor: (r) => r.type },
      { header: 'Status', accessor: (r) => r.status },
    ],
  },
  {
    id: 'inventory-stock',
    label: 'Inventory Stock Levels',
    module: 'Inventory',
    description: 'Current stock quantity per item and location.',
    filters: [],
    run: async (schoolId) => {
      const { data, error } = await supabase
        .from('inventory_stock')
        .select('quantity, item:inventory_items!inner(name, school_id, unit_of_measure, reorder_level), location:inventory_locations(name)')
        .eq('item.school_id', schoolId);
      if (error) throw error;
      return (data ?? []).map((s: any) => ({
        item: s.item?.name,
        location: s.location?.name,
        quantity: s.quantity,
        unit: s.item?.unit_of_measure,
        lowStock: s.item?.reorder_level != null && s.quantity <= s.item.reorder_level ? 'Yes' : 'No',
      }));
    },
    columns: [
      { header: 'Item', accessor: (r) => r.item },
      { header: 'Location', accessor: (r) => r.location },
      { header: 'Quantity', accessor: (r) => r.quantity },
      { header: 'Unit', accessor: (r) => r.unit },
      { header: 'Low stock?', accessor: (r) => r.lowStock },
    ],
  },
  {
    id: 'library-circulation',
    label: 'Library Circulation',
    module: 'Library',
    description: 'Active and overdue book loans.',
    filters: [],
    run: async (schoolId) => {
      const { data, error } = await supabase
        .from('library_issues')
        .select('issue_date, due_date, status, book_copy:library_book_copies!inner(barcode, book:library_books!inner(title, school_id)), student:students(first_name, last_name)')
        .eq('book_copy.book.school_id', schoolId)
        .in('status', ['issued', 'overdue']);
      if (error) throw error;
      return (data ?? []).map((i: any) => ({
        book: i.book_copy?.book?.title,
        barcode: i.book_copy?.barcode,
        borrower: i.student ? `${i.student.first_name} ${i.student.last_name}` : 'Staff',
        issued: i.issue_date,
        due: i.due_date,
        status: i.status,
      }));
    },
    columns: [
      { header: 'Book', accessor: (r) => r.book },
      { header: 'Barcode', accessor: (r) => r.barcode },
      { header: 'Borrower', accessor: (r) => r.borrower },
      { header: 'Issued', accessor: (r) => r.issued },
      { header: 'Due', accessor: (r) => r.due },
      { header: 'Status', accessor: (r) => r.status },
    ],
  },
  {
    id: 'transport-allocation',
    label: 'Transport Allocation',
    module: 'Transport',
    description: 'Students allocated to routes and stops.',
    filters: [],
    run: async (schoolId) => {
      const { data, error } = await supabase
        .from('student_transport_allocations')
        .select('status, student:students!inner(first_name, last_name, school_id), route:transport_routes(name), stop:transport_stops(name, pickup_time)')
        .eq('student.school_id', schoolId)
        .eq('status', 'active');
      if (error) throw error;
      return (data ?? []).map((a: any) => ({
        student: `${a.student?.first_name} ${a.student?.last_name}`,
        route: a.route?.name,
        stop: a.stop?.name,
        pickup: a.stop?.pickup_time ?? '',
      }));
    },
    columns: [
      { header: 'Student', accessor: (r) => r.student },
      { header: 'Route', accessor: (r) => r.route },
      { header: 'Stop', accessor: (r) => r.stop },
      { header: 'Pickup time', accessor: (r) => r.pickup },
    ],
  },
];
