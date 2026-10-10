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
  ArrowLeft,
  UserCheck,
  Navigation,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
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
  isSignedIn: boolean;
  orders: BookOrderRecord[];
  isLoading: boolean;
  onUpdateOrderStatus: (order: BookOrderRecord, newStatus: OrderStatus) => Promise<void>;
  onLockAdmin: () => void;
  onAdminGoogleSignIn?: () => Promise<void>;
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending Shiprocket',
  ready_for_shiprocket: 'Entered in Shiprocket',
  dispatched: 'Dispatched via Courier',
  delivered: 'Delivered',
};

export const AdminOrdersPanel: React.FC<AdminOrdersPanelProps> = ({
  adminEmail,
  isSignedIn,
  orders,
  isLoading,
  onUpdateOrderStatus,
  onLockAdmin,
  onAdminGoogleSignIn,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | OrderStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

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
      `Order ID: #${order.id.slice(0, 8).toUpperCase()}`,
      `Book Ordered: ${order.bookTitle} (by ${order.bookAuthor})`,
      `Customer Name: ${order.customerName}`,
      `Customer Phone: ${order.customerPhone}`,
      `Delivery Address: ${order.fullAddress}`,
      `Landmark: ${order.landmark || 'N/A'}`,
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
      'Sender Phone Number',
      'Address Line 1',
      'Landmark',
      'Exact Location (GPS / Locality)',
      'City',
      'State',
      'Pincode',
      'Fulfillment Status',
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
        o.landmark || '',
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
      o.exactLocation.toLowerCase().includes(q) ||
      o.id.toLowerCase().includes(q)
    );
  });

  const activeOrder =
    filteredOrders.find((o) => o.id === selectedOrderId) || filteredOrders[0] || null;

  const parseCoordinates = (loc: string): { lat: string; lng: string } | null => {
    const match = loc.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
    if (!match) return null;
    return { lat: match[1], lng: match[2] };
  };

  const pendingCount = orders.filter((o) => o.status === 'pending').length;
  const shiprocketCount = orders.filter((o) => o.status === 'ready_for_shiprocket').length;
  const dispatchedCount = orders.filter((o) => o.status === 'dispatched').length;
  const deliveredCount = orders.filter((o) => o.status === 'delivered').length;
  const uniqueStatesCount = new Set(orders.map((o) => o.state.trim()).filter(Boolean)).size;

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] text-slate-900">
      {/* =====================================================================
          LEFT SIDEBAR NAVIGATION (260px Desktop)
         ===================================================================== */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:justify-between border-r border-slate-200 bg-slate-900 text-slate-100 shrink-0">
        <div className="p-6 space-y-8">
          {/* Admin Brand Header */}
          <div>
            <div className="font-serif text-xl font-bold tracking-tight text-white">
              SARAS Admin
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Shiprocket Dispatch & Order Fulfillment
            </p>
          </div>

          {/* Queue Filter Navigation */}
          <div className="space-y-1">
            <div className="px-3 pb-2 text-[11px] font-medium text-slate-400">
              Dispatch Queues
            </div>

            <button
              type="button"
              onClick={() => setFilterStatus('all')}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium transition-colors ${
                filterStatus === 'all'
                  ? 'bg-rose-800 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span>All Orders</span>
              <span className="font-mono tabular-nums">{orders.length}</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterStatus('pending')}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium transition-colors ${
                filterStatus === 'pending'
                  ? 'bg-rose-800 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span>Pending Shiprocket</span>
              <span className="font-mono tabular-nums">{pendingCount}</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterStatus('ready_for_shiprocket')}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium transition-colors ${
                filterStatus === 'ready_for_shiprocket'
                  ? 'bg-rose-800 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span>Entered in Shiprocket</span>
              <span className="font-mono tabular-nums">{shiprocketCount}</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterStatus('dispatched')}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium transition-colors ${
                filterStatus === 'dispatched'
                  ? 'bg-rose-800 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span>Dispatched Courier</span>
              <span className="font-mono tabular-nums">{dispatchedCount}</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterStatus('delivered')}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium transition-colors ${
                filterStatus === 'delivered'
                  ? 'bg-rose-800 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span>Delivered</span>
              <span className="font-mono tabular-nums">{deliveredCount}</span>
            </button>
          </div>

          {/* Export Tool */}
          <div className="pt-4 border-t border-slate-800 space-y-2">
            <div className="px-1 text-[11px] font-medium text-slate-400">
              Bulk Shiprocket Export
            </div>
            <button
              type="button"
              onClick={handleExportShiprocketCsv}
              disabled={orders.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-40 whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
              Download Shiprocket CSV
            </button>
          </div>
        </div>

        {/* Bottom Exit & Lock */}
        <div className="border-t border-slate-800 p-6 space-y-3">
          <div className="truncate text-xs text-slate-400" title={adminEmail}>
            Unlocked by: <span className="font-mono text-slate-200">{adminEmail}</span>
          </div>
          <button
            type="button"
            onClick={onLockAdmin}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-rose-900 hover:text-white whitespace-nowrap shrink-0"
          >
            <Lock className="h-3.5 w-3.5" />
            Lock & Exit Admin Panel
          </button>
        </div>
      </aside>

      {/* =====================================================================
          MAIN ADMIN VIEWPORT
         ===================================================================== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract: Breadcrumb on Left, Primary Actions on Right */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-6 border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onLockAdmin}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0"
              title="Return to Marketplace"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Store
            </button>
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 truncate">
              <span>SARAS</span>
              <span aria-hidden="true">/</span>
              <span className="font-semibold text-slate-900">
                Owner Admin Panel (Shiprocket Delivery Console)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleExportShiprocketCsv}
              disabled={orders.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV ({orders.length})
            </button>

            <button
              type="button"
              onClick={onLockAdmin}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              <Lock className="h-3.5 w-3.5" />
              Lock Admin
            </button>
          </div>
        </header>

        {/* Main Workspace Body */}
        <main className="flex-1 p-6 lg:p-8 space-y-6 max-w-7xl w-full mx-auto">
          {!isSignedIn && onAdminGoogleSignIn && (
            <div className="flex flex-col gap-4 rounded-xl border border-amber-300 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-amber-950">
                  Connect Firebase Session to Load Live Cloud Orders
                </h2>
                <p className="text-xs text-amber-900">
                  You unlocked the Admin Panel with the secret password. Sign in with Google to
                  sync live orders from Firestore.
                </p>
              </div>
              <button
                type="button"
                onClick={onAdminGoogleSignIn}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-amber-800 whitespace-nowrap shrink-0"
              >
                <UserCheck className="h-4 w-4" />
                Connect Google Session
              </button>
            </div>
          )}

          {/* 4-Column KPI Metrics Row */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Total Book Orders</div>
              <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-slate-900">
                {orders.length}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                All incoming Buy Now orders
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">
                Pending Shiprocket Entry
              </div>
              <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-rose-800">
                {pendingCount}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Ready to copy address & dispatch
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">
                Active Delivery States
              </div>
              <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-slate-900">
                {uniqueStatesCount}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                States across placed orders
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">
                Dispatched & Delivered
              </div>
              <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-emerald-700">
                {dispatchedCount + deliveredCount}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Processed via Shiprocket
              </div>
            </div>
          </div>

          {/* Search & Mobile Filter Bar */}
          <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                ['all', 'pending', 'ready_for_shiprocket', 'dispatched', 'delivered'] as const
              ).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setFilterStatus(st)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    filterStatus === st
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  {st === 'all'
                    ? `All (${orders.length})`
                    : st === 'pending'
                    ? `Pending (${pendingCount})`
                    : st === 'ready_for_shiprocket'
                    ? `In Shiprocket (${shiprocketCount})`
                    : st === 'dispatched'
                    ? `Dispatched (${dispatchedCount})`
                    : `Delivered (${deliveredCount})`}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search phone number, state, PIN, book..."
                className="w-full rounded-lg border border-slate-300 bg-slate-50 py-2 pr-3.5 pl-9 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {/* Orders Content Area */}
          {isLoading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-16 text-center text-sm text-slate-500">
              Loading incoming customer orders...
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-16 text-center">
              <Package className="mx-auto mb-3 h-10 w-10 text-slate-400" />
              <h3 className="font-serif text-xl font-semibold text-slate-900">
                No orders in this queue yet
              </h3>
              <p className="mt-1 mx-auto max-w-md text-xs text-slate-500">
                When a buyer clicks "Buy Now" on a book and enters their exact location, state,
                and phone number, the complete Shiprocket dispatch record appears here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
              {/* Left Column (5 cols): High-Density Order Queue List */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden lg:col-span-5">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">
                    Incoming Order Queue
                  </span>
                  <span className="font-mono text-xs tabular-nums text-slate-500">
                    {filteredOrders.length} shown
                  </span>
                </div>

                <div className="divide-y divide-slate-200 max-h-[680px] overflow-y-auto">
                  {filteredOrders.map((ord) => {
                    const isSelected = activeOrder?.id === ord.id;
                    const dateShort = ord.createdAt?.seconds
                      ? new Date(ord.createdAt.seconds * 1000).toLocaleString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Just now';

                    return (
                      <button
                        key={ord.id}
                        type="button"
                        onClick={() => setSelectedOrderId(ord.id)}
                        className={`w-full text-left p-4 transition-colors ${
                          isSelected
                            ? 'bg-rose-50/70'
                            : 'bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-bold text-slate-900">
                            #{ord.id.slice(0, 8).toUpperCase()}
                          </span>
                          <span className="text-[11px] font-medium text-rose-900">
                            {STATUS_LABELS[ord.status]}
                          </span>
                        </div>

                        {/* Phone Number & Book Name */}
                        <div className="mt-2 flex items-center gap-1.5 font-mono text-sm font-bold tabular-nums text-rose-900">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          <span>{ord.customerPhone}</span>
                        </div>

                        <div className="mt-1 font-serif text-sm font-semibold text-slate-900 truncate">
                          {ord.bookTitle}
                        </div>

                        <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-600 truncate">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span className="font-medium text-slate-800">{ord.state}</span>
                          <span aria-hidden="true">·</span>
                          <span>{ord.city}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">{ord.pincode}</span>
                        </div>

                        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                          <span>Buyer: {ord.customerName}</span>
                          <span className="font-mono tabular-nums">{dateShort}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Column (7 cols): Selected Order Shiprocket Dispatch Inspector */}
              {activeOrder && (
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden lg:col-span-7">
                  {/* Inspector Header */}
                  <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-900 px-6 py-5 text-white sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-slate-300">
                        <span className="font-mono font-semibold text-white">
                          ORDER #{activeOrder.id.slice(0, 8).toUpperCase()}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {activeOrder.createdAt?.seconds
                            ? new Date(
                                activeOrder.createdAt.seconds * 1000
                              ).toLocaleString('en-IN', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })
                            : 'Just now'}
                        </span>
                      </div>
                      <h3 className="mt-1 font-serif text-xl font-semibold text-white">
                        {activeOrder.bookTitle}
                      </h3>
                      <p className="text-xs text-slate-300">
                        Author: {activeOrder.bookAuthor} · Added by {activeOrder.sellerName}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        copyText(
                          `full-${activeOrder.id}`,
                          formatShiprocketBlock(activeOrder)
                        )
                      }
                      className="inline-flex items-center gap-2 rounded-lg bg-rose-800 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-rose-700 whitespace-nowrap shrink-0 self-start"
                    >
                      {copiedId === `full-${activeOrder.id}` ? (
                        <>
                          <Check className="h-4 w-4" />
                          Copied Full Shiprocket Block
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copy All for Shiprocket
                        </>
                      )}
                    </button>
                  </div>

                  <div className="p-6 space-y-6">
                    {/* SECTION 1: FROM WHICH PHONE NUMBER THIS ORDER WAS SENT */}
                    <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="text-xs font-semibold text-rose-950">
                            01. Order Sent From Phone Number
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <Phone className="h-5 w-5 text-rose-900" />
                            <a
                              href={`tel:${activeOrder.customerPhone}`}
                              className="font-mono text-2xl font-bold tabular-nums text-rose-950 hover:underline"
                            >
                              {activeOrder.customerPhone}
                            </a>
                          </div>
                          <div className="mt-1 text-xs text-slate-600">
                            Customer Name: <strong>{activeOrder.customerName}</strong>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-start">
                          <button
                            type="button"
                            onClick={() =>
                              copyText(
                                `phone-${activeOrder.id}`,
                                activeOrder.customerPhone
                              )
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3.5 py-2 text-xs font-semibold text-rose-950 hover:bg-rose-100 whitespace-nowrap shrink-0"
                          >
                            {copiedId === `phone-${activeOrder.id}` ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-700" />
                                Copied Number
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" />
                                Copy Phone Number
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 2: EXACT LOCATION & STATE */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="text-xs font-semibold text-slate-700">
                            02. Exact Location & State (Captured at Buy Now)
                          </div>
                          <p className="text-xs text-slate-500">
                            Exact GPS coordinates / locality pinpoint and delivery state.
                          </p>
                        </div>

                        {(() => {
                          const coords = parseCoordinates(activeOrder.exactLocation);
                          const mapUrl = coords
                            ? `https://www.google.com/maps?q=${coords.lat},${coords.lng}`
                            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                `${activeOrder.exactLocation}, ${activeOrder.city}, ${activeOrder.state} ${activeOrder.pincode}`
                              )}`;
                          return (
                            <a
                              href={mapUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap shrink-0 self-start"
                            >
                              <Navigation className="h-3.5 w-3.5" />
                              Open Exact Location in Google Maps
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          );
                        })()}
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-white p-3.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-medium text-slate-500">
                            Exact Location String / Coordinates
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              copyText(
                                `exact-${activeOrder.id}`,
                                activeOrder.exactLocation
                              )
                            }
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-900 hover:underline"
                          >
                            {copiedId === `exact-${activeOrder.id}` ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <p className="mt-1 flex items-start gap-2 text-xs font-medium leading-relaxed text-slate-900">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-rose-800" />
                          <span>{activeOrder.exactLocation}</span>
                        </p>
                      </div>
                    </div>

                    {/* SECTION 3: SHIPROCKET FIELD-BY-FIELD COPY GRID */}
                    <div className="space-y-3">
                      <div className="text-xs font-semibold text-slate-700">
                        03. Shiprocket Delivery Fields (Click Any Field to Copy)
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {/* Customer Name */}
                        <div className="rounded-lg border border-slate-200 bg-white p-3.5">
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>Recipient Name</span>
                            <button
                              type="button"
                              onClick={() =>
                                copyText(
                                  `name-${activeOrder.id}`,
                                  activeOrder.customerName
                                )
                              }
                              className="font-semibold text-rose-900 hover:underline"
                            >
                              {copiedId === `name-${activeOrder.id}` ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                          <div className="mt-1 text-sm font-semibold text-slate-900">
                            {activeOrder.customerName}
                          </div>
                        </div>

                        {/* State */}
                        <div className="rounded-lg border border-slate-200 bg-white p-3.5">
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>State</span>
                            <button
                              type="button"
                              onClick={() =>
                                copyText(`st-${activeOrder.id}`, activeOrder.state)
                              }
                              className="font-semibold text-rose-900 hover:underline"
                            >
                              {copiedId === `st-${activeOrder.id}` ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                          <div className="mt-1 text-sm font-bold text-slate-900">
                            {activeOrder.state}
                          </div>
                        </div>

                        {/* City */}
                        <div className="rounded-lg border border-slate-200 bg-white p-3.5">
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>City / District</span>
                            <button
                              type="button"
                              onClick={() =>
                                copyText(`city-${activeOrder.id}`, activeOrder.city)
                              }
                              className="font-semibold text-rose-900 hover:underline"
                            >
                              {copiedId === `city-${activeOrder.id}` ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                          <div className="mt-1 text-sm font-semibold text-slate-900">
                            {activeOrder.city}
                          </div>
                        </div>

                        {/* PIN Code */}
                        <div className="rounded-lg border border-slate-200 bg-white p-3.5">
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>PIN Code / Postal Code</span>
                            <button
                              type="button"
                              onClick={() =>
                                copyText(`pin-${activeOrder.id}`, activeOrder.pincode)
                              }
                              className="font-semibold text-rose-900 hover:underline"
                            >
                              {copiedId === `pin-${activeOrder.id}` ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                          <div className="mt-1 font-mono text-sm font-bold tabular-nums text-rose-900">
                            {activeOrder.pincode}
                          </div>
                        </div>

                        {/* Complete Street Address */}
                        <div className="rounded-lg border border-slate-200 bg-white p-3.5 sm:col-span-2">
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>Complete Street / House Delivery Address</span>
                            <button
                              type="button"
                              onClick={() =>
                                copyText(
                                  `street-${activeOrder.id}`,
                                  `${activeOrder.fullAddress}${
                                    activeOrder.landmark
                                      ? `, Landmark: ${activeOrder.landmark}`
                                      : ''
                                  }`
                                )
                              }
                              className="font-semibold text-rose-900 hover:underline"
                            >
                              {copiedId === `street-${activeOrder.id}`
                                ? 'Copied Address'
                                : 'Copy Street Address'}
                            </button>
                          </div>
                          <div className="mt-1 text-sm font-medium text-slate-900">
                            {activeOrder.fullAddress}
                          </div>
                          {activeOrder.landmark && (
                            <div className="mt-1 text-xs text-slate-600">
                              Landmark: {activeOrder.landmark}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* SECTION 4: UPDATE SHIPROCKET STATUS */}
                    <div className="border-t border-slate-200 pt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                        <Truck className="h-4 w-4 text-slate-900" />
                        <span>Shiprocket Fulfillment Stage</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {(
                          [
                            { key: 'pending', label: 'Pending', icon: Clock },
                            {
                              key: 'ready_for_shiprocket',
                              label: 'In Shiprocket',
                              icon: Package,
                            },
                            { key: 'dispatched', label: 'Dispatched', icon: Truck },
                            {
                              key: 'delivered',
                              label: 'Delivered',
                              icon: CheckCircle2,
                            },
                          ] as const
                        ).map((st) => {
                          const Icon = st.icon;
                          const isCurrent = activeOrder.status === st.key;
                          return (
                            <button
                              key={st.key}
                              type="button"
                              disabled={updatingOrderId === activeOrder.id}
                              onClick={() => handleStatusChange(activeOrder, st.key)}
                              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                                isCurrent
                                  ? 'bg-slate-900 text-white'
                                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <Icon className="h-3.5 w-3.5" />
                              {st.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
