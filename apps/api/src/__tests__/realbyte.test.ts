import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseAmountMinor, parseDate, parseRealbyteFile } from '../lib/realbyte.js';

function workbook(rows: Record<string, unknown>[]): ArrayBuffer {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

describe('parseDate', () => {
  it('parses mm/dd/yyyy (Realbyte format)', () => {
    expect(parseDate('11/15/2023')).toBe('2023-11-15');
    expect(parseDate('9/2/2026')).toBe('2026-09-02');
  });
  it('parses ISO', () => {
    expect(parseDate('2026-09-22')).toBe('2026-09-22');
  });
  it('parses unambiguous dd/mm/yyyy', () => {
    expect(parseDate('22/09/2026')).toBe('2026-09-22');
  });
  it('rejects garbage', () => {
    expect(parseDate('hello')).toBeNull();
    expect(parseDate('')).toBeNull();
  });
});

describe('parseAmountMinor', () => {
  it('parses plain numbers', () => {
    expect(parseAmountMinor(75000)).toBe(75000);
    expect(parseAmountMinor('75000')).toBe(75000);
  });
  it('strips thousand separators', () => {
    expect(parseAmountMinor('1.234.567')).toBe(1234567);
    expect(parseAmountMinor('75,000')).toBe(75000);
  });
  it('strips currency', () => {
    expect(parseAmountMinor('Rp 75.000')).toBe(75000);
    expect(parseAmountMinor('$1,234.56')).toBe(1235); // minor units are integers
  });
});

describe('parseRealbyteFile', () => {
  const HEADERS = {
    Date: '11/15/2023',
    Account: 'Cash',
    Category: 'Food',
    Subcategory: 'Dining Out',
    Note: 'lunch',
    Amount: '45,000',
    'Income/Expense': 'Expenses',
    Description: 'nasi padang',
  };

  it('parses the documented Realbyte column layout', () => {
    const out = parseRealbyteFile(workbook([HEADERS]));
    expect(out.errors).toEqual([]);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0]).toMatchObject({
      type: 'expense',
      date: '2023-11-15',
      amountMinor: 45000,
      account: 'Cash',
      category: 'Food',
      subcategory: 'Dining Out',
      memo: 'lunch — nasi padang',
    });
  });

  it('maps Transfer-Out to transfer with category as destination', () => {
    const out = parseRealbyteFile(
      workbook([{ ...HEADERS, 'Income/Expense': 'Transfer-Out', Category: 'Bank', Amount: '100,000' }]),
    );
    expect(out.rows[0]).toMatchObject({ type: 'transfer', account: 'Cash', category: 'Bank' });
  });

  it('reports row errors without aborting', () => {
    const out = parseRealbyteFile(
      workbook([HEADERS, { ...HEADERS, Date: 'not a date' }, { ...HEADERS, Account: '' }]),
    );
    expect(out.rows).toHaveLength(1);
    expect(out.errors).toHaveLength(2);
    expect(out.errors.map((e) => e.row)).toEqual([3, 4]);
  });

  it('rejects files missing required columns', () => {
    const out = parseRealbyteFile(workbook([{ Foo: 1, Bar: 2 }]));
    expect(out.rows).toHaveLength(0);
    expect(out.errors[0]!.message).toMatch(/Missing required columns/);
  });
});
