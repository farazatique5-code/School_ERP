// modules/library/pages/BookDetailPage.tsx
import { useParams } from 'react-router-dom';
import { RequirePermission } from '../../../core/rbac/RequirePermission';
import { useBookDetail } from '../hooks/useLibrary';

export function BookDetailPage() {
  return (
    <RequirePermission perm="library.view">
      <BookDetailContent />
    </RequirePermission>
  );
}

function BookDetailContent() {
  const { id } = useParams<{ id: string }>();
  const { data: book, isLoading } = useBookDetail(id);

  if (isLoading) return <p>Loading…</p>;
  if (!book) return <p>Book not found.</p>;

  return (
    <div className="book-detail-page">
      <h1>{book.title}</h1>
      <p className="text-secondary">
        {book.author ?? 'Unknown author'} {book.publisher ? `· ${book.publisher}` : ''}
        {book.isbn ? ` · ISBN ${book.isbn}` : ''}
      </p>

      <div className="card">
        <h2>Copies</h2>
        <table className="data-table">
          <thead><tr><th>Barcode</th><th>Status</th></tr></thead>
          <tbody>
            {(book.library_book_copies ?? []).map((copy: any) => (
              <tr key={copy.id}>
                <td className="mono-text">{copy.barcode}</td>
                <td><span className="status-badge">{copy.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Reservations</h2>
        <ul className="guardian-list">
          {(book.library_reservations ?? []).filter((r: any) => r.status === 'pending').map((r: any) => (
            <li key={r.id}>{r.student?.first_name} {r.student?.last_name} — reserved {new Date(r.reserved_at).toLocaleDateString()}</li>
          ))}
          {(!book.library_reservations || book.library_reservations.filter((r: any) => r.status === 'pending').length === 0) && (
            <li className="text-secondary">No pending reservations.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
