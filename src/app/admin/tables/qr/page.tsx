import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getStaffSession, getSupabaseServer } from '@/lib/supabase/server';
import { guestOrderUrl, guestQrImageUrl } from '@/lib/guest';
import { PrintButton } from '@/components/admin/PrintButton';
import { QrStaffCopy } from '@/components/admin/QrStaffCopy';
import { sortByTableLabel } from '@/lib/tableSort';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'QR clients — Tables' };

export default async function PrintQrPage() {
  const staff = await getStaffSession();
  if (!staff) redirect('/login');
  if (!staff.active || staff.role === 'server') redirect('/');

  const headerList = await headers();
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host') ?? 'localhost:3000';
  const proto = headerList.get('x-forwarded-proto') ?? 'http';
  const origin = `${proto}://${host}`;

  const supabase = await getSupabaseServer();
  const { data: tables } = await supabase
    .from('restaurant_tables')
    .select('label, guest_token, sort_order, active')
    .eq('active', true)
    .order('sort_order');

  const printable = sortByTableLabel((tables ?? []).filter((t) => Boolean(t.guest_token)));

  return (
    <div className="bg-white text-ink">
      <div className="print:hidden mx-auto max-w-3xl space-y-3 px-3 py-4">
        <QrStaffCopy empty={false} />
        <PrintButton />
      </div>

      {printable.length === 0 ? (
        <QrStaffCopy empty />
      ) : (
        <ul className="grid grid-cols-2 gap-4 p-4 md:grid-cols-3 print:grid-cols-3 print:gap-6">
          {printable.map((table) => {
            const url = guestOrderUrl(table.guest_token!, origin);
            return (
              <li
                key={table.guest_token}
                className="break-inside-avoid rounded-2xl border border-line bg-white p-3 text-center"
              >
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Mamma Mia</p>
                <p className="mt-1 text-2xl font-extrabold">Table {table.label}</p>
                <img
                  src={guestQrImageUrl(url, 240)}
                  alt={`QR table ${table.label}`}
                  className="mx-auto mt-2 size-40"
                />
                <p className="mt-2 text-[11px] font-semibold text-ink-2">Scanne pour commander</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
