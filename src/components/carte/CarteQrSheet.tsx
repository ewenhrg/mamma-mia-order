'use client';

import { useMemo, useState } from 'react';
import { guestQrImageUrl } from '@/lib/guest';

const MAX_TABLES = 100;

/** "1-12, B1, B2" -> ["1", ..., "12", "B1", "B2"] */
function parseTables(input: string): string[] {
  const out: string[] = [];
  for (const raw of input.split(',')) {
    const part = raw.trim();
    if (!part) continue;
    const range = /^(\d+)\s*-\s*(\d+)$/.exec(part);
    if (range) {
      const from = Number(range[1]);
      const to = Number(range[2]);
      for (let n = Math.min(from, to); n <= Math.max(from, to) && out.length < MAX_TABLES; n += 1) {
        out.push(String(n));
      }
    } else if (out.length < MAX_TABLES) {
      out.push(part.slice(0, 20));
    }
  }
  return Array.from(new Set(out));
}

function QrCard({ url, title, size }: { url: string; title: string; size: 'lg' | 'sm' }) {
  return (
    <div className="break-inside-avoid rounded-3xl border-2 border-[#A87C36] bg-[#FBF6EC] p-5 text-center text-[#3A2A19]">
      <img src="/menu/logo.png" alt="Mamma Mia Beach Club" className={`mx-auto ${size === 'lg' ? 'w-44' : 'w-28'}`} />
      <p
        className={`mt-1 font-bold tracking-[0.14em] text-[#A87C36] [font-family:var(--font-carte-display)] ${
          size === 'lg' ? 'text-2xl' : 'text-lg'
        }`}
      >
        {title}
      </p>
      <img
        src={guestQrImageUrl(url, size === 'lg' ? 520 : 300)}
        alt={`QR ${title}`}
        className={`mx-auto mt-3 rounded-xl bg-white p-2 ${size === 'lg' ? 'size-64' : 'size-40'}`}
      />
      <p className="mt-3 text-sm font-semibold">Scannez · Choisissez · Montrez au serveur</p>
      <p className="text-xs italic text-[#7C6A52]">Scan · Choose · Show the waiter</p>
    </div>
  );
}

export function CarteQrSheet({ origin }: { origin: string }) {
  const [tablesInput, setTablesInput] = useState('');
  const tables = useMemo(() => parseTables(tablesInput), [tablesInput]);
  const menuUrl = `${origin}/menu`;

  return (
    <div className="min-h-[100dvh] bg-white">
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 print:hidden">
        <h1 className="text-xl font-extrabold text-ink">QR code du menu client</h1>
        <p className="text-sm text-ink-2">
          Le QR général ouvre <span className="font-mono text-xs">{menuUrl}</span>. Pour des QR par table,
          saisis les numéros (ex. <span className="font-mono text-xs">1-24, B1, B2</span>) : la table s’affichera
          automatiquement sur l’écran que le client montre au serveur.
        </p>
        <input
          type="text"
          value={tablesInput}
          onChange={(e) => setTablesInput(e.target.value)}
          placeholder="Tables : 1-24, B1, B2…"
          className="h-12 w-full rounded-xl border border-line px-4 outline-none focus:border-[#A87C36]"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="tap h-12 flex-1 rounded-xl bg-ink font-bold text-white"
          >
            Imprimer
          </button>
          <a
            href="/menu"
            target="_blank"
            rel="noreferrer"
            className="tap flex h-12 flex-1 items-center justify-center rounded-xl border border-line font-bold text-ink"
          >
            Voir le menu
          </a>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 pb-10">
        {tables.length === 0 ? (
          <div className="mx-auto max-w-sm">
            <QrCard url={menuUrl} title="MENU" size="lg" />
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 print:grid-cols-3">
            {tables.map((table) => (
              <li key={table}>
                <QrCard
                  url={`${menuUrl}?table=${encodeURIComponent(table)}`}
                  title={`TABLE ${table}`}
                  size="sm"
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
