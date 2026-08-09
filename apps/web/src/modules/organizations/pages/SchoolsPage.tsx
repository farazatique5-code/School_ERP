// modules/organizations/pages/SchoolsPage.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { schoolSchema, type SchoolInput } from '../schemas/school.schema';
import { useSchoolsList, useCreateSchool, useUpdateSchool, useArchiveSchool } from '../hooks/useSchools';
import { RequirePermission } from '../../../core/rbac/RequirePermission';
import { ApiError } from '../api/mutations';

export function SchoolsPage() {
  return (
    <RequirePermission perm="schools.manage">
      <SchoolsPageContent />
    </RequirePermission>
  );
}

function SchoolsPageContent() {
  const { data: schools, isLoading } = useSchoolsList();
  const [drawerState, setDrawerState] = useState<{ open: boolean; editingId: string | null }>({
    open: false,
    editingId: null,
  });
  const archive = useArchiveSchool();

  return (
    <div className="schools-page">
      <div className="page-toolbar">
        <h1>Schools & Campuses</h1>
        <button type="button" onClick={() => setDrawerState({ open: true, editingId: null })}>
          + Add school
        </button>
      </div>

      {isLoading ? (
        <p>Loading…</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Code</th>
              <th>Type</th>
              <th>City</th>
              <th>Status</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {(schools ?? []).map((school) => (
              <tr key={school.id}>
                <td>{school.name}</td>
                <td>{school.code}</td>
                <td>{school.type}</td>
                <td>{school.city ?? '—'}</td>
                <td>
                  <span className={`status-badge ${school.is_active ? 'status-active' : 'status-inactive'}`}>
                    {school.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="row-actions">
                  <button type="button" onClick={() => setDrawerState({ open: true, editingId: school.id })}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => {
                      if (confirm(`Archive ${school.name}? It will stop appearing in active lists.`)) {
                        archive.mutate(school.id);
                      }
                    }}
                  >
                    Archive
                  </button>
                </td>
              </tr>
            ))}
            {schools?.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-state">
                  No schools yet — add your first campus.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {drawerState.open && (
        <SchoolFormDrawer
          editingId={drawerState.editingId}
          existing={schools?.find((s) => s.id === drawerState.editingId)}
          onClose={() => setDrawerState({ open: false, editingId: null })}
        />
      )}
    </div>
  );
}

function SchoolFormDrawer({
  editingId,
  existing,
  onClose,
}: {
  editingId: string | null;
  existing?: SchoolInput & { id: string };
  onClose: () => void;
}) {
  const create = useCreateSchool();
  const update = useUpdateSchool(editingId ?? '');
  const mutation = editingId ? update : create;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SchoolInput>({
    resolver: zodResolver(schoolSchema),
    defaultValues: existing ?? { type: 'school', timezone: 'UTC' },
  });

  const onSubmit = async (input: SchoolInput) => {
    try {
      await mutation.mutateAsync(input);
      onClose();
    } catch {
      // surfaced below via mutation.error
    }
  };

  return (
    <div className="drawer-overlay" role="dialog" aria-modal="true" aria-label={editingId ? 'Edit school' : 'Add school'}>
      <div className="drawer">
        <h2>{editingId ? 'Edit school' : 'Add school'}</h2>
        <form onSubmit={handleSubmit(onSubmit)}>
          <label>
            Name
            <input {...register('name')} />
            {errors.name && <span role="alert">{errors.name.message}</span>}
          </label>
          <label>
            Code
            <input {...register('code')} style={{ textTransform: 'uppercase' }} />
            {errors.code && <span role="alert">{errors.code.message}</span>}
          </label>
          <label>
            Type
            <select {...register('type')}>
              <option value="school">School</option>
              <option value="college">College</option>
              <option value="academy">Academy</option>
              <option value="campus">Campus</option>
            </select>
          </label>
          <label>
            Address
            <input {...register('address')} />
          </label>
          <div className="form-row">
            <label>
              City
              <input {...register('city')} />
            </label>
            <label>
              State
              <input {...register('state')} />
            </label>
            <label>
              Country
              <input {...register('country')} />
            </label>
          </div>
          <div className="form-row">
            <label>
              Phone
              <input {...register('phone')} />
            </label>
            <label>
              Email
              <input type="email" {...register('email')} />
              {errors.email && <span role="alert">{errors.email.message}</span>}
            </label>
          </div>

          {mutation.isError && (
            <p role="alert" className="form-error">
              {mutation.error instanceof ApiError ? mutation.error.message : 'Could not save. Please try again.'}
            </p>
          )}

          <div className="drawer-actions">
            <button type="button" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
