// modules/students/pages/StudentsListPage.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStudentsList } from '../hooks/useStudents';
import { RequirePermission } from '../../../core/rbac/RequirePermission';
import { ExportMenu } from '../../../components/ui/ExportMenu';
import type { StudentListFilter } from '../schemas/student.schema';
import { StudentFormDrawer } from '../components/StudentFormDrawer';

const PAGE_SIZE = 20;

export function StudentsListPage() {
  return (
    <RequirePermission perm="students.view">
      <StudentsListContent />
    </RequirePermission>
  );
}

function StudentsListContent() {
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<StudentListFilter>({});
  const [searchInput, setSearchInput] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data, isLoading, isFetching } = useStudentsList({ page, pageSize: PAGE_SIZE, filters });
  const totalPages = data ? Math.max(1, Math.ceil(data.totalCount / PAGE_SIZE)) : 1;

  const applySearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    setFilters((f) => ({ ...f, search: searchInput || undefined }));
  };

  return (
    <div className="students-list-page">
      <div className="page-toolbar">
        <h1>Students</h1>
        <div className="toolbar-actions">
          <ExportMenu
            filename="students"
            title="Students"
            data={data?.rows ?? []}
            columns={[
              { header: 'Student code', accessor: (r) => r.studentCode },
              { header: 'First name', accessor: (r) => r.firstName },
              { header: 'Last name', accessor: (r) => r.lastName },
              { header: 'Class', accessor: (r) => r.className ?? '' },
              { header: 'Section', accessor: (r) => r.sectionName ?? '' },
              { header: 'Status', accessor: (r) => r.status },
            ]}
          />
          <RequirePermission perm="students.create" fallback={null}>
            <button type="button" onClick={() => setDrawerOpen(true)}>
              + Add student
            </button>
          </RequirePermission>
        </div>
      </div>

      <form onSubmit={applySearch} className="list-search-bar">
        <input
          type="search"
          placeholder="Search by name or student code…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <select
          value={filters.status ?? ''}
          onChange={(e) => {
            setPage(0);
            setFilters((f) => ({ ...f, status: (e.target.value || undefined) as StudentListFilter['status'] }));
          }}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="graduated">Graduated</option>
          <option value="transferred_out">Transferred out</option>
        </select>
        <button type="submit">Search</button>
      </form>

      {isLoading ? (
        <p>Loading…</p>
      ) : (
        <>
          <table className="data-table" style={{ opacity: isFetching ? 0.6 : 1 }}>
            <thead>
              <tr>
                <th>Photo</th>
                <th>Name</th>
                <th>Student code</th>
                <th>Class / Section</th>
                <th>Roll no.</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data?.rows.map((student) => (
                <tr key={student.id}>
                  <td>
                    {student.photoUrl ? (
                      <img src={student.photoUrl} alt="" className="avatar-sm" />
                    ) : (
                      <span className="avatar-placeholder">
                        {student.firstName[0]}
                        {student.lastName[0]}
                      </span>
                    )}
                  </td>
                  <td>
                    <Link to={`/students/${student.id}`}>
                      {student.firstName} {student.lastName}
                    </Link>
                  </td>
                  <td className="mono-text">{student.studentCode}</td>
                  <td>
                    {student.className ?? '—'} {student.sectionName ? `/ ${student.sectionName}` : ''}
                  </td>
                  <td>{student.rollNumber ?? '—'}</td>
                  <td>
                    <span className={`status-badge ${student.status === 'active' ? 'status-active' : 'status-inactive'}`}>
                      {student.status}
                    </span>
                  </td>
                </tr>
              ))}
              {data?.rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-state">No students match your filters.</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="pagination">
            <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <span>
              Page {page + 1} of {totalPages} · {data?.totalCount ?? 0} students
            </span>
            <button type="button" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        </>
      )}

      {drawerOpen && <StudentFormDrawer onClose={() => setDrawerOpen(false)} />}
    </div>
  );
}
