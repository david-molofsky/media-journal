import { describe, expect, it } from 'vitest';
import { parseCsv } from './csvParser';

describe('parseCsv', () => {
  it('parses quoted commas, embedded newlines and escaped quotes', () => {
    const rows = parseCsv(
      'Title,Notes\r\n"A, B","Line one\r\nLine two"\r\nQuoted,"Said ""hello"""',
    );

    expect(rows).toEqual([
      { Title: 'A, B', Notes: 'Line one\nLine two' },
      { Title: 'Quoted', Notes: 'Said "hello"' },
    ]);
  });

  it('skips malformed rows without discarding valid rows', () => {
    expect(parseCsv('Title,Date\nValid,2026-01-01\nToo,many,columns')).toEqual([
      { Title: 'Valid', Date: '2026-01-01' },
    ]);
  });
});
