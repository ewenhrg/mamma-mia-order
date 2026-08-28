'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/admin/menu', label: 'Menu' },
  { href: '/admin/tables', label: 'Tables' },
  { href: '/admin/staff', label: 'Equipe' },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="no-scrollbar flex gap-2 overflow-x-auto px-3 pb-2.5">
      {LINKS.map((link) => {
        const active = pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`tap flex h-11 shrink-0 items-center rounded-full px-4 text-[15px] font-bold ${
              active ? 'bg-ink text-white' : 'border border-line bg-surface text-ink-2'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
