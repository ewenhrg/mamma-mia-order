'use client';

import { useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { guestQrImageUrl } from '@/lib/guest';

export type QrCard = {
  token: string;
  label: string;
  url: string;
};

export function QrPrintGrid({ cards }: { cards: QrCard[] }) {
  const [open, setOpen] = useState<QrCard | null>(null);

  return (
    <>
      <ul className="grid grid-cols-2 gap-4 p-4 md:grid-cols-3 print:grid-cols-3 print:gap-6">
        {cards.map((card) => (
          <li
            key={card.token}
            className="break-inside-avoid rounded-2xl border border-line bg-white p-3 text-center"
          >
            <button
              type="button"
              onClick={() => setOpen(card)}
              className="tap w-full print:pointer-events-none"
            >
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Mamma Mia</p>
              <p className="mt-1 text-2xl font-extrabold">Table {card.label}</p>
              <img
                src={guestQrImageUrl(card.url, 240)}
                alt={`QR table ${card.label}`}
                className="mx-auto mt-2 size-40"
              />
              <p className="mt-2 text-[11px] font-semibold text-ink-2">Scanne pour commander</p>
            </button>
          </li>
        ))}
      </ul>

      <Sheet
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open ? `QR · Table ${open.label}` : 'QR'}
        subtitle="Scanne pour commander"
      >
        {open ? (
          <div className="p-4">
            <img
              src={guestQrImageUrl(open.url, 640)}
              alt={`QR table ${open.label}`}
              className="mx-auto w-full max-w-sm rounded-2xl bg-white"
            />
          </div>
        ) : null}
      </Sheet>
    </>
  );
}
