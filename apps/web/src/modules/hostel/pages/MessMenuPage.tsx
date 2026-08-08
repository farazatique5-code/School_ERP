// modules/hostel/pages/MessMenuPage.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RequirePermission } from '../../../core/rbac/RequirePermission';
import { useMessMenu, useUpsertMessMenu } from '../hooks/useHostel';
import { messMenuSchema, DAY_LABELS, type MessMenuInput } from '../schemas/hostel.schema';

const MEAL_TYPES = ['breakfast', 'lunch', 'snacks', 'dinner'] as const;

export function MessMenuPage() {
  const { data: menu, isLoading } = useMessMenu();
  const [editingCell, setEditingCell] = useState<{ day: number; meal: string } | null>(null);
  const upsert = useUpsertMessMenu();

  const entryFor = (day: number, meal: string) => (menu ?? []).find((m: any) => m.day_of_week === day && m.meal_type === meal);

  return (
    <div className="mess-menu-page">
      <h1>Mess Menu</h1>

      {isLoading ? (
        <p>Loading…</p>
      ) : (
        <table className="data-table mess-menu-grid">
          <thead>
            <tr>
              <th>Day</th>
              {MEAL_TYPES.map((m) => <th key={m}>{m}</th>)}
            </tr>
          </thead>
          <tbody>
            {DAY_LABELS.map((label, day) => (
              <tr key={day}>
                <td>{label}</td>
                {MEAL_TYPES.map((meal) => {
                  const entry = entryFor(day, meal);
                  return (
                    <td key={meal} className="timetable-cell">
                      <RequirePermission
                        perm="hostel.manage"
                        fallback={<span>{entry?.menu_description ?? '—'}</span>}
                      >
                        <button type="button" className="link-button" onClick={() => setEditingCell({ day, meal })}>
                          {entry?.menu_description ?? '+ Add'}
                        </button>
                      </RequirePermission>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editingCell && (
        <MenuEditDrawer
          day={editingCell.day}
          meal={editingCell.meal}
          existing={entryFor(editingCell.day, editingCell.meal)}
          onSave={async (description) => {
            await upsert.mutateAsync({ dayOfWeek: editingCell.day, mealType: editingCell.meal as any, menuDescription: description });
            setEditingCell(null);
          }}
          onClose={() => setEditingCell(null)}
        />
      )}
    </div>
  );
}

function MenuEditDrawer({
  day,
  meal,
  existing,
  onSave,
  onClose,
}: {
  day: number;
  meal: string;
  existing: any;
  onSave: (description: string) => Promise<void>;
  onClose: () => void;
}) {
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<MessMenuInput>({
    resolver: zodResolver(messMenuSchema),
    defaultValues: { dayOfWeek: day, mealType: meal as any, menuDescription: existing?.menu_description ?? '' },
  });

  return (
    <div className="drawer-overlay" role="dialog" aria-modal="true">
      <div className="drawer">
        <h2>{DAY_LABELS[day]} — {meal}</h2>
        <form onSubmit={handleSubmit((input) => onSave(input.menuDescription))}>
          <label>
            Menu
            <textarea {...register('menuDescription')} rows={3} />
          </label>
          <div className="drawer-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={isSubmitting}>Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}
