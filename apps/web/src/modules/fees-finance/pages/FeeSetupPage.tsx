// modules/fees-finance/pages/FeeSetupPage.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RequirePermission } from '../../../core/rbac/RequirePermission';
import { useAcademicYears, useClasses } from '../../academics/hooks/useAcademics';
import { useFeeCategories, useFeeStructures, useScholarships, useCreateFeeCategory, useCreateFeeStructure, useCreateScholarship } from '../hooks/useFees';
import { feeCategorySchema, feeStructureSchema, scholarshipSchema, type FeeCategoryInput, type FeeStructureInput, type ScholarshipInput } from '../schemas/fees.schema';

export function FeeSetupPage() {
  return (
    <RequirePermission perm="fees.manage">
      <FeeSetupContent />
    </RequirePermission>
  );
}

function FeeSetupContent() {
  const { data: years } = useAcademicYears();
  const currentYear = years?.find((y: any) => y.is_current) ?? years?.[0];

  return (
    <div className="fee-setup-page">
      <h1>Fee Setup</h1>
      <CategoriesPanel />
      {currentYear && <StructuresPanel academicYearId={currentYear.id} />}
      <ScholarshipsPanel />
    </div>
  );
}

function CategoriesPanel() {
  const { data: categories, isLoading } = useFeeCategories();
  const [showForm, setShowForm] = useState(false);
  const create = useCreateFeeCategory();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FeeCategoryInput>({ resolver: zodResolver(feeCategorySchema) });

  return (
    <section className="card">
      <div className="page-toolbar">
        <h2>Fee categories</h2>
        <button type="button" onClick={() => setShowForm((s) => !s)}>+ Add category</button>
      </div>
      {showForm && (
        <form className="inline-form" onSubmit={handleSubmit(async (input) => { await create.mutateAsync(input); reset(); setShowForm(false); })}>
          <label>
            Name
            <input {...register('name')} placeholder="Tuition" />
            {errors.name && <span role="alert">{errors.name.message}</span>}
          </label>
          <div className="drawer-actions">
            <button type="button" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" disabled={isSubmitting}>Save</button>
          </div>
        </form>
      )}
      {!isLoading && (
        <div className="section-chips" style={{ marginTop: 12 }}>
          {(categories ?? []).map((c: any) => <span key={c.id} className="section-chip">{c.name}</span>)}
          {categories?.length === 0 && <span className="text-secondary">No categories yet.</span>}
        </div>
      )}
    </section>
  );
}

function StructuresPanel({ academicYearId }: { academicYearId: string }) {
  const { data: years } = useAcademicYears();
  const currentYear = years?.find((y: any) => y.id === academicYearId);
  const { data: classes } = useClasses(academicYearId);
  const { data: categories } = useFeeCategories();
  const { data: structures, isLoading } = useFeeStructures(academicYearId);
  const [showForm, setShowForm] = useState(false);
  const create = useCreateFeeStructure(academicYearId);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FeeStructureInput>({
    resolver: zodResolver(feeStructureSchema),
    defaultValues: { frequency: 'annual' },
  });

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div className="page-toolbar">
        <h2>Fee structure — {currentYear?.name}</h2>
        <button type="button" onClick={() => setShowForm((s) => !s)}>+ Add charge</button>
      </div>

      {showForm && (
        <form className="inline-form" onSubmit={handleSubmit(async (input) => { await create.mutateAsync(input); reset(); setShowForm(false); })}>
          <div className="form-row">
            <label>
              Class
              <select {...register('classId')}>
                <option value="">Select</option>
                {(classes ?? []).map((k: any) => <option key={k.id} value={k.id}>{k.name}</option>)}
              </select>
              {errors.classId && <span role="alert">{errors.classId.message}</span>}
            </label>
            <label>
              Fee category
              <select {...register('feeCategoryId')}>
                <option value="">Select</option>
                {(categories ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {errors.feeCategoryId && <span role="alert">{errors.feeCategoryId.message}</span>}
            </label>
          </div>
          <div className="form-row">
            <label>
              Amount
              <input type="number" step="0.01" {...register('amount')} />
              {errors.amount && <span role="alert">{errors.amount.message}</span>}
            </label>
            <label>
              Frequency
              <select {...register('frequency')}>
                <option value="one_time">One time</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
              </select>
            </label>
          </div>
          <div className="drawer-actions">
            <button type="button" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" disabled={isSubmitting}>Save</button>
          </div>
        </form>
      )}

      {!isLoading && (
        <table className="data-table" style={{ marginTop: 12 }}>
          <thead><tr><th>Class</th><th>Category</th><th>Amount</th><th>Frequency</th></tr></thead>
          <tbody>
            {(structures ?? []).map((s: any) => (
              <tr key={s.id}>
                <td>{s.class?.name}</td>
                <td>{s.fee_category?.name}</td>
                <td>{s.amount}</td>
                <td>{s.frequency}</td>
              </tr>
            ))}
            {structures?.length === 0 && <tr><td colSpan={4} className="empty-state">No charges configured yet.</td></tr>}
          </tbody>
        </table>
      )}
    </section>
  );
}

function ScholarshipsPanel() {
  const { data: scholarships, isLoading } = useScholarships();
  const [showForm, setShowForm] = useState(false);
  const create = useCreateScholarship();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ScholarshipInput>({
    resolver: zodResolver(scholarshipSchema),
    defaultValues: { discountType: 'percentage' },
  });

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div className="page-toolbar">
        <h2>Scholarships</h2>
        <button type="button" onClick={() => setShowForm((s) => !s)}>+ Add scholarship</button>
      </div>

      {showForm && (
        <form className="inline-form" onSubmit={handleSubmit(async (input) => { await create.mutateAsync(input); reset(); setShowForm(false); })}>
          <label>
            Name
            <input {...register('name')} placeholder="Merit Scholarship" />
            {errors.name && <span role="alert">{errors.name.message}</span>}
          </label>
          <div className="form-row">
            <label>
              Type
              <select {...register('discountType')}>
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed amount</option>
              </select>
            </label>
            <label>
              Value
              <input type="number" step="0.01" {...register('discountValue')} />
              {errors.discountValue && <span role="alert">{errors.discountValue.message}</span>}
            </label>
          </div>
          <div className="drawer-actions">
            <button type="button" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" disabled={isSubmitting}>Save</button>
          </div>
        </form>
      )}

      {!isLoading && (
        <ul className="section-chips" style={{ marginTop: 12, listStyle: 'none', padding: 0 }}>
          {(scholarships ?? []).map((s: any) => (
            <li key={s.id} className="section-chip">
              {s.name} ({s.discount_type === 'percentage' ? `${s.discount_value}%` : s.discount_value})
            </li>
          ))}
          {scholarships?.length === 0 && <li className="text-secondary">No scholarships yet.</li>}
        </ul>
      )}
    </section>
  );
}
