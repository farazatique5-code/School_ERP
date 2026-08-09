// modules/timetable/pages/MyTimetablePage.tsx
import { useAuth } from '../../../core/auth/AuthContext';
import { useAcademicYears } from '../../academics/hooks/useAcademics';
import { useTeacherTimetable } from '../hooks/useTimetable';
import { DAYS_OF_WEEK } from '../schemas/timetable.schema';

export function MyTimetablePage() {
  const { profile } = useAuth();
  const { data: years } = useAcademicYears();
  const currentYear = years?.find((y: any) => y.is_current) ?? years?.[0];
  const { data: entries, isLoading } = useTeacherTimetable(profile?.id, currentYear?.id);

  const grouped = new Map<number, any[]>();
  for (const entry of entries ?? []) {
    const list = grouped.get(entry.day_of_week) ?? [];
    list.push(entry);
    grouped.set(entry.day_of_week, list);
  }
  for (const list of grouped.values()) list.sort((a, b) => (a.period?.sequence ?? 0) - (b.period?.sequence ?? 0));

  return (
    <div className="my-timetable-page">
      <h1>My Timetable</h1>

      {isLoading ? (
        <p>Loading…</p>
      ) : (
        <div className="my-timetable-grid">
          {DAYS_OF_WEEK.filter((d) => d.value !== 0).map((d) => (
            <div key={d.value} className="card my-timetable-day">
              <h2>{d.label}</h2>
              <ul>
                {(grouped.get(d.value) ?? []).map((entry: any) => (
                  <li key={entry.id}>
                    <strong>{entry.period?.name}</strong> ({entry.period?.start_time}–{entry.period?.end_time})
                    <div>{entry.subject?.name ?? 'Free'}</div>
                    <div className="text-secondary">
                      {entry.section?.class?.name} / {entry.section?.name}
                      {entry.room_number ? ` · Room ${entry.room_number}` : ''}
                    </div>
                  </li>
                ))}
                {(grouped.get(d.value) ?? []).length === 0 && <li className="text-secondary">No classes.</li>}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
