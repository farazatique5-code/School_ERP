// modules/fees-finance/pages/FinancialReportsPage.tsx
import { useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { RequirePermission } from '../../../core/rbac/RequirePermission';
import { useLedgerEntries, useMonthlyFinancialSummary } from '../hooks/useFees';

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function FinancialReportsPage() {
  return (
    <RequirePermission perm="fees.view_reports">
      <FinancialReportsContent />
    </RequirePermission>
  );
}

function FinancialReportsContent() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [fromDate, setFromDate] = useState(daysAgo(30));
  const [toDate, setToDate] = useState(daysAgo(0));
  const { data: summary, isLoading: summaryLoading } = useMonthlyFinancialSummary(year);
  const { data: ledger, isLoading: ledgerLoading } = useLedgerEntries(fromDate, toDate);

  const totalIncome = (summary ?? []).reduce((sum, m) => sum + m.income, 0);
  const totalExpense = (summary ?? []).reduce((sum, m) => sum + m.expense, 0);

  return (
    <div className="financial-reports-page">
      <h1>Financial Reports</h1>

      <section className="card">
        <div className="page-toolbar">
          <h2>Monthly summary</h2>
          <label>
            Year
            <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ width: 80, marginLeft: 8 }} />
          </label>
        </div>

        <div className="kpi-grid">
          <div className="kpi-card"><span className="kpi-label">Total income</span><span className="kpi-value">{totalIncome.toFixed(2)}</span></div>
          <div className="kpi-card"><span className="kpi-label">Total expense</span><span className="kpi-value">{totalExpense.toFixed(2)}</span></div>
          <div className="kpi-card" data-tone={totalIncome - totalExpense < 0 ? 'warning' : 'default'}>
            <span className="kpi-label">Net</span><span className="kpi-value">{(totalIncome - totalExpense).toFixed(2)}</span>
          </div>
        </div>

        {summaryLoading ? (
          <p>Loading…</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={summary ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border-default))" />
              <XAxis dataKey="month" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Legend />
              <Bar dataKey="income" name="Income" fill="hsl(142 71% 45%)" />
              <Bar dataKey="expense" name="Expense" fill="hsl(0 84% 60%)" />
            </BarChart>
          </ResponsiveContainer>
        )}

        <ResponsiveContainer width="100%" height={200} style={{ marginTop: 12 }}>
          <LineChart data={summary ?? []}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border-default))" />
            <XAxis dataKey="month" fontSize={11} />
            <YAxis fontSize={11} />
            <Tooltip />
            <Line type="monotone" dataKey="net" name="Net cash flow" stroke="hsl(var(--brand-primary))" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="page-toolbar">
          <h2>Cash book</h2>
          <div className="attendance-filters" style={{ marginBottom: 0 }}>
            <label>From <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></label>
            <label>To <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /></label>
          </div>
        </div>

        {ledgerLoading ? (
          <p>Loading…</p>
        ) : (
          <table className="data-table">
            <thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Amount</th><th>Description</th></tr></thead>
            <tbody>
              {(ledger ?? []).map((entry: any) => (
                <tr key={entry.id}>
                  <td>{new Date(entry.entry_date).toLocaleDateString()}</td>
                  <td><span className={`status-badge action-${entry.entry_type === 'income' ? 'insert' : 'delete'}`}>{entry.entry_type}</span></td>
                  <td>{entry.category}</td>
                  <td>{entry.amount}</td>
                  <td>{entry.description ?? '—'}</td>
                </tr>
              ))}
              {ledger?.length === 0 && <tr><td colSpan={5} className="empty-state">No entries in this range.</td></tr>}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
