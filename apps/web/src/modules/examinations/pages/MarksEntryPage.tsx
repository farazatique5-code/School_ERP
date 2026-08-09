// modules/examinations/pages/MarksEntryPage.tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { RequirePermission } from '../../../core/rbac/RequirePermission';
import { useMarksRoster, useBulkSaveMarks } from '../hooks/useExams';
import { ApiError } from '../../organizations/api/mutations';

export function MarksEntryPage() {
  return (
    <RequirePermission perm="exams.enter_marks">
      <MarksEntryContent />
    </RequirePermission>
  );
}

function MarksEntryContent() {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const { data, isLoading } = useMarksRoster(scheduleId);
  const save = useBulkSaveMarks();
  const [draft, setDraft] = useState<Record<string, { marks: string; absent: boolean; remarks: string }>>({});

  useEffect(() => {
    if (data) {
      const next: typeof draft = {};
      for (const row of data.roster) {
        next[row.studentId] = {
          marks: row.existingMarks?.marks_obtained?.toString() ?? '',
          absent: row.existingMarks?.is_absent ?? false,
          remarks: row.existingMarks?.remarks ?? '',
        };
      }
      setDraft(next);
    }
  }, [data]);

  if (isLoading) return <p>Loading…</p>;
  if (!data) return <p>Not found.</p>;

  const { schedule, roster } = data;

  const updateRow = (studentId: string, patch: Partial<{ marks: string; absent: boolean; remarks: string }>) =>
    setDraft((d) => ({ ...d, [studentId]: { ...d[studentId], ...patch } }));

  const handleSave = async () => {
    if (!scheduleId) return;
    try {
      await save.mutateAsync({
        examScheduleId: scheduleId,
        rows: roster.map((r) => ({
          studentId: r.studentId,
          marksObtained: draft[r.studentId]?.absent ? undefined : Number(draft[r.studentId]?.marks || 0),
          isAbsent: draft[r.studentId]?.absent ?? false,
          remarks: draft[r.studentId]?.remarks || '',
        })),
      });
    } catch {
      // surfaced below
    }
  };

  return (
    <div className="marks-entry-page">
      <h1>Enter marks — {schedule.subject?.name ?? schedule.class?.name}</h1>
      <p className="text-secondary">Max marks: {schedule.max_marks} · Passing: {schedule.passing_marks}</p>

      <table className="data-table">
        <thead>
          <tr>
            <th>Roll #</th>
            <th>Student</th>
            <th>Marks obtained</th>
            <th>Absent</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {roster.map((row) => (
            <tr key={row.studentId}>
              <td>{row.rollNumber ?? '—'}</td>
              <td>{row.firstName} {row.lastName} <span className="text-secondary mono-text">{row.studentCode}</span></td>
              <td>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={schedule.max_marks}
                  value={draft[row.studentId]?.marks ?? ''}
                  disabled={draft[row.studentId]?.absent}
                  onChange={(e) => updateRow(row.studentId, { marks: e.target.value })}
                  style={{ width: 80 }}
                />
              </td>
              <td className="status-radio-cell">
                <input
                  type="checkbox"
                  checked={draft[row.studentId]?.absent ?? false}
                  onChange={(e) => updateRow(row.studentId, { absent: e.target.checked })}
                />
              </td>
              <td>
                <input
                  value={draft[row.studentId]?.remarks ?? ''}
                  onChange={(e) => updateRow(row.studentId, { remarks: e.target.value })}
                />
              </td>
            </tr>
          ))}
          {roster.length === 0 && (
            <tr>
              <td colSpan={5} className="empty-state">No students enrolled in this class.</td>
            </tr>
          )}
        </tbody>
      </table>

      {save.isError && (
        <p role="alert" className="form-error">
          {save.error instanceof ApiError ? save.error.message : 'Could not save marks. Please try again.'}
        </p>
      )}
      {save.isSuccess && <p className="form-success">Marks saved.</p>}

      <button type="button" onClick={handleSave} disabled={save.isPending || roster.length === 0}>
        {save.isPending ? 'Saving…' : 'Save marks'}
      </button>
    </div>
  );
}
