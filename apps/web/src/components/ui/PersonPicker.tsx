// components/ui/PersonPicker.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../core/supabase/client';
import { useAuth } from '../../core/auth/AuthContext';

interface PersonOption {
  id: string;
  label: string;
  sublabel: string;
}

interface PersonPickerProps {
  type: 'student' | 'employee';
  value: string;
  onChange: (id: string, option: PersonOption | null) => void;
  placeholder?: string;
}

/**
 * Replaces the "paste a UUID" text inputs that accumulated across Fees,
 * Library, Inventory, Hostel, and Transport (see each phase's README) —
 * one searchable picker, adopted going forward, instead of five copies
 * of the same shortcut.
 */
export function PersonPicker({ type, value, onChange, placeholder }: PersonPickerProps) {
  const { activeSchoolId } = useAuth();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState('');

  const { data: options, isLoading } = useQuery({
    queryKey: ['personPicker', type, activeSchoolId, query],
    enabled: !!activeSchoolId && query.length >= 2,
    queryFn: async (): Promise<PersonOption[]> => {
      if (type === 'student') {
        const { data, error } = await supabase
          .from('students')
          .select('id, first_name, last_name, student_code')
          .eq('school_id', activeSchoolId!)
          .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,student_code.ilike.%${query}%`)
          .limit(10);
        if (error) throw error;
        return (data ?? []).map((s) => ({ id: s.id, label: `${s.first_name} ${s.last_name}`, sublabel: s.student_code }));
      }
      const { data, error } = await supabase
        .from('employees')
        .select('profile_id, employee_code, profile:profiles(full_name)')
        .eq('school_id', activeSchoolId!)
        .limit(50);
      if (error) throw error;
      return (data ?? [])
        .map((e: any) => ({ id: e.profile_id, label: e.profile?.full_name ?? '', sublabel: e.employee_code }))
        .filter((o) => o.label.toLowerCase().includes(query.toLowerCase()));
    },
  });

  return (
    <div className="person-picker">
      <input
        type="text"
        value={value ? selectedLabel : query}
        placeholder={placeholder ?? `Search ${type}s by name...`}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (value) onChange('', null); // typing again clears any previous selection
        }}
        onFocus={() => setOpen(true)}
      />
      {open && query.length >= 2 && (
        <ul className="person-picker-results">
          {isLoading && <li className="text-secondary">Searching…</li>}
          {!isLoading &&
            (options ?? []).map((opt) => (
              <li key={opt.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt.id, opt);
                    setSelectedLabel(`${opt.label} (${opt.sublabel})`);
                    setQuery('');
                    setOpen(false);
                  }}
                >
                  <strong>{opt.label}</strong> <span className="text-secondary mono-text">{opt.sublabel}</span>
                </button>
              </li>
            ))}
          {!isLoading && options?.length === 0 && <li className="text-secondary">No matches.</li>}
        </ul>
      )}
    </div>
  );
}
