// modules/library/pages/CirculationPage.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RequirePermission } from '../../../core/rbac/RequirePermission';
import { PersonPicker } from '../../../components/ui/PersonPicker';
import { useFindCopyByBarcode, useIssueBook, useReturnBook, useActiveIssues } from '../hooks/useLibrary';
import { issueSchema, type IssueInput } from '../schemas/library.schema';
import { ApiError } from '../../organizations/api/mutations';

const DEFAULT_LOAN_DAYS = 14;
const DEFAULT_FINE_PER_DAY = 0.5;

export function CirculationPage() {
  return (
    <RequirePermission perm="library.manage">
      <CirculationContent />
    </RequirePermission>
  );
}

function CirculationContent() {
  return (
    <div className="circulation-page">
      <h1>Circulation</h1>
      <div className="circulation-grid">
        <IssueBookPanel />
        <ActiveIssuesPanel />
      </div>
    </div>
  );
}

function IssueBookPanel() {
  const findCopy = useFindCopyByBarcode();
  const issue = useIssueBook();
  const [foundCopy, setFoundCopy] = useState<any>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<IssueInput>({
    resolver: zodResolver(issueSchema),
    defaultValues: {
      borrowerType: 'student',
      dueDate: new Date(Date.now() + DEFAULT_LOAN_DAYS * 86400000).toISOString().slice(0, 10),
    },
  });

  const barcode = watch('barcode');
  const borrowerType = watch('borrowerType');
  const borrowerId = watch('borrowerId');

  const handleLookup = async () => {
    if (!barcode) return;
    try {
      const copy = await findCopy.mutateAsync(barcode);
      setFoundCopy(copy);
    } catch {
      setFoundCopy(null);
    }
  };

  return (
    <div className="card">
      <h2>Issue a book</h2>
      <form
        onSubmit={handleSubmit(async (input) => {
          await issue.mutateAsync(input);
          reset();
          setFoundCopy(null);
        })}
      >
        <label>
          Barcode
          <div className="input-with-suffix">
            <input {...register('barcode')} placeholder="Scan or type barcode" />
            <button type="button" onClick={handleLookup}>Look up</button>
          </div>
          {errors.barcode && <span role="alert">{errors.barcode.message}</span>}
        </label>

        {foundCopy && (
          <p className={foundCopy.status === 'available' ? 'form-success' : 'form-error'}>
            {foundCopy.book?.title} — {foundCopy.status === 'available' ? 'Available' : `Not available (${foundCopy.status})`}
          </p>
        )}
        {findCopy.isError && <p role="alert" className="form-error">No copy found with that barcode.</p>}

        <div className="form-row">
          <label>
            Borrower type
            <select {...register('borrowerType')} onChange={(e) => { setValue('borrowerType', e.target.value as 'student' | 'employee'); setValue('borrowerId', ''); }}>
              <option value="student">Student</option>
              <option value="employee">Staff</option>
            </select>
          </label>
          <label>
            Borrower
            <PersonPicker type={borrowerType} value={borrowerId} onChange={(id) => setValue('borrowerId', id, { shouldValidate: true })} />
            {errors.borrowerId && <span role="alert">{errors.borrowerId.message}</span>}
          </label>
        </div>
        <label>
          Due date
          <input type="date" {...register('dueDate')} />
        </label>

        {issue.isError && (
          <p role="alert" className="form-error">
            {issue.error instanceof ApiError ? issue.error.message : 'Could not issue. Please try again.'}
          </p>
        )}
        {issue.isSuccess && <p className="form-success">Book issued.</p>}

        <button type="submit" disabled={isSubmitting || foundCopy?.status !== 'available'}>
          Issue book
        </button>
      </form>
    </div>
  );
}

function ActiveIssuesPanel() {
  const { data: issues, isLoading } = useActiveIssues();
  const returnBook = useReturnBook();

  return (
    <div className="card">
      <h2>Active loans</h2>
      {isLoading ? (
        <p>Loading…</p>
      ) : (
        <table className="data-table">
          <thead><tr><th>Book</th><th>Borrower</th><th>Due</th><th aria-label="Actions" /></tr></thead>
          <tbody>
            {(issues ?? []).map((issue: any) => {
              const isOverdue = new Date(issue.due_date) < new Date();
              const borrowerName = issue.student
                ? `${issue.student.first_name} ${issue.student.last_name}`
                : issue.employee?.profile?.full_name;
              return (
                <tr key={issue.id}>
                  <td>{issue.book_copy?.book?.title}</td>
                  <td>{borrowerName}</td>
                  <td className={isOverdue ? 'text-danger' : ''}>
                    {new Date(issue.due_date).toLocaleDateString()} {isOverdue && '(overdue)'}
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => returnBook.mutate({ issueId: issue.id, finePerDay: DEFAULT_FINE_PER_DAY })}
                      disabled={returnBook.isPending}
                    >
                      Return
                    </button>
                  </td>
                </tr>
              );
            })}
            {issues?.length === 0 && <tr><td colSpan={4} className="empty-state">No active loans.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
