// modules/portals/pages/PortalTimetablePage.tsx
import { useActiveChild } from '../context/ActiveChildContext';
import { usePortalTimetable } from '../hooks/usePortal';

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function PortalTimetablePage() {
  const { activeChild } = useActiveChild();
  const { data: entries, isLoading } = usePortalTimetable(activeChild?.id);

  if (isLoading) return <p>Loading…</p>;

  const grouped = new Map<number, any[]>();
  for (const entry of entries ?? []) {
    const list = grouped.get(entry.day_of_week) ?? [];
    list.push(entry);
    grouped.set(entry.day_of_week, list);
  }
  for (const list of grouped.values()) list.sort((a, b) => (a.period?.sequence ?? 0) - (b.period?.sequence ?? 0));

  return (
    <div className="portal-timetable-page">
      <h1>Timetable</h1>
      {[1, 2, 3, 4, 5, 6].map((day) => (
        <div className="card" key={day} style={{ marginBottom: 8 }}>
          <h3>{DAY_LABELS[day]}</h3>
          <ul className="portal-list">
            {(grouped.get(day) ?? []).map((entry: any) => (
              <li key={entry.id}>
                <span>{entry.period?.name} ({entry.period?.start_time}–{entry.period?.end_time})</span>
                <span>{entry.subject?.name ?? 'Free'}</span>
              </li>
            ))}
            {(grouped.get(day) ?? []).length === 0 && <li className="text-secondary">No classes.</li>}
          </ul>
        </div>
      ))}
    </div>
  );
}
