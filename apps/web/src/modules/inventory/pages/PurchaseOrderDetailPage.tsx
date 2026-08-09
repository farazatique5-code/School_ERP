// modules/inventory/pages/PurchaseOrderDetailPage.tsx
import { useParams } from 'react-router-dom';
import { RequirePermission } from '../../../core/rbac/RequirePermission';
import { usePurchaseOrderDetail, useMarkPurchaseOrderOrdered, useMarkPurchaseOrderReceived } from '../hooks/useInventory';

export function PurchaseOrderDetailPage() {
  return (
    <RequirePermission perm="inventory.manage">
      <PurchaseOrderDetailContent />
    </RequirePermission>
  );
}

function PurchaseOrderDetailContent() {
  const { id } = useParams<{ id: string }>();
  const { data: po, isLoading } = usePurchaseOrderDetail(id);
  const markOrdered = useMarkPurchaseOrderOrdered(id ?? '');
  const markReceived = useMarkPurchaseOrderReceived(id ?? '');

  if (isLoading) return <p>Loading…</p>;
  if (!po) return <p>Not found.</p>;

  return (
    <div className="po-detail-page">
      <header className="student-detail-header">
        <div>
          <h1>{po.order_number}</h1>
          <p className="text-secondary">{po.supplier?.name}</p>
        </div>
        <span className="status-badge">{po.status}</span>
      </header>

      {po.status === 'received' && (
        <div className="card banner-success">
          Received — stock has been updated for stock-tracked items, and a matching expense entry was posted to the
          Financial Reports ledger automatically.
        </div>
      )}

      <div className="card">
        <table className="data-table">
          <thead><tr><th>Item</th><th>Location</th><th>Quantity</th><th>Unit cost</th><th>Line total</th></tr></thead>
          <tbody>
            {(po.purchase_order_items ?? []).map((item: any) => (
              <tr key={item.id}>
                <td>{item.item?.name} {item.item?.is_asset_tracked && <span className="status-badge">Asset</span>}</td>
                <td>{item.location?.name}</td>
                <td>{item.quantity}</td>
                <td>{item.unit_cost}</td>
                <td>{(item.quantity * item.unit_cost).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p><strong>Total: {po.total_amount}</strong></p>

        {po.status === 'draft' && (
          <button type="button" onClick={() => markOrdered.mutate()} disabled={markOrdered.isPending}>
            {markOrdered.isPending ? 'Updating…' : 'Mark as ordered'}
          </button>
        )}
        {po.status === 'ordered' && (
          <button
            type="button"
            className="primary"
            onClick={() => {
              if (confirm('Mark as received? This updates stock levels and posts an expense entry to the ledger immediately.')) {
                markReceived.mutate();
              }
            }}
            disabled={markReceived.isPending}
          >
            {markReceived.isPending ? 'Processing…' : 'Mark as received'}
          </button>
        )}
        {po.purchase_order_items?.some((i: any) => i.item?.is_asset_tracked) && po.status !== 'received' && (
          <p className="field-hint" style={{ marginTop: 8 }}>
            This order includes asset-tracked items — after receiving, add each physical unit to Inventory Items
            with its own asset tag; asset-tracked items are never auto-generated in bulk.
          </p>
        )}
      </div>
    </div>
  );
}
