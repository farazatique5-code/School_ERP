// modules/portals/pages/PortalFeesPage.tsx
import { useActiveChild } from '../context/ActiveChildContext';
import { usePortalInvoices } from '../hooks/usePortal';

export function PortalFeesPage() {
  const { activeChild } = useActiveChild();
  const { data: invoices, isLoading } = usePortalInvoices(activeChild?.id);

  if (isLoading) return <p>Loading…</p>;

  const totalOutstanding = (invoices ?? []).reduce((sum, inv: any) => {
    const balance = Number(inv.amount_due) + Number(inv.fine_amount) - Number(inv.amount_paid);
    return sum + Math.max(0, balance);
  }, 0);

  return (
    <div className="portal-fees-page">
      <h1>Fees</h1>
      <div className="card portal-summary-card" data-tone={totalOutstanding > 0 ? 'warning' : 'default'}>
        <span className="kpi-label">Total outstanding</span>
        <span className="kpi-value">{totalOutstanding.toFixed(2)}</span>
      </div>

      <ul className="portal-list">
        {(invoices ?? []).map((inv: any) => (
          <li key={inv.id} className="portal-invoice-item">
            <div>
              <strong>{inv.invoice_number}</strong>
              <div className="text-secondary">Due {new Date(inv.due_date).toLocaleDateString()}</div>
            </div>
            <div>
              <span className="status-badge">{inv.status}</span>
              <div className="text-secondary">{inv.amount_paid} / {Number(inv.amount_due) + Number(inv.fine_amount)}</div>
            </div>
          </li>
        ))}
        {invoices?.length === 0 && <li className="text-secondary">No invoices yet.</li>}
      </ul>

      <p className="field-hint">
        Online payment isn't wired to a payment gateway yet (see Phase 9's README) — invoices are settled in person
        or by whatever channel your school currently uses, and recorded by staff.
      </p>
    </div>
  );
}
