// modules/attendance/pages/AttendanceReportsPage.tsx
import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { RequirePermission } from '../../../core/rbac/RequirePermission';
import { useAcademicYears, useClasses } from '../../academics/hooks/useAcademics';
import { useSectionStats, useLowAttendanceStudents } from '../hooks/useAttendance';

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function AttendanceReportsPage() {
  return (
    <RequirePermission perm="attendance.view">
      <AttendanceReportsContent />
    </RequirePermission>
  );
}

function AttendanceReportsContent() {
  const { data: years } = useAcademicYears();
  const currentYear = years?.find((y) => y.is_current) ?? years?.[0];
  const { data: classes } = useClasses(currentYear?.id);

  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [fromDate, setFromDate] = useState(daysAgo(30));
  const [toDate, setToDate] = useState(daysAgo(0));
  const [threshold, setThreshold] = useState(75);

  const sections = classes?.find((c: any) => c.id === classId)?.sections ?? [];
  const { data: stats, isLoading: statsLoading } = useSectionStats(sectionId || undefined, fromDate, toDate);
  const { data: lowAttendance, isLoading: lowLoading } = useLowAttendanceStudents(fromDate, toDate, threshold);

  return (
    <div className="attendance-reports-page">
      <h1>Attendance Reports</h1>

      <div className="attendance-filters">
        <label>
          From
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </label>
      </div>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Section trend</h2>
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
          <p className="text-secondary">Select a section to see its daily attendance breakdown.</p>
        ) : statsLoading ? (
          <p>Loading…</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stats ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border-default))" />
              <XAxis dataKey="attendanceDate" tickFormatter={(d: string) => d.slice(5)} fontSize={11} />
              <YAxis allowDecimals={false} fontSize={11} />
              <Tooltip />
              <Legend />
              <Bar dataKey="presentCount" stackId="a" name="Present" fill="hsl(142 71% 45%)" />
              <Bar dataKey="lateCount" stackId="a" name="Late" fill="hsl(38 92% 50%)" />
              <Bar dataKey="absentCount" stackId="a" name="Absent" fill="hsl(0 84% 60%)" />
              <Bar dataKey="excusedCount" stackId="a" name="Excused" fill="hsl(199 89% 48%)" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      <section className="card">
        <div className="page-toolbar">
          <h2>Students below attendance threshold</h2>
          <label className="threshold-input">
            Below
            <input
              type="number"
              min={0}
              max={100}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
            />
            %
          </label>
        </div>

        {lowLoading ? (
          <p>Loading…</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Code</th>
                <th>Attendance %</th>
              </tr>
            </thead>
            <tbody>
              {(lowAttendance ?? []).map((s) => (
                <tr key={s.studentId}>
                  <td>{s.name}</td>
                  <td className="mono-text">{s.code}</td>
                  <td>
                    <span className={`status-badge ${s.attendancePercent < 60 ? 'status-inactive' : ''}`}>
                      {s.attendancePercent}%
                    </span>
                  </td>
                </tr>
              ))}
              {lowAttendance?.length === 0 && (
                <tr>
                  <td colSpan={3} className="empty-state">No students below {threshold}% in this range.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
