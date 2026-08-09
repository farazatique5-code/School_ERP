// modules/fees-finance/api/mutations.ts
import { supabase } from '../../../core/supabase/client';
import { ApiError } from '../../organizations/api/mutations';
import {
  feeCategorySchema,
  feeStructureSchema,
  scholarshipSchema,
  invoiceSchema,
  paymentSchema,
  type FeeCategoryInput,
  type FeeStructureInput,
  type ScholarshipInput,
  type InvoiceInput,
  type PaymentInput,
} from '../schemas/fees.schema';

export async function createFeeCategory(schoolId: string, input: FeeCategoryInput) {
  const parsed = feeCategorySchema.parse(input);
  const { data, error } = await supabase.from('fee_categories').insert({ school_id: schoolId, name: parsed.name }).select().single();
  if (error) throw new ApiError(error.code ?? 'create_failed', error.message);
  return data;
}

export async function createFeeStructure(schoolId: string, academicYearId: string, input: FeeStructureInput) {
  const parsed = feeStructureSchema.parse(input);
  const { data, error } = await supabase
    .from('fee_structures')
    .insert({
      school_id: schoolId,
      academic_year_id: academicYearId,
      class_id: parsed.classId,
      fee_category_id: parsed.feeCategoryId,
      amount: parsed.amount,
      frequency: parsed.frequency,
    })
    .select()
    .single();
  if (error) {
    if (error.code === '23505') throw new ApiError('duplicate', 'This class already has this fee category set up for this year.');
    throw new ApiError(error.code ?? 'create_failed', error.message);
  }
  return data;
}

export async function createScholarship(schoolId: string, input: ScholarshipInput) {
  const parsed = scholarshipSchema.parse(input);
  const { data, error } = await supabase
    .from('scholarships')
    .insert({ school_id: schoolId, name: parsed.name, discount_type: parsed.discountType, discount_value: parsed.discountValue })
    .select()
    .single();
  if (error) throw new ApiError(error.code ?? 'create_failed', error.message);
  return data;
}

export async function assignScholarship(studentId: string, scholarshipId: string, academicYearId: string) {
  const { error } = await supabase
    .from('student_scholarships')
    .insert({ student_id: studentId, scholarship_id: scholarshipId, academic_year_id: academicYearId });
  if (error) {
    if (error.code === '23505') throw new ApiError('already_assigned', 'This student already has this scholarship for this year.');
    throw new ApiError(error.code ?? 'assign_failed', error.message);
  }
}

export async function generateFeePlanForStudent(studentId: string, classId: string, academicYearId: string) {
  const { data, error } = await supabase.rpc('generate_fee_plan', {
    p_student_id: studentId,
    p_class_id: classId,
    p_academic_year_id: academicYearId,
  });
  if (error) throw new ApiError('generate_failed', error.message);
  return data as string;
}

export async function createInvoice(organizationId: string, schoolId: string, input: InvoiceInput) {
  const parsed = invoiceSchema.parse(input);

  const { data: invoiceNumber, error: numberError } = await supabase.rpc('generate_invoice_number', { p_school_id: schoolId });
  if (numberError) throw new ApiError('number_generation_failed', numberError.message);

  const amountDue = parsed.items.reduce((sum, item) => sum + item.amount, 0);

  const { data: invoice, error: invoiceError } = await supabase
    .from('fee_invoices')
    .insert({
      organization_id: organizationId,
      school_id: schoolId,
      student_id: parsed.studentId,
      invoice_number: invoiceNumber,
      term_id: parsed.termId || null,
      due_date: parsed.dueDate,
      amount_due: amountDue,
    })
    .select()
    .single();
  if (invoiceError) throw new ApiError(invoiceError.code ?? 'create_failed', invoiceError.message);

  const { error: itemsError } = await supabase
    .from('fee_invoice_items')
    .insert(parsed.items.map((item) => ({ invoice_id: invoice.id, fee_category_id: item.feeCategoryId, amount: item.amount })));
  if (itemsError) {
    await supabase.from('fee_invoices').delete().eq('id', invoice.id); // compensating rollback
    throw new ApiError('items_failed', itemsError.message);
  }

  return invoice;
}

export async function recordPayment(schoolId: string, invoiceId: string, recordedByProfileId: string, input: PaymentInput) {
  const parsed = paymentSchema.parse(input);

  const { data: receiptNumber, error: numberError } = await supabase.rpc('generate_receipt_number', { p_school_id: schoolId });
  if (numberError) throw new ApiError('number_generation_failed', numberError.message);

  const { data, error } = await supabase
    .from('fee_payments')
    .insert({
      invoice_id: invoiceId,
      amount: parsed.amount,
      payment_date: parsed.paymentDate,
      payment_method: parsed.paymentMethod,
      transaction_reference: parsed.transactionReference || null,
      receipt_number: receiptNumber,
      recorded_by_profile_id: recordedByProfileId,
    })
    .select()
    .single();
  if (error) throw new ApiError(error.code ?? 'record_failed', error.message);
  return data;
}
