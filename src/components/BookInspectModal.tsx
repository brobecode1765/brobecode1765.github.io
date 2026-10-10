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
  conditionNote?: string;
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
  onDelete: (bookId: string) => Promise<void>;
  onBuyNow: (book: BookRecord) => void;
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

  if (!book) return null;

  const isOwner = Boolean(currentUserId && currentUserId === book.ownerId);

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(book.id);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/75 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inspect-book-title"
    >
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-stone-200 bg-[#FAF8F5] text-stone-900 shadow-2xl">
        {/* Top Bar */}
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
          <div className="min-w-0 pr-4">
            <div className="flex items-center gap-2 text-xs text-stone-500">
              <span>Added by {book.ownerName}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">3-Side Verified Record</span>
            </div>
            <h2
              id="inspect-book-title"
              className="truncate font-serif text-xl font-semibold text-stone-900"
            >
              {book.title}
            </h2>
            <p className="text-sm text-stone-600">By {book.author}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-stone-500 transition-colors hover:bg-stone-200/70 hover:text-stone-900"
            aria-label="Close inspection modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Main 3-Side Inspection Area */}
        <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-12">
          {/* Primary Enlarged Side Photo */}
          <div className="lg:col-span-8">
            <div className="relative aspect-4/3 w-full overflow-hidden rounded-xl border border-stone-200 bg-stone-100">
              <img
                src={book[selectedSide]}
                alt={`${book.title} — ${selectedSide}`}
                referrerPolicy="no-referrer"
                className="h-full w-full object-contain bg-stone-900/5"
              />
              <div className="absolute bottom-3 left-3 rounded bg-stone-950/75 px-3 py-1 font-mono text-xs text-stone-100 backdrop-blur-xs">
                {BOOK_SIDES.find((s) => s.key === selectedSide)?.label}
              </div>
            </div>
          </div>

          {/* All 3 Side Selector & Details */}
          <div className="flex flex-col justify-between gap-6 lg:col-span-4">
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-semibold tracking-wider text-stone-500 uppercase">
                  Inspect All 3 Sides
                </h3>
                <div className="mt-2.5 grid grid-cols-3 gap-2.5 lg:grid-cols-1">
                  {BOOK_SIDES.map((side) => {
                    const isSelected = selectedSide === side.key;
                    return (
                      <button
                        key={side.key}
                        type="button"
                        onClick={() => setSelectedSide(side.key)}
                        className={`flex items-center gap-3 rounded-lg border p-2 text-left transition-all ${
                          isSelected
                            ? 'border-rose-900 bg-rose-900/5 text-stone-900'
                            : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
                        }`}
                      >
                        <img
                          src={book[side.key]}
                          alt={side.shortLabel}
                          referrerPolicy="no-referrer"
                          className="h-12 w-12 shrink-0 rounded object-cover border border-stone-200"
                        />
                        <div className="min-w-0">
                          <div className="font-mono text-[11px] text-stone-500">
                            SIDE {side.stepNumber}
                          </div>
                          <div className="truncate text-xs font-semibold text-stone-900">
                            {side.shortLabel}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {book.conditionNote && (
                <div className="rounded-lg border border-stone-200 bg-white p-3.5">
                  <div className="text-xs font-semibold text-stone-500">
                    Condition & Edition Note
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-stone-700">
                    {book.conditionNote}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2.5 border-t border-stone-200 pt-4">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onBuyNow(book);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-rose-900 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-rose-800 whitespace-nowrap shrink-0"
              >
                Buy Now (Set Exact Location & Order)
              </button>

              {isOwner && (
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50/70 px-4 py-2.5 text-xs font-semibold text-rose-800 transition-colors hover:bg-rose-100 disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                  {isDeleting ? 'Removing from Archive...' : 'Remove My Book Listing'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
