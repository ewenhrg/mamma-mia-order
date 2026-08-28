export function guestOrderPath(token: string): string {
  return `/t/${token}`;
}

export function guestOrderUrl(token: string, origin?: string): string {
  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}${guestOrderPath(token)}`;
}

export function guestQrImageUrl(pageUrl: string, size = 280): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(pageUrl)}`;
}
