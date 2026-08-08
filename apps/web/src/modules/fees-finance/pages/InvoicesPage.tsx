// modules/fees-finance/pages/InvoicesPage.tsx
import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { RequirePermission } from '../../../core/rbac/RequirePermission';
import { PersonPicker } from '../../../components/ui/PersonPicker';
import { useInvoicesList, useCreateInvoice, useFeeCategories } from '../hooks/useFees';
import { invoiceSchema, type InvoiceInput } from '../schemas/fees.schema';
import { ApiError } from '../../organizations/api/mutations';

const PAGE_SIZE = 20;

export function InvoicesPage() {
  return (
    <RequirePermission perm="fees.view">
      <InvoicesContent />
    </RequirePermission>
  );
}

function InvoicesContent() {
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState('');
  const [showForm, setShowForm] = useState(false);
  const { data, isLoading } = useInvoicesList({ page, pageSize: PAGE_SIZE, status: status || undefined });
  const totalPages = data ? Math.max(1, Math.ceil(data.totalCount / PAGE_SIZE)) : 1;

  return (
    <div className="invoices-page">
      <div className="page-toolbar">
        <h1>Invoices</h1>
        <RequirePermission perm="fees.manage" fallback={null}>
          <button type="button" onClick={() => setShowForm((s) => !s)}>+ New invoice</button>
        </RequirePermission>
      </div>

      <div className="attendance-filters">
        <label>
          Status
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
        </label>
      </div>

      {showForm && <NewInvoiceForm onClose={() => setShowForm(false)} />}

      {isLoading ? (
        <p>Loading…</p>
      ) : (
        <>
          <table className="data-table">
            <thead>
              <tr><th>Invoice #</th><th>Student</th><th>Due date</th><th>Amount due</th><th>Paid</th><th>Status</th></tr>
            </thead>
            <tbody>
              {data?.rows.map((inv: any) => (
                <tr key={inv.id}>
                  <td className="mono-text"><Link to={`/fees/invoices/${inv.id}`}>{inv.invoice_number}</Link></td>
                  <td>{inv.student?.first_name} {inv.student?.last_name}</td>
                  <td>{new Date(inv.due_date).toLocaleDateString()}</td>
                  <td>{Number(inv.amount_due) + Number(inv.fine_amount)}</td>
                  <td>{inv.amount_paid}</td>
                  <td><span className="status-badge">{inv.status}</span></td>
                </tr>
              ))}
              {data?.rows.length === 0 && <tr><td colSpan={6} className="empty-state">No invoices found.</td></tr>}
            </tbody>
          </table>
          <div className="pagination">
            <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <span>Page {page + 1} of {totalPages}</span>
            <button type="button" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </>
      )}
    </div>
  );
}

function NewInvoiceForm({ onClose }: { onClose: () => void }) {
  const { data: categories } = useFeeCategories();
  const create = useCreateInvoice();
  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<InvoiceInput>({ resolver: zodResolver(invoiceSchema), defaultValues: { items: [{ feeCategoryId: '', amount: 0 }] } });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const studentId = watch('studentId');

  return (
    <form
      className="inline-form"
      onSubmit={handleSubmit(async (input) => {
        await create.mutateAsync(input);
        onClose();
      })}
    >
      <label>
        Student
        <PersonPicker type="student" value={studentId} onChange={(id) => setValue('studentId', id, { shouldValidate: true })} />
        {errors.studentId && <span role="alert">{errors.studentId.message}</span>}
      </label>
      <label>
        Due date
        <input type="date" {...register('dueDate')} />
        {errors.dueDate && <span role="alert">{errors.dueDate.message}</span>}
      </label>

      <h3>Line items</h3>
      {fields.map((field, index) => (
        <div className="form-row" key={field.id}>
          <label>
            Category
            <select {...register(`items.${index}.feeCategoryId`)}>
              <option value="">Select</option>
              {(categories ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>
            Amount
            <input type="number" step="0.01" {...register(`items.${index}.amount`)} />
          </label>
          <button type="button" onClick={() => remove(index)} disabled={fields.length === 1}>Remove</button>
        </div>
      ))}
      <button type="button" onClick={() => append({ feeCategoryId: '', amount: 0 })}>+ Add line item</button>
      {errors.items && <span role="alert">{errors.items.message as string}</span>}

      {create.isError && (
        <p role="alert" className="form-error">
          {create.error instanceof ApiError ? create.error.message : 'Could not create invoice. Please try again.'}
        </p>
      )}

      <div className="drawer-actions">
        <button type="button" onClick={onClose}>Cancel</button>
        <button type="submit" disabled={isSubmitting}>Create invoice</button>
      </div>
    </form>
  );
}
