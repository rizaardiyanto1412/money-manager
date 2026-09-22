import * as XLSX from 'xlsx';

/** Realbyte "Money Manager" Excel export/import columns (help.realbyteapps.com):
 * Date – Account – Category – Subcategory – Note – Amount – Income/Expense – Description
 * Transfers: type "Transfer-Out", Account = source, Category = destination account. */

export interface ParsedRow {
  row: number;
  type: 'expense' | 'income' | 'transfer';
  date: string;
  amountMinor: number;
  account: string;
  category?: string;
  subcategory?: string;
  memo?: string;
}

export interface RowError {
  row: number;
  message: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  errors: RowError[];
  headers: string[];
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

const ALIASES: Record<string, string[]> = {
  date: ['date'],
  account: ['account', 'asset', 'fromaccount', 'from'],
  category: ['category', 'toaccount', 'to'],
  subcategory: ['subcategory', 'subcat'],
  note: ['note', 'title'],
  amount: ['amount', 'value', 'money'],
  type: ['type', 'incomeexpense', 'kind'],
  description: ['description', 'memo', 'desc'],
};

function columnFor(headers: string[], key: string): string | undefined {
  const map = new Map(headers.map((h) => [norm(h), h]));
  for (const alias of ALIASES[key]!) {
    const hit = map.get(norm(alias));
    if (hit) return hit;
  }
  return undefined;
}

export function parseDate(raw: unknown): string | null {
  if (raw instanceof Date && !isNaN(raw.getTime())) return raw.toISOString().slice(0, 10);
  const s = String(raw).trim();
  if (!s) return null;
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (m) return `${m[1]}-${m[2]!.padStart(2, '0')}-${m[3]!.padStart(2, '0')}`;
  // Realbyte writes mm/dd/yyyy
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(s);
  if (m) {
    const [, a, b, y] = m;
    if (Number(a) <= 12 || Number(b) > 12)
      return `${y}-${a!.padStart(2, '0')}-${b!.padStart(2, '0')}`;
    // unambiguously dd/mm
    return `${y}-${b!.padStart(2, '0')}-${a!.padStart(2, '0')}`;
  }
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/.exec(s);
  if (m) {
    const [, a, b, y] = m;
    return `20${y}-${a!.padStart(2, '0')}-${b!.padStart(2, '0')}`;
  }
  return null;
}

export function parseAmountMinor(raw: unknown): number | null {
  if (typeof raw === 'number' && isFinite(raw)) return Math.round(Math.abs(raw));
  const s = String(raw).replace(/[^\d.,()-]/g, '');
  if (!s) return null;
  const negative = /^-|\(.*\)$/.test(s);
  // strip thousand separators: commas followed by groups of 3, or dots if no comma
  let t = s.replace(/[()-]/g, '');
  if (t.includes(',') && t.includes('.')) {
    t = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
    t = t.replace(/\./g, ''); // Rp-style thousand dots
  } else {
    t = t.replace(/,/g, '');
  }
  const n = Number(t);
  if (!isFinite(n)) return null;
  return Math.round(Math.abs(n)) * (negative ? -1 : 1);
}

function parseType(raw: unknown): ParsedRow['type'] | null {
  const s = String(raw).trim().toLowerCase().replace(/[^a-z]/g, '');
  if (s.startsWith('income')) return 'income';
  if (s.startsWith('transfer')) return 'transfer';
  if (s.startsWith('expense')) return 'expense';
  return null;
}

export function parseRealbyteFile(buf: ArrayBuffer | Uint8Array): ParseResult {
  const wb = XLSX.read(buf, { type: 'array', cellDates: false });
  const sheet = wb.Sheets[wb.SheetNames[0]!];
  if (!sheet) return { rows: [], errors: [{ row: 0, message: 'No sheet found' }], headers: [] };

  const table = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  });
  const headers = table.length > 0 ? Object.keys(table[0]!) : [];
  const col = {
    date: columnFor(headers, 'date'),
    account: columnFor(headers, 'account'),
    category: columnFor(headers, 'category'),
    subcategory: columnFor(headers, 'subcategory'),
    note: columnFor(headers, 'note'),
    amount: columnFor(headers, 'amount'),
    type: columnFor(headers, 'type'),
    description: columnFor(headers, 'description'),
  };
  if (!col.date || !col.account || !col.amount) {
    return {
      rows: [],
      errors: [
        {
          row: 0,
          message: `Missing required columns (need date/account/amount). Found: ${headers.join(', ')}`,
        },
      ],
      headers,
    };
  }

  const rows: ParsedRow[] = [];
  const errors: RowError[] = [];
  table.forEach((r, i) => {
    const rowNum = i + 2; // header is row 1
    const date = parseDate(r[col.date!]);
    const amount = parseAmountMinor(r[col.amount!]);
    const account = String(r[col.account!] ?? '').trim();
    const category = col.category ? String(r[col.category] ?? '').trim() : '';
    const subcategory = col.subcategory ? String(r[col.subcategory] ?? '').trim() : '';
    const note = col.note ? String(r[col.note] ?? '').trim() : '';
    const description = col.description ? String(r[col.description] ?? '').trim() : '';
    const type = col.type ? parseType(r[col.type]) : null;
    const amountMinor = amount === null ? null : Math.abs(amount);

    if (!date && !amount && !account) return; // fully blank row
    if (!date) return errors.push({ row: rowNum, message: `Bad date "${String(r[col.date!])}"` });
    if (amount === null || amountMinor === 0)
      return errors.push({ row: rowNum, message: `Bad amount "${String(r[col.amount!])}"` });
    if (!account) return errors.push({ row: rowNum, message: 'Missing account' });
    const resolvedType = type ?? (amount < 0 ? 'expense' : 'income');
    if (resolvedType !== 'transfer' && !category)
      return errors.push({ row: rowNum, message: 'Missing category' });
    if (resolvedType === 'transfer' && !category)
      return errors.push({ row: rowNum, message: 'Transfer missing destination account (Category col)' });

    rows.push({
      row: rowNum,
      type: resolvedType,
      date,
      amountMinor: amountMinor!,
      account,
      category: category || undefined,
      subcategory: subcategory || undefined,
      memo: [note, description].filter(Boolean).join(' — ') || undefined,
    });
  });
  return { rows, errors, headers };
}
