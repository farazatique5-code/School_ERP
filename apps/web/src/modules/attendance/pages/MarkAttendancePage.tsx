// modules/attendance/pages/MarkAttendancePage.tsx
import { useEffect, useState } from 'react';
import { RequirePermission } from '../../../core/rbac/RequirePermission';
import { useAcademicYears, useClasses } from '../../academics/hooks/useAcademics';
import { useRosterForAttendance, useBulkMarkAttendance } from '../hooks/useAttendance';
import { STATUS_LABELS, type AttendanceStatus } from '../schemas/attendance.schema';
import { ApiError } from '../../organizations/api/mutations';

const STATUSES: AttendanceStatus[] = ['present', 'absent', 'late', 'half_day', 'excused'];

export function MarkAttendancePage() {
  return (
    <RequirePermission perm="attendance.mark">
      <MarkAttendanceContent />
    </RequirePermission>
  );
}

function MarkAttendanceContent() {
  const { data: years } = useAcademicYears();
  const currentYear = years?.find((y) => y.is_current) ?? years?.[0];
  const { data: classes } = useClasses(currentYear?.id);

  const [classId, setClassId] = useState<string>('');
  const [sectionId, setSectionId] = useState<string>('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [draft, setDraft] = useState<Record<string, { status: AttendanceStatus; remarks: string }>>({});

  const { data: roster, isLoading } = useRosterForAttendance(sectionId || undefined, date);
  const mark = useBulkMarkAttendance();

  const sections = classes?.find((c: any) => c.id === classId)?.sections ?? [];

  useEffect(() => {
    if (roster) {
      const next: typeof draft = {};
      for (const row of roster) {
        next[row.studentId] = {
          status: (row.existingStatus as AttendanceStatus) ?? 'present',
          remarks: row.existingRemarks ?? '',
        };
      }
      setDraft(next);
    }
  }, [roster]);

  const setStatus = (studentId: string, status: AttendanceStatus) =>
    setDraft((d) => ({ ...d, [studentId]: { ...d[studentId], status } }));

  const markAllPresent = () =>
    setDraft((d) => Object.fromEntries(Object.entries(d).map(([id, v]) => [id, { ...v, status: 'present' }])));

  const handleSave = async () => {
    if (!sectionId || !roster) return;
    try {
      await mark.mutateAsync({
        sectionId,
        attendanceDate: date,
        rows: roster.map((r) => ({
          studentId: r.studentId,
          status: draft[r.studentId]?.status ?? 'present',
          remarks: draft[r.studentId]?.remarks || '',
        })),
      });
    } catch {
      // surfaced via mark.error below
    }
  };

  return (
    <div className="mark-attendance-page">
      <h1>Mark Attendance</h1>

      <div className="attendance-filters">
        <label>
          Class
          <select value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId(''); }}>
            <option value="">Select a class</option>
            {(classes ?? []).map((k: any) => (
              <option key={k.id} value={k.id}>{k.name}</option>
            ))}
          </select>
        </label>
        <label>
          Section
          <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={!classId}>
            <option value="">Select a section</option>
            {sections.map((s: any) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label>
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={new Date().toISOString().slice(0, 10)} />
        </label>
        {roster && roster.length > 0 && (
          <button type="button" onClick={markAllPresent}>Mark all present</button>
        )}
      </div>

      {!sectionId ? (
        <p className="text-secondary">Select a class and section to load its roster.</p>
      ) : isLoading ? (
        <p>Loading roster…</p>
      ) : (
        <>
          <table className="data-table attendance-roster">
            <thead>
              <tr>
                <th>Roll #</th>
                <th>Student</th>
                {STATUSES.map((s) => (
                  <th key={s}>{STATUS_LABELS[s]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(roster ?? []).map((row) => (
                <tr key={row.studentId}>
                  <td>{row.rollNumber ?? '—'}</td>
                  <td>
                    {row.firstName} {row.lastName} <span className="text-secondary mono-text">{row.studentCode}</span>
                  </td>
                  {STATUSES.map((status) => (
                    <td key={status} className="status-radio-cell">
                      <input
                        type="radio"
                        name={`status-${row.studentId}`}
                        checked={draft[row.studentId]?.status === status}
                        onChange={() => setStatus(row.studentId, status)}
                        aria-label={`${STATUS_LABELS[status]} for ${row.firstName} ${row.lastName}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
              {roster?.length === 0 && (
                <tr>
                  <td colSpan={2 + STATUSES.length} className="empty-state">
                    No students enrolled in this section yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {mark.isError && (
            <p role="alert" className="form-error">
              {mark.error instanceof ApiError ? mark.error.message : 'Could not save attendance. Please try again.'}
            </p>
          )}
          {mark.isSuccess && <p className="form-success">Attendance saved.</p>}

          <button type="button" onClick={handleSave} disabled={mark.isPending || !roster?.length}>
            {mark.isPending ? 'Saving…' : 'Save attendance'}
          </button>
        </>
      )}
    </div>
  );
}
