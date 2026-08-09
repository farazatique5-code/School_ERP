// modules/library/pages/CatalogPage.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { RequirePermission } from '../../../core/rbac/RequirePermission';
import { useBooksList, useCreateBook } from '../hooks/useLibrary';
import { bookSchema, type BookInput } from '../schemas/library.schema';
import { ApiError } from '../../organizations/api/mutations';

const PAGE_SIZE = 20;

export function CatalogPage() {
  return (
    <RequirePermission perm="library.view">
      <CatalogContent />
    </RequirePermission>
  );
}

function CatalogContent() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [showForm, setShowForm] = useState(false);
  const { data, isLoading } = useBooksList({ page, pageSize: PAGE_SIZE, search: search || undefined });
  const totalPages = data ? Math.max(1, Math.ceil(data.totalCount / PAGE_SIZE)) : 1;

  return (
    <div className="catalog-page">
      <div className="page-toolbar">
        <h1>Library Catalog</h1>
        <RequirePermission perm="library.manage" fallback={null}>
          <button type="button" onClick={() => setShowForm((s) => !s)}>+ Add book</button>
        </RequirePermission>
      </div>

      <form
        className="list-search-bar"
        onSubmit={(e) => { e.preventDefault(); setPage(0); setSearch(searchInput); }}
      >
        <input type="search" placeholder="Search by title, author, or ISBN…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
        <button type="submit">Search</button>
      </form>

      {showForm && <AddBookForm onClose={() => setShowForm(false)} />}

      {isLoading ? (
        <p>Loading…</p>
      ) : (
        <>
          <table className="data-table">
            <thead><tr><th>Title</th><th>Author</th><th>Category</th><th>Available</th></tr></thead>
            <tbody>
              {data?.rows.map((book: any) => (
                <tr key={book.id}>
                  <td><Link to={`/library/books/${book.id}`}>{book.title}</Link></td>
                  <td>{book.author ?? '—'}</td>
                  <td>{book.category ?? '—'}</td>
                  <td>
                    <span className={`status-badge ${book.availableCopies > 0 ? 'status-active' : 'status-inactive'}`}>
                      {book.availableCopies} / {book.totalCopies}
                    </span>
                  </td>
                </tr>
              ))}
              {data?.rows.length === 0 && <tr><td colSpan={4} className="empty-state">No books found.</td></tr>}
            </tbody>
          </table>
          <div className="pagination">
            <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <span>Page {page + 1} of {totalPages}</span>
            <button type="button" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </>
      )}
    </div>
  );
}

function AddBookForm({ onClose }: { onClose: () => void }) {
  const create = useCreateBook();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BookInput>({ resolver: zodResolver(bookSchema), defaultValues: { copyCount: 1 } });

  return (
    <form
      className="inline-form"
      onSubmit={handleSubmit(async (input) => {
        await create.mutateAsync(input);
        onClose();
      })}
    >
      <label>
        Title
        <input {...register('title')} />
        {errors.title && <span role="alert">{errors.title.message}</span>}
      </label>
      <div className="form-row">
        <label>Author<input {...register('author')} /></label>
        <label>ISBN<input {...register('isbn')} /></label>
      </div>
      <div className="form-row">
        <label>Publisher<input {...register('publisher')} /></label>
        <label>Category<input {...register('category')} /></label>
      </div>
      <div className="form-row">
        <label>Shelf location<input {...register('shelfLocation')} /></label>
        <label>
          Number of copies
          <input type="number" min={1} {...register('copyCount')} />
        </label>
      </div>

      {create.isError && (
        <p role="alert" className="form-error">
          {create.error instanceof ApiError ? create.error.message : 'Could not save. Please try again.'}
        </p>
      )}

      <div className="drawer-actions">
        <button type="button" onClick={onClose}>Cancel</button>
        <button type="submit" disabled={isSubmitting}>Save — generates barcodes automatically</button>
      </div>
    </form>
  );
}
