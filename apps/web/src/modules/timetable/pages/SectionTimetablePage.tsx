// modules/timetable/pages/SectionTimetablePage.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RequirePermission } from '../../../core/rbac/RequirePermission';
import { useAcademicYears, useClasses } from '../../academics/hooks/useAcademics';
import { useEmployeesList } from '../../teachers-hr/hooks/useHr';
import { usePeriods, useSectionTimetable, useUpsertTimetableEntry, useClearTimetableEntry, useClassSubjects } from '../hooks/useTimetable';
import { timetableEntrySchema, DAYS_OF_WEEK, type TimetableEntryInput } from '../schemas/timetable.schema';
import { ApiError } from '../../organizations/api/mutations';

export function SectionTimetablePage() {
  return (
    <RequirePermission perm="timetable.manage">
      <SectionTimetableContent />
    </RequirePermission>
  );
}

function SectionTimetableContent() {
  const { data: years } = useAcademicYears();
  const currentYear = years?.find((y: any) => y.is_current) ?? years?.[0];
  const { data: classes } = useClasses(currentYear?.id);
  const { data: periods } = usePeriods();
  const { data: employees } = useEmployeesList();

  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [activeCell, setActiveCell] = useState<{ day: number; periodId: string } | null>(null);

  const sections = classes?.find((c: any) => c.id === classId)?.sections ?? [];
  const { data: entries } = useSectionTimetable(sectionId || undefined, currentYear?.id);
  const { data: classSubjects } = useClassSubjects(classId || undefined);
  const upsert = useUpsertTimetableEntry(sectionId, currentYear?.id ?? '');
  const clear = useClearTimetableEntry(sectionId, currentYear?.id ?? '');

  const teachingPeriods = (periods ?? []).filter((p: any) => !p.is_break);

  const entryFor = (day: number, periodId: string) =>
    (entries ?? []).find((e: any) => e.day_of_week === day && e.period_id === periodId);

  return (
    <div className="section-timetable-page">
      <h1>Timetable</h1>

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
      </div>

      {!sectionId ? (
        <p className="text-secondary">Select a class and section to view/edit its timetable.</p>
      ) : (
        <div className="timetable-grid-wrapper">
          <table className="data-table timetable-grid">
            <thead>
              <tr>
                <th>Period</th>
                {DAYS_OF_WEEK.filter((d) => d.value !== 0).map((d) => (
                  <th key={d.value}>{d.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teachingPeriods.map((period: any) => (
                <tr key={period.id}>
                  <td className="period-label">
                    {period.name}
                    <div className="text-secondary">{period.start_time}–{period.end_time}</div>
                  </td>
                  {DAYS_OF_WEEK.filter((d) => d.value !== 0).map((d) => {
                    const entry = entryFor(d.value, period.id);
                    return (
                      <td
                        key={d.value}
                        className="timetable-cell"
                        onClick={() => setActiveCell({ day: d.value, periodId: period.id })}
                      >
                        {entry?.subject?.name ? (
                          <>
                            <strong>{entry.subject.name}</strong>
                            <div className="text-secondary">{entry.teacher?.profile?.full_name ?? '—'}</div>
                            {entry.room_number && <div className="text-secondary">Room {entry.room_number}</div>}
                          </>
                        ) : (
                          <span className="text-secondary">+ Assign</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {teachingPeriods.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-state">
                    No periods set up yet — go to Periods setup first.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeCell && sectionId && (
        <EntryEditorDrawer
          day={activeCell.day}
          periodId={activeCell.periodId}
          existing={entryFor(activeCell.day, activeCell.periodId)}
          subjects={classSubjects ?? []}
          employees={employees ?? []}
          onSave={async (input) => {
            await upsert.mutateAsync({ dayOfWeek: activeCell.day, periodId: activeCell.periodId, input });
            setActiveCell(null);
          }}
          onClear={async () => {
            await clear.mutateAsync({ dayOfWeek: activeCell.day, periodId: activeCell.periodId });
            setActiveCell(null);
          }}
          onClose={() => setActiveCell(null)}
          error={upsert.error}
        />
      )}
    </div>
  );
}

function EntryEditorDrawer({
  day,
  periodId,
  existing,
  subjects,
  employees,
  onSave,
  onClear,
  onClose,
  error,
}: {
  day: number;
  periodId: string;
  existing: any;
  subjects: any[];
  employees: any[];
  onSave: (input: TimetableEntryInput) => Promise<void>;
  onClear: () => Promise<void>;
  onClose: () => void;
  error: unknown;
}) {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<TimetableEntryInput>({
    resolver: zodResolver(timetableEntrySchema),
    defaultValues: {
      subjectId: existing?.subject_id ?? '',
      teacherProfileId: existing?.teacher_profile_id ?? '',
      roomNumber: existing?.room_number ?? '',
    },
  });

  return (
    <div className="drawer-overlay" role="dialog" aria-modal="true" aria-label="Edit timetable slot">
      <div className="drawer">
        <h2>{DAYS_OF_WEEK.find((d) => d.value === day)?.label} — slot</h2>
        <form onSubmit={handleSubmit(onSave)}>
          <label>
            Subject
            <select {...register('subjectId')}>
              <option value="">— None —</option>
              {subjects.map((subject: any) => (
                <option key={subject.id} value={subject.id}>{subject.name}</option>
              ))}
            </select>
          </label>
          <label>
            Teacher
            <select {...register('teacherProfileId')}>
              <option value="">— None —</option>
              {employees.map((emp: any) => (
                <option key={emp.profile_id} value={emp.profile_id}>{emp.profile?.full_name}</option>
              ))}
            </select>
          </label>
          <label>
            Room number
            <input {...register('roomNumber')} />
          </label>

          {!!error && (
            <p role="alert" className="form-error">
              {error instanceof ApiError ? error.message : 'Could not save. Please try again.'}
            </p>
          )}

          <div className="drawer-actions">
            {existing && (
              <button type="button" className="danger" onClick={onClear} disabled={isSubmitting}>
                Clear slot
              </button>
            )}
            <button type="button" onClick={onClose} disabled={isSubmitting}>Cancel</button>
            <button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
