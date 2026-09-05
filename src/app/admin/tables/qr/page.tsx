import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getStaffSession, getSupabaseServer } from '@/lib/supabase/server';
import { guestOrderUrl } from '@/lib/guest';
import { PrintButton } from '@/components/admin/PrintButton';
import { QrPrintGrid } from '@/components/admin/QrPrintGrid';
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
        <QrPrintGrid
          cards={printable.map((table) => ({
            token: table.guest_token!,
            label: table.label,
            url: guestOrderUrl(table.guest_token!, origin),
          }))}
        />
      )}
    </div>
  );
}
