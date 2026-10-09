import React, { useState } from 'react';
import {
  Copy,
  Check,
  Download,
  MapPin,
  Phone,
  Package,
  Truck,
  ExternalLink,
  Search,
  Lock,
} from 'lucide-react';

export type OrderStatus =
  | 'pending'
  | 'ready_for_shiprocket'
  | 'dispatched'
  | 'delivered';

export interface BookOrderRecord {
  id: string;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  sellerName: string;
  buyerId: string;
  customerName: string;
  customerPhone: string;
  exactLocation: string;
  fullAddress: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  status: OrderStatus;
  adminEmail: string;
  createdAt?: { seconds: number; nanoseconds: number } | null;
  updatedAt?: { seconds: number; nanoseconds: number } | null;
}

interface AdminOrdersPanelProps {
  adminEmail: string;
  orders: BookOrderRecord[];
  isLoading: boolean;
  onUpdateOrderStatus: (order: BookOrderRecord, newStatus: OrderStatus) => Promise<void>;
  onLockAdmin?: () => void;
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'New Order · Pending Shiprocket',
  ready_for_shiprocket: 'Entered in Shiprocket',
  dispatched: 'Dispatched via Courier',
  delivered: 'Delivered (Completed)',
};

export const AdminOrdersPanel: React.FC<AdminOrdersPanelProps> = ({
  adminEmail,
  orders,
  isLoading,
  onUpdateOrderStatus,
  onLockAdmin,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | OrderStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const copyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(key);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  const formatShiprocketBlock = (order: BookOrderRecord): string => {
    return [
      `Order ID: ${order.id}`,
      `Book Ordered: ${order.bookTitle} (by ${order.bookAuthor})`,
      `Customer Name: ${order.customerName}`,
      `Customer Phone: ${order.customerPhone}`,
      `Address Line 1: ${order.fullAddress}`,
      `Landmark / Line 2: ${order.landmark || 'N/A'}`,
      `Exact Location / GPS: ${order.exactLocation}`,
      `City: ${order.city}`,
      `State: ${order.state}`,
      `PIN Code: ${order.pincode}`,
    ].join('\n');
  };

  const handleExportShiprocketCsv = () => {
    if (orders.length === 0) return;

    const headers = [
      'Order ID',
      'Order Date',
      'Book Name',
      'Book Author',
      'Customer Name',
      'Customer Phone',
      'Address Line 1',
      'Landmark',
      'Exact Location',
      'City',
      'State',
      'Pincode',
      'Status',
    ];

    const escapeCsv = (val: string) => `"${String(val || '').replace(/"/g, '""')}"`;

    const rows = orders.map((o) => {
      const dateStr = o.createdAt?.seconds
        ? new Date(o.createdAt.seconds * 1000).toISOString()
        : '';
      return [
        o.id,
        dateStr,
        o.bookTitle,
        o.bookAuthor,
        o.customerName,
        o.customerPhone,
        o.fullAddress,
        o.landmark,
        o.exactLocation,
        o.city,
        o.state,
        o.pincode,
        o.status,
      ]
        .map(escapeCsv)
        .join(',');
    });

    const csvContent = [headers.map(escapeCsv).join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `saras_shiprocket_orders_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleStatusChange = async (order: BookOrderRecord, nextStatus: OrderStatus) => {
    if (order.status === nextStatus) return;
    setUpdatingOrderId(order.id);
    try {
      await onUpdateOrderStatus(order, nextStatus);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (filterStatus !== 'all' && o.status !== filterStatus) return false;
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      o.customerPhone.toLowerCase().includes(q) ||
      o.bookTitle.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      o.state.toLowerCase().includes(q) ||
      o.city.toLowerCase().includes(q) ||
      o.pincode.toLowerCase().includes(q) ||
      o.exactLocation.toLowerCase().includes(q)
    );
  });

  // Extract GPS coordinates if present in exactLocation (e.g., "GPS: 28.6139, 77.209")
  const parseCoordinates = (loc: string): { lat: string; lng: string } | null => {
    const match = loc.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
    if (!match) return null;
    return { lat: match[1], lng: match[2] };
  };

  return (
    <section className="space-y-8">
      {/* Admin Header Banner */}
      <div className="flex flex-col gap-4 rounded-xl border border-stone-200 bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-stone-500">
            <span>Private Owner Admin Console</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">{adminEmail}</span>
          </div>
          <h2 className="font-serif text-2xl font-semibold text-stone-900">
            Shiprocket Dispatch & Incoming Book Orders
          </h2>
          <p className="text-sm text-stone-600">
            View which phone number sent each order, which book was ordered, and the exact
            location, state, and PIN code to paste into Shiprocket.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-start">
          <button
            type="button"
            onClick={handleExportShiprocketCsv}
            disabled={orders.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-stone-900 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-stone-800 disabled:opacity-40 whitespace-nowrap shrink-0"
          >
            <Download className="h-4 w-4" />
            Download Shiprocket CSV ({orders.length})
          </button>
          {onLockAdmin && (
            <button
              type="button"
              onClick={onLockAdmin}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-100 whitespace-nowrap shrink-0"
            >
              <Lock className="h-3.5 w-3.5" />
              Lock Admin Panel
            </button>
          )}
        </div>
      </div>

      {/* Summary Metrics Strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <div className="text-xs text-stone-500">Total Orders</div>
          <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-stone-900">
            {orders.length}
          </div>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <div className="text-xs text-stone-500">Pending Shiprocket Entry</div>
          <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-rose-900">
            {orders.filter((o) => o.status === 'pending').length}
          </div>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <div className="text-xs text-stone-500">Ready / Dispatched</div>
          <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-stone-900">
            {
              orders.filter(
                (o) => o.status === 'ready_for_shiprocket' || o.status === 'dispatched'
              ).length
            }
          </div>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <div className="text-xs text-stone-500">Delivered</div>
          <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-emerald-800">
            {orders.filter((o) => o.status === 'delivered').length}
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-stone-200/70 p-1">
          {(['all', 'pending', 'ready_for_shiprocket', 'dispatched', 'delivered'] as const).map(
            (st) => (
              <button
                key={st}
                type="button"
                onClick={() => setFilterStatus(st)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  filterStatus === st
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {st === 'all'
                  ? 'All Orders'
                  : st === 'pending'
                  ? 'Pending'
                  : st === 'ready_for_shiprocket'
                  ? 'In Shiprocket'
                  : st === 'dispatched'
                  ? 'Dispatched'
                  : 'Delivered'}
              </button>
            )
          )}
        </div>

        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter by phone, state, PIN, or book..."
            className="w-full rounded-lg border border-stone-300 bg-white py-2 pr-3.5 pl-9 text-xs text-stone-900 placeholder:text-stone-400 focus:border-rose-900 focus:outline-none"
          />
        </div>
      </div>

      {/* Orders List */}
      {isLoading ? (
        <div className="rounded-xl border border-stone-200 bg-white p-12 text-center text-sm text-stone-500">
          Loading incoming orders...
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white p-12 text-center">
          <Package className="mx-auto mb-3 h-10 w-10 text-stone-400" />
          <h3 className="font-serif text-xl font-semibold text-stone-900">
            No orders found
          </h3>
          <p className="mt-1 text-xs text-stone-500">
            When any customer clicks "Buy Now" on a book and submits their exact location and
            phone number, their order will appear here immediately.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredOrders.map((order) => {
            const coords = parseCoordinates(order.exactLocation);
            const dateDisplay = order.createdAt?.seconds
              ? new Date(order.createdAt.seconds * 1000).toLocaleString('en-IN', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })
              : 'Just now';

            return (
              <div
                key={order.id}
                className="overflow-hidden rounded-xl border border-stone-200 bg-white"
              >
                {/* Order Card Top Header */}
                <div className="flex flex-col gap-3 border-b border-stone-200 bg-[#FAF8F5] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600">
                    <span className="font-mono font-semibold text-stone-900">
                      ORDER #{order.id.slice(0, 8).toUpperCase()}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{dateDisplay}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-semibold text-rose-900">
                      {STATUS_LABELS[order.status]}
                    </span>
                  </div>

                  {/* Copy Entire Shiprocket Block Button */}
                  <button
                    type="button"
                    onClick={() =>
                      copyText(`block-${order.id}`, formatShiprocketBlock(order))
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg bg-rose-900 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-rose-800 whitespace-nowrap shrink-0 self-start"
                  >
                    {copiedId === `block-${order.id}` ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        Copied for Shiprocket
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy All for Shiprocket
                      </>
                    )}
                  </button>
                </div>

                {/* Order 3-Column Breakdown: (1) Sender Phone & Order Info, (2) Exact Location & State, (3) Full Shiprocket Address */}
                <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-3">
                  {/* Column 1: Which Phone Number Sent Which Book Order */}
                  <div className="space-y-4 rounded-lg border border-stone-200 bg-[#FAF8F5] p-4">
                    <div className="text-xs font-semibold text-stone-500">
                      01. Sender Phone Number & Book Ordered
                    </div>

                    <div>
                      <div className="text-[11px] text-stone-500">
                        Order Sent From Phone Number
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <a
                          href={`tel:${order.customerPhone}`}
                          className="inline-flex items-center gap-1.5 font-mono text-base font-bold tabular-nums text-rose-900 hover:underline"
                        >
                          <Phone className="h-4 w-4" />
                          {order.customerPhone}
                        </a>
                        <button
                          type="button"
                          onClick={() =>
                            copyText(`phone-${order.id}`, order.customerPhone)
                          }
                          className="inline-flex items-center gap-1 rounded border border-stone-300 bg-white px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-100 whitespace-nowrap shrink-0"
                        >
                          {copiedId === `phone-${order.id}` ? (
                            <Check className="h-3 w-3 text-emerald-700" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                          Copy Phone
                        </button>
                      </div>
                    </div>

                    <div className="border-t border-stone-200 pt-3">
                      <div className="text-[11px] text-stone-500">Book Ordered</div>
                      <div className="mt-0.5 font-serif text-base font-semibold text-stone-900">
                        {order.bookTitle}
                      </div>
                      <div className="text-xs text-stone-600">
                        Author: {order.bookAuthor} · Listed by {order.sellerName}
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Exact Location & State */}
                  <div className="space-y-4 rounded-lg border border-stone-200 bg-[#FAF8F5] p-4">
                    <div className="text-xs font-semibold text-stone-500">
                      02. Exact Location & State
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-stone-500">
                          Delivery State & PIN Code
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            copyText(
                              `state-${order.id}`,
                              `${order.state} - ${order.pincode}`
                            )
                          }
                          className="inline-flex items-center gap-1 rounded border border-stone-300 bg-white px-2 py-0.5 text-[11px] font-medium text-stone-700 hover:bg-stone-100 whitespace-nowrap shrink-0"
                        >
                          {copiedId === `state-${order.id}` ? (
                            <Check className="h-3 w-3 text-emerald-700" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                          Copy State/PIN
                        </button>
                      </div>
                      <div className="mt-1 text-base font-semibold text-stone-900">
                        {order.state}{' '}
                        <span className="font-mono text-sm tabular-nums text-rose-900">
                          ({order.pincode})
                        </span>
                      </div>
                      <div className="text-xs text-stone-600">City: {order.city}</div>
                    </div>

                    <div className="border-t border-stone-200 pt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-stone-500">
                          Exact Location (Step 1 Capture)
                        </span>
                        {coords && (
                          <a
                            href={`https://www.google.com/maps?q=${coords.lat},${coords.lng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-900 underline"
                          >
                            Open GPS Pin
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      <p className="mt-1 flex items-start gap-1.5 text-xs leading-relaxed text-stone-800">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-900" />
                        <span>{order.exactLocation}</span>
                      </p>
                    </div>
                  </div>

                  {/* Column 3: Shiprocket Ready Delivery Address & Dispatch Status */}
                  <div className="flex flex-col justify-between space-y-4 rounded-lg border border-stone-200 bg-[#FAF8F5] p-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-stone-500">
                          03. Shiprocket Delivery Address
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            copyText(
                              `addr-${order.id}`,
                              `${order.customerName}, ${order.fullAddress}${
                                order.landmark ? `, ${order.landmark}` : ''
                              }, ${order.city}, ${order.state} - ${order.pincode}`
                            )
                          }
                          className="inline-flex items-center gap-1 rounded border border-stone-300 bg-white px-2 py-0.5 text-[11px] font-medium text-stone-700 hover:bg-stone-100 whitespace-nowrap shrink-0"
                        >
                          {copiedId === `addr-${order.id}` ? (
                            <Check className="h-3 w-3 text-emerald-700" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                          Copy Address
                        </button>
                      </div>

                      <div className="rounded border border-stone-200 bg-white p-3 text-xs leading-relaxed text-stone-800">
                        <div className="font-semibold text-stone-900">
                          {order.customerName}
                        </div>
                        <div>{order.fullAddress}</div>
                        {order.landmark && (
                          <div className="text-stone-600">Landmark: {order.landmark}</div>
                        )}
                        <div className="font-medium">
                          {order.city}, {order.state} —{' '}
                          <span className="font-mono tabular-nums">{order.pincode}</span>
                        </div>
                      </div>
                    </div>

                    {/* Update Shiprocket Dispatch Status */}
                    <div className="border-t border-stone-200 pt-3">
                      <label
                        htmlFor={`status-select-${order.id}`}
                        className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-600"
                      >
                        <Truck className="h-3.5 w-3.5 text-stone-700" />
                        Update Shiprocket Fulfillment Status
                      </label>
                      <select
                        id={`status-select-${order.id}`}
                        disabled={updatingOrderId === order.id}
                        value={order.status}
                        onChange={(e) =>
                          handleStatusChange(order, e.target.value as OrderStatus)
                        }
                        className="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-900 focus:border-rose-900 focus:outline-none disabled:opacity-50"
                      >
                        <option value="pending">Pending — Ready to Copy to Shiprocket</option>
                        <option value="ready_for_shiprocket">
                          Entered in Shiprocket (AWB Created)
                        </option>
                        <option value="dispatched">Dispatched via Shiprocket Courier</option>
                        <option value="delivered">Delivered to Customer</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
