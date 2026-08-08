// modules/ai-copilot/pages/DocumentScannerPage.tsx
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { RequirePermission } from '../../../core/rbac/RequirePermission';
import { useAuth } from '../../../core/auth/AuthContext';
import { ApiError } from '../../organizations/api/mutations';

const EXTRACT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-extract-document`;

const DOCUMENT_TYPES = [
  { value: 'birth_certificate', label: 'Birth certificate' },
  { value: 'previous_school_transcript', label: 'Previous school transcript' },
  { value: 'national_id', label: 'National ID' },
  { value: 'passport', label: 'Passport' },
  { value: 'medical_certificate', label: 'Medical certificate' },
] as const;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function DocumentScannerPage() {
  return (
    <RequirePermission perm="ai.generate_content">
      <DocumentScannerContent />
    </RequirePermission>
  );
}

function DocumentScannerContent() {
  const { session } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<string>('birth_certificate');
  const [preview, setPreview] = useState<string | null>(null);

  const extract = useMutation({
    mutationFn: async () => {
      if (!file) throw new ApiError('no_file', 'Choose an image first.');
      const base64 = await fileToBase64(file);
      const response = await fetch(EXTRACT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session!.access_token}` },
        body: JSON.stringify({ imageBase64: base64, mediaType: file.type, documentType }),
      });
      const body = await response.json();
      if (!response.ok) throw new ApiError(body?.error?.code ?? 'unknown_error', body?.error?.message ?? 'Extraction failed.');
      return body.data;
    },
  });

  return (
    <div className="document-scanner-page">
      <h1>AI Document Scanner</h1>
      <p className="field-hint">
        Upload a scanned admission document to extract fields automatically. Extraction from scans — especially
        handwritten ones — isn't always accurate, so nothing here is saved to a student record automatically;
        copy the fields you've verified into the right form yourself.
      </p>

      <div className="card">
        <label>
          Document type
          <select value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
            {DOCUMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label>
          Image
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              setPreview(f ? URL.createObjectURL(f) : null);
            }}
          />
        </label>

        {preview && <img src={preview} alt="Document preview" className="document-scanner-preview" />}

        <button type="button" onClick={() => extract.mutate()} disabled={!file || extract.isPending} style={{ marginTop: 12 }}>
          {extract.isPending ? 'Extracting…' : 'Extract fields'}
        </button>

        {extract.isError && (
          <p role="alert" className="form-error">
            {extract.error instanceof ApiError ? extract.error.message : 'Could not extract. Please try again.'}
          </p>
        )}

        {extract.data && (
          <div className="card" style={{ marginTop: 12 }}>
            <p className="text-secondary">{extract.data.disclaimer}</p>
            <dl className="detail-grid">
              {Object.entries(extract.data.extracted ?? {}).map(([key, value]) => (
                <>
                  <dt key={`${key}-k`}>{key}</dt>
                  <dd key={`${key}-v`}>{value == null ? <span className="text-secondary">Not detected</span> : String(value)}</dd>
                </>
              ))}
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}
