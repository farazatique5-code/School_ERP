// lib/export.ts
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ExportColumn<T> {
  header: string;
  accessor: (row: T) => string | number;
}

function toRows<T>(data: T[], columns: ExportColumn<T>[]): (string | number)[][] {
  return data.map((row) => columns.map((col) => col.accessor(row)));
}

/** Real CSV generation — RFC 4180 quoting, not a naive join(','). */
export function exportToCsv<T>(filename: string, data: T[], columns: ExportColumn<T>[]) {
  const escapeCell = (value: string | number) => {
    const str = String(value ?? '');
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const headerRow = columns.map((c) => escapeCell(c.header)).join(',');
  const bodyRows = toRows(data, columns).map((row) => row.map(escapeCell).join(','));
  const csv = [headerRow, ...bodyRows].join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
}

/** Real .xlsx generation via SheetJS — opens correctly in Excel/Google
 * Sheets/Numbers, not a CSV file wearing an .xlsx extension. */
export function exportToExcel<T>(filename: string, data: T[], columns: ExportColumn<T>[]) {
  const headerRow = columns.map((c) => c.header);
  const bodyRows = toRows(data, columns);
  const worksheet = XLSX.utils.aoa_to_sheet([headerRow, ...bodyRows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

/** Real PDF table export via jsPDF + autotable. */
export function exportToPdf<T>(filename: string, title: string, data: T[], columns: ExportColumn<T>[]) {
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleString()}`, 14, 22);

  autoTable(doc, {
    startY: 28,
    head: [columns.map((c) => c.header)],
    body: toRows(data, columns).map((row) => row.map(String)),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [79, 70, 229] }, // matches --brand-primary default
  });

  doc.save(`${filename}.pdf`);
}

/** Renders an arbitrary key/value + line-items PDF — used for invoices and
 * report cards, which need a document layout rather than a flat table. */
export function exportDocumentToPdf(options: {
  filename: string;
  title: string;
  subtitle?: string;
  keyValuePairs: [string, string][];
  tableHead: string[];
  tableRows: (string | number)[][];
  footerLines?: string[];
}) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(options.title, 14, 18);
  if (options.subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(options.subtitle, 14, 25);
  }

  let y = options.subtitle ? 34 : 28;
  doc.setFontSize(10);
  doc.setTextColor(30);
  for (const [key, value] of options.keyValuePairs) {
    doc.text(`${key}:`, 14, y);
    doc.text(value, 60, y);
    y += 6;
  }

  autoTable(doc, {
    startY: y + 4,
    head: [options.tableHead],
    body: options.tableRows.map((row) => row.map(String)),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [79, 70, 229] },
  });

  if (options.footerLines?.length) {
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    options.footerLines.forEach((line, i) => doc.text(line, 14, finalY + i * 6));
  }

  doc.save(`${options.filename}.pdf`);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
