/** Format minor units with thousand separators (IDR-style, no decimals for MVP). */
export function formatMinor(minor: number, currency = 'IDR'): string {
  const sign = minor < 0 ? '-' : '';
  const digits = String(Math.abs(minor)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return currency === 'IDR' ? `${sign}Rp ${digits}` : `${sign}${digits} ${currency}`;
}

export function formatSigned(minor: number, type: string, currency = 'IDR'): string {
  const prefix = type === 'expense' ? '-' : type === 'income' ? '+' : '';
  return `${prefix}${formatMinor(minor, currency)}`;
}

export const today = () => new Date().toISOString().slice(0, 10);
