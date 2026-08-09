// modules/admissions/pages/ApplicationsPage.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RequirePermission } from '../../../core/rbac/RequirePermission';
import { usePipelineCounts, useApplicationsList } from '../hooks/useAdmissions';
import { APPLICATION_STATUSES, type ApplicationListFilter } from '../schemas/admission.schema';
import { NewApplicationDrawer } from '../components/NewApplicationDrawer';

const PAGE_SIZE = 20;
const STATUS_LABELS: Record<string, string> = {
  submitted: 'Submitted',
  under_review: 'Under review',
  interview_scheduled: 'Interview scheduled',
  approved: 'Approved',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

export function ApplicationsPage() {
  return (
    <RequirePermission perm="admissions.view">
      <ApplicationsPageContent />
    </RequirePermission>
  );
}

function ApplicationsPageContent() {
  const [view, setView] = useState<'pipeline' | 'list'>('pipeline');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data: counts } = usePipelineCounts();

  return (
    <div className="admissions-page">
      <div className="page-toolbar">
        <h1>Admissions</h1>
        <div className="toolbar-actions">
          <div className="view-toggle">
            <button type="button" className={view === 'pipeline' ? 'active' : ''} onClick={() => setView('pipeline')}>
              Pipeline
            </button>
            <button type="button" className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>
              List
            </button>
          </div>
          <RequirePermission perm="admissions.manage" fallback={null}>
            <button type="button" onClick={() => setDrawerOpen(true)}>
              + New application
            </button>
          </RequirePermission>
        </div>
      </div>

      {view === 'pipeline' ? <PipelineBoard counts={counts} /> : <ApplicationsTable />}

      {drawerOpen && <NewApplicationDrawer onClose={() => setDrawerOpen(false)} />}
    </div>
  );
}

function PipelineBoard({ counts }: { counts: Record<string, number> | undefined }) {
  return (
    <div className="pipeline-board">
      {APPLICATION_STATUSES.map((status) => (
        <div key={status} className="pipeline-column">
          <div className="pipeline-column-header">
            <span>{STATUS_LABELS[status]}</span>
            <span className="pipeline-count">{counts?.[status] ?? 0}</span>
          </div>
          <PipelineColumnList status={status} />
        </div>
      ))}
    </div>
  );
}

function PipelineColumnList({ status }: { status: string }) {
  const { data } = useApplicationsList({
    page: 0,
    pageSize: 10,
    filters: { status: status as ApplicationListFilter['status'] },
  });

  return (
    <div className="pipeline-column-body">
      {(data?.rows ?? []).map((app: any) => (
        <Link key={app.id} to={`/admissions/${app.id}`} className="pipeline-card">
          <strong>
            {app.first_name} {app.last_name}
          </strong>
          <span className="text-secondary">{app.applying_for_class?.name}</span>
          <span className="mono-text">{app.application_number}</span>
        </Link>
      ))}
      {data?.rows.length === 0 && <p className="text-secondary pipeline-empty">None</p>}
    </div>
  );
}

function ApplicationsTable() {
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<ApplicationListFilter>({});
  const [searchInput, setSearchInput] = useState('');
  const { data, isLoading } = useApplicationsList({ page, pageSize: PAGE_SIZE, filters });
  const totalPages = data ? Math.max(1, Math.ceil(data.totalCount / PAGE_SIZE)) : 1;

  return (
    <div>
      <form
        className="list-search-bar"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(0);
          setFilters((f) => ({ ...f, search: searchInput || undefined }));
        }}
      >
        <input
          type="search"
          placeholder="Search by name or application number…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <select
          value={filters.status ?? ''}
          onChange={(e) => {
            setPage(0);
            setFilters((f) => ({ ...f, status: (e.target.value || undefined) as ApplicationListFilter['status'] }));
          }}
        >
          <option value="">All statuses</option>
          {APPLICATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <button type="submit">Search</button>
      </form>

      {isLoading ? (
        <p>Loading…</p>
      ) : (
        <>
          <table className="data-table">
            <thead>
              <tr>
                <th>Application #</th>
                <th>Name</th>
                <th>Applying for</th>
                <th>Submitted</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data?.rows.map((app: any) => (
                <tr key={app.id}>
                  <td className="mono-text">{app.application_number}</td>
                  <td>
                    <Link to={`/admissions/${app.id}`}>
                      {app.first_name} {app.last_name}
                    </Link>
                  </td>
                  <td>{app.applying_for_class?.name}</td>
                  <td>{new Date(app.submitted_at).toLocaleDateString()}</td>
                  <td>
                    <span className="status-badge">{STATUS_LABELS[app.status]}</span>
                  </td>
                </tr>
              ))}
              {data?.rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-state">No applications match your filters.</td>
                </tr>
              )}
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
