// modules/fees-finance/pages/InvoiceDetailPage.tsx
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RequirePermission } from '../../../core/rbac/RequirePermission';
import { useInvoiceDetail, useRecordPayment } from '../hooks/useFees';
import { exportDocumentToPdf } from '../../../lib/export';
import { paymentSchema, type PaymentInput } from '../schemas/fees.schema';
import { ApiError } from '../../organizations/api/mutations';

export function InvoiceDetailPage() {
  return (
    <RequirePermission perm="fees.view">
      <InvoiceDetailContent />
    </RequirePermission>
  );
}

function InvoiceDetailContent() {
  const { id } = useParams<{ id: string }>();
  const { data: invoice, isLoading } = useInvoiceDetail(id);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const recordPayment = useRecordPayment(id ?? '');

  if (isLoading) return <p>Loading…</p>;
  if (!invoice) return <p>Invoice not found.</p>;

  const totalDue = Number(invoice.amount_due) + Number(invoice.fine_amount);
  const balance = totalDue - Number(invoice.amount_paid);

  return (
    <div className="invoice-detail-page">
      <header className="student-detail-header">
        <div>
          <h1>{invoice.invoice_number}</h1>
          <p className="text-secondary">{invoice.student?.first_name} {invoice.student?.last_name}</p>
        </div>
        <span className="status-badge">{invoice.status}</span>
      </header>

      <button
        type="button"
        onClick={() =>
          exportDocumentToPdf({
            filename: invoice.invoice_number,
            title: `Invoice ${invoice.invoice_number}`,
            subtitle: `${invoice.student?.first_name} ${invoice.student?.last_name} · Due ${new Date(invoice.due_date).toLocaleDateString()}`,
            keyValuePairs: [
              ['Amount due', String(invoice.amount_due)],
              ['Fine', String(invoice.fine_amount)],
              ['Paid', String(invoice.amount_paid)],
              ['Balance', String(balance)],
              ['Status', invoice.status],
            ],
            tableHead: ['Category', 'Amount'],
            tableRows: (invoice.fee_invoice_items ?? []).map((item: any) => [item.fee_category?.name ?? '', item.amount]),
            footerLines: (invoice.fee_payments ?? []).length
              ? ['Payments:', ...invoice.fee_payments.map((p: any) => `${p.receipt_number} — ${p.amount} (${p.payment_method}) on ${new Date(p.payment_date).toLocaleDateString()}`)]
              : [],
          })
        }
        style={{ marginBottom: 16 }}
      >
        Download PDF
      </button>

      <div className="card">
        <div className="kpi-grid">
          <div className="kpi-card"><span className="kpi-label">Amount due</span><span className="kpi-value">{invoice.amount_due}</span></div>
          <div className="kpi-card"><span className="kpi-label">Fine</span><span className="kpi-value">{invoice.fine_amount}</span></div>
          <div className="kpi-card"><span className="kpi-label">Paid</span><span className="kpi-value">{invoice.amount_paid}</span></div>
          <div className="kpi-card" data-tone={balance > 0 ? 'warning' : 'default'}><span className="kpi-label">Balance</span><span className="kpi-value">{balance}</span></div>
        </div>

        <h2>Line items</h2>
        <table className="data-table">
          <thead><tr><th>Category</th><th>Amount</th></tr></thead>
          <tbody>
            {(invoice.fee_invoice_items ?? []).map((item: any) => (
              <tr key={item.id}><td>{item.fee_category?.name}</td><td>{item.amount}</td></tr>
            ))}
          </tbody>
        </table>

        {balance > 0 && (
          <RequirePermission perm="fees.collect" fallback={null}>
            <button type="button" onClick={() => setShowPaymentForm((s) => !s)} style={{ marginTop: 12 }}>
              + Record payment
            </button>
          </RequirePermission>
        )}

        {showPaymentForm && (
          <PaymentForm
            maxAmount={balance}
            onSubmit={async (input) => {
              await recordPayment.mutateAsync(input);
              setShowPaymentForm(false);
            }}
            onClose={() => setShowPaymentForm(false)}
            error={recordPayment.error}
          />
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Payment history</h2>
        <table className="data-table">
          <thead><tr><th>Receipt #</th><th>Date</th><th>Amount</th><th>Method</th></tr></thead>
          <tbody>
            {(invoice.fee_payments ?? []).map((p: any) => (
              <tr key={p.id}>
                <td className="mono-text">{p.receipt_number}</td>
                <td>{new Date(p.payment_date).toLocaleDateString()}</td>
                <td>{p.amount}</td>
                <td>{p.payment_method.replace('_', ' ')}</td>
              </tr>
            ))}
            {invoice.fee_payments?.length === 0 && <tr><td colSpan={4} className="empty-state">No payments recorded yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PaymentForm({
  maxAmount,
  onSubmit,
  onClose,
  error,
}: {
  maxAmount: number;
  onSubmit: (input: PaymentInput) => Promise<void>;
  onClose: () => void;
  error: unknown;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PaymentInput>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { paymentDate: new Date().toISOString().slice(0, 10), paymentMethod: 'cash', amount: maxAmount },
  });

  return (
    <form className="inline-form" onSubmit={handleSubmit(onSubmit)}>
      <div className="form-row">
        <label>
          Amount
          <input type="number" step="0.01" max={maxAmount} {...register('amount')} />
          {errors.amount && <span role="alert">{errors.amount.message}</span>}
        </label>
        <label>
          Date
          <input type="date" {...register('paymentDate')} />
        </label>
      </div>
      <div className="form-row">
        <label>
          Method
          <select {...register('paymentMethod')}>
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="card">Card</option>
            <option value="online">Online</option>
            <option value="cheque">Cheque</option>
          </select>
        </label>
        <label>
          Reference (optional)
          <input {...register('transactionReference')} />
        </label>
      </div>

      {!!error && (
        <p role="alert" className="form-error">
          {error instanceof ApiError ? error.message : 'Could not record payment. Please try again.'}
        </p>
      )}

      <div className="drawer-actions">
        <button type="button" onClick={onClose}>Cancel</button>
        <button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Recording…' : 'Record payment'}</button>
      </div>
    </form>
  );
}
