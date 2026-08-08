// modules/reports/pages/ReportsHubPage.tsx
import { useState } from 'react';
import { useAuth } from '../../../core/auth/AuthContext';
import { RequirePermission } from '../../../core/rbac/RequirePermission';
import { ExportMenu } from '../../../components/ui/ExportMenu';
import { REPORT_DEFINITIONS } from '../api/reportDefinitions';

export function ReportsHubPage() {
  return (
    <RequirePermission perm="reports.export">
      <ReportsHubContent />
    </RequirePermission>
  );
}

function ReportsHubContent() {
  const { activeSchoolId } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<any[] | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = REPORT_DEFINITIONS.find((r) => r.id === selectedId);
  const grouped = Object.groupBy ? Object.groupBy(REPORT_DEFINITIONS, (r) => r.module) : groupByModule(REPORT_DEFINITIONS);

  const runReport = async () => {
    if (!selected || !activeSchoolId) return;
    setIsRunning(true);
    setError(null);
    try {
      const result = await selected.run(activeSchoolId, filterValues);
      setRows(result);
    } catch (err) {
      setError('Could not run this report. Please try again.');
      setRows(null);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="reports-hub-page">
      <h1>Reports</h1>
      <p className="field-hint">
        Reports run as you, so the same row-level permissions that apply everywhere else in the platform apply
        here too — you'll never see a report row you couldn't otherwise see in the app.
      </p>

      <div className="reports-layout">
        <nav className="reports-nav" aria-label="Available reports">
          {Object.entries(grouped).map(([module, defs]) => (
            <div key={module} className="reports-nav-group">
              <h3>{module}</h3>
              {(defs ?? []).map((def) => (
                <button
                  key={def.id}
                  type="button"
                  className={selectedId === def.id ? 'active' : ''}
                  onClick={() => {
                    setSelectedId(def.id);
                    setFilterValues({});
                    setRows(null);
                  }}
                >
                  {def.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="reports-main">
          {!selected ? (
            <p className="text-secondary">Select a report from the list.</p>
          ) : (
            <>
              <h2>{selected.label}</h2>
              <p className="text-secondary">{selected.description}</p>

              {selected.filters.length > 0 && (
                <div className="attendance-filters">
                  {selected.filters.map((filter) => (
                    <label key={filter.key}>
                      {filter.label}
                      <input
                        type={filter.type}
                        value={filterValues[filter.key] ?? ''}
                        onChange={(e) => setFilterValues((f) => ({ ...f, [filter.key]: e.target.value }))}
                      />
                    </label>
                  ))}
                </div>
              )}

              <button type="button" onClick={runReport} disabled={isRunning}>
                {isRunning ? 'Running…' : 'Run report'}
              </button>

              {error && <p role="alert" className="form-error">{error}</p>}

              {rows && (
                <>
                  <div className="page-toolbar" style={{ marginTop: 16 }}>
                    <span className="text-secondary">{rows.length} rows</span>
                    <ExportMenu filename={selected.id} title={selected.label} data={rows} columns={selected.columns} />
                  </div>
                  <table className="data-table">
                    <thead>
                      <tr>
                        {selected.columns.map((col) => <th key={col.header}>{col.header}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 100).map((row, i) => (
                        <tr key={i}>
                          {selected.columns.map((col) => <td key={col.header}>{col.accessor(row)}</td>)}
                        </tr>
                      ))}
                      {rows.length === 0 && (
                        <tr><td colSpan={selected.columns.length} className="empty-state">No rows returned.</td></tr>
                      )}
                    </tbody>
                  </table>
                  {rows.length > 100 && <p className="text-secondary">Showing first 100 of {rows.length} rows — export for the full set.</p>}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function groupByModule(defs: typeof REPORT_DEFINITIONS) {
  const result: Record<string, typeof REPORT_DEFINITIONS> = {};
  for (const def of defs) {
    result[def.module] = result[def.module] ?? [];
    result[def.module].push(def);
  }
  return result;
}
