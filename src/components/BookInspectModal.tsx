import React, { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { BOOK_SIDES, BookSideKey } from './CameraModal';

export interface BookRecord {
  id: string;
  title: string;
  author: string;
  frontPhoto: string;
  spinePhoto: string;
  backPhoto: string;
  conditionNote: string;
  ownerId: string;
  ownerName: string;
  visibility: 'public';
  createdAt?: { seconds: number; nanoseconds: number } | null;
  updatedAt?: { seconds: number; nanoseconds: number } | null;
}

interface BookInspectModalProps {
  book: BookRecord | null;
  currentUserId?: string;
  onClose: () => void;
  onDelete?: (bookId: string) => Promise<void>;
  onBuyNow?: (book: BookRecord) => void;
}

export const BookInspectModal: React.FC<BookInspectModalProps> = ({
  book,
  currentUserId,
  onClose,
  onDelete,
  onBuyNow,
}) => {
  const [selectedSide, setSelectedSide] = useState<BookSideKey>('frontPhoto');
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!book) return null;

  const isOwner = Boolean(currentUserId && book.ownerId === currentUserId);
  const formattedDate = book.createdAt?.seconds
    ? new Date(book.createdAt.seconds * 1000).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Recently cataloged';

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(book.id);
      onClose();
    } finally {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/75 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inspect-book-title"
    >
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-stone-200 bg-[#FAF8F5] text-stone-900 shadow-2xl">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-stone-200 bg-white px-6 py-4">
          <div className="flex items-center gap-2 text-xs text-stone-500">
            <span>3-Side Archival Inspection</span>
            <span aria-hidden="true">·</span>
            <span>Added by {book.ownerName}</span>
            <span aria-hidden="true">·</span>
            <span>{formattedDate}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900"
            aria-label="Close inspection view"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Main 2-Column Content */}
        <div className="grid grid-cols-1 gap-8 p-6 lg:grid-cols-12 lg:items-stretch">
          {/* Left Column: Active Side Image + 3-Side Strip */}
          <div className="flex flex-col gap-4 lg:col-span-7">
            <div className="relative aspect-4/3 w-full overflow-hidden rounded-lg border border-stone-200 bg-stone-100">
              <img
                src={book[selectedSide]}
                alt={`${book.title} — ${selectedSide}`}
                referrerPolicy="no-referrer"
                className="h-full w-full object-contain bg-stone-900/5"
              />
            </div>

            {/* All 3 Sides Selector Strip */}
            <div className="grid grid-cols-3 gap-3">
              {BOOK_SIDES.map((side) => {
                const isSelected = selectedSide === side.key;
                return (
                  <button
                    key={side.key}
                    type="button"
                    onClick={() => setSelectedSide(side.key)}
                    className={`group flex flex-col overflow-hidden rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'border-rose-900 bg-white shadow-xs'
                        : 'border-stone-200 bg-white/60 hover:border-stone-400'
                    }`}
                  >
                    <div className="aspect-4/3 w-full overflow-hidden bg-stone-100">
                      <img
                        src={book[side.key]}
                        alt={`${book.title} ${side.shortLabel}`}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover transition-transform duration-150 group-hover:scale-105"
                      />
                    </div>
                    <div className="px-2.5 py-2 text-xs font-medium text-stone-800">
                      {side.stepNumber}. {side.shortLabel}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Contiguous Book Record Details */}
          <div className="flex flex-col justify-between rounded-lg border border-stone-200 bg-white p-6 lg:col-span-5">
            <div className="space-y-6">
              <div>
                <div className="text-xs font-medium text-stone-500">
                  Book Title & Author Record
                </div>
                <h2
                  id="inspect-book-title"
                  className="mt-1 font-serif text-2xl font-semibold text-stone-900"
                >
                  {book.title}
                </h2>
                <p className="mt-1 text-base font-medium text-stone-700">
                  By {book.author}
                </p>
              </div>

              <div className="space-y-3 border-t border-stone-200 pt-4 text-sm">
                <div className="flex items-baseline justify-between">
                  <span className="text-stone-500">Added By</span>
                  <span className="font-medium text-stone-900">{book.ownerName}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-stone-500">Photographed Sides</span>
                  <span className="font-mono text-xs tabular-nums text-stone-800">
                    3 / 3 (Front · Spine · Back)
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-stone-500">Catalog Date</span>
                  <span className="font-mono text-xs tabular-nums text-stone-700">
                    {formattedDate}
                  </span>
                </div>
              </div>

              {book.conditionNote && (
                <div className="border-t border-stone-200 pt-4">
                  <div className="text-xs font-medium text-stone-500">
                    Condition & Edition Notes
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-stone-700">
                    {book.conditionNote}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-8 border-t border-stone-200 pt-4 space-y-2.5">
              {onBuyNow && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onBuyNow(book);
                  }}
                  className="w-full rounded-lg bg-rose-900 px-4 py-3 text-xs font-semibold text-white transition-colors hover:bg-rose-800 whitespace-nowrap shrink-0"
                >
                  Buy Now (Set Exact Location & Delivery Address)
                </button>
              )}
              {isOwner && onDelete ? (
                !confirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50/60 px-4 py-2.5 text-xs font-semibold text-rose-900 transition-colors hover:bg-rose-100 whitespace-nowrap shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove Book from Archive
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-rose-900">
                      Permanently delete "{book.title}" from the catalog?
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={handleDelete}
                        className="flex-1 rounded-lg bg-rose-800 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50 whitespace-nowrap shrink-0"
                      >
                        {isDeleting ? 'Removing...' : 'Confirm Delete'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        className="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 whitespace-nowrap shrink-0"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full rounded-lg bg-stone-900 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-stone-800 whitespace-nowrap shrink-0"
                >
                  Close Inspection
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
