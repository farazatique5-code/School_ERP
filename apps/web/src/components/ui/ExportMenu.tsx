// components/ui/ExportMenu.tsx
import { exportToCsv, exportToExcel, exportToPdf, type ExportColumn } from '../../lib/export';

interface ExportMenuProps<T> {
  filename: string;
  title: string;
  data: T[];
  columns: ExportColumn<T>[];
}

/** Drop this into any list page's toolbar: <ExportMenu filename="students" title="Students" data={rows} columns={cols} />
 * All three formats are genuinely generated client-side — there is no
 * "coming soon" state once this component is used. */
export function ExportMenu<T>({ filename, title, data, columns }: ExportMenuProps<T>) {
  return (
    <div className="export-menu">
      <button type="button" onClick={() => exportToCsv(filename, data, columns)} disabled={data.length === 0}>
        Export CSV
      </button>
      <button type="button" onClick={() => exportToExcel(filename, data, columns)} disabled={data.length === 0}>
        Export Excel
      </button>
      <button type="button" onClick={() => exportToPdf(filename, title, data, columns)} disabled={data.length === 0}>
        Export PDF
      </button>
    </div>
  );
}
