// Test bổ sung bước 31 (Ảnh theo năm), viết theo spec mục 31 trong docs/buoc-28-32-mua-hoa.md: ca biên.
import { describe, expect, it } from 'vitest';
import {
  firstSentSummary,
  formatTakenOn,
  getDistinctYears,
  getPhotoYear,
  groupByYear,
} from './photoYear';

describe('bước 31 – ca biên', () => {
  it('mùa vắt qua năm: ảnh T12/2025 và T1/2026 thuộc hai năm khác nhau', () => {
    const photos = [
      { id: 'a', taken_on: '2025-12-28' },
      { id: 'b', taken_on: '2026-01-03' },
    ];
    const g = groupByYear(photos);
    expect(g[2025].map((p) => p.id)).toEqual(['a']);
    expect(g[2026].map((p) => p.id)).toEqual(['b']);
    expect(getDistinctYears(photos)).toEqual([2026, 2025]);
    expect(firstSentSummary(photos)).toBe('Năm 2026 ảnh đầu tiên gửi ngày 3/1, năm 2025 ngày 28/12');
  });

  it('ngày 31/12 và 1/1 rơi đúng năm của chuỗi taken_on', () => {
    expect(getPhotoYear({ taken_on: '2025-12-31' })).toBe(2025);
    expect(getPhotoYear({ taken_on: '2026-01-01' })).toBe(2026);
  });

  it('29/2 năm nhuận hợp lệ', () => {
    expect(getPhotoYear({ taken_on: '2024-02-29' })).toBe(2024);
    expect(formatTakenOn('2024-02-29')).toBe('Chụp 29/02/2024');
  });

  it('29/2 năm không nhuận không được hiển thị như ngày thật', () => {
    expect(formatTakenOn('2026-02-29')).not.toBe('Chụp 29/02/2026');
  });

  it('ngày không tồn tại (30/2, 31/4) không được hiển thị như ngày thật', () => {
    expect(formatTakenOn('2026-02-30')).not.toBe('Chụp 30/02/2026');
    expect(formatTakenOn('2026-04-31')).not.toBe('Chụp 31/04/2026');
  });

  it('giá trị rác: tháng/ngày ngoài khoảng, kiểu sai → không có năm, không ném lỗi', () => {
    expect(getPhotoYear({ taken_on: '2026-13-45' })).toBeUndefined();
    expect(getPhotoYear({ taken_on: '00/00/0000' })).toBeUndefined();
    expect(getPhotoYear({ taken_on: 'abc' })).toBeUndefined();
    expect(getPhotoYear({ taken_on: {} as unknown as string })).toBeUndefined();
    expect(getPhotoYear({ taken_on: [] as unknown as string })).toBeUndefined();
    expect(getPhotoYear({ taken_on: NaN as unknown as string })).toBeUndefined();
    expect(getPhotoYear({ taken_on: new Date('x') as unknown as string })).toBeUndefined();
  });

  it('taken_on rác nhưng created_at hợp lệ thì dùng created_at', () => {
    expect(getPhotoYear({ taken_on: 'rác', created_at: '2025-10-20T01:00:00Z' })).toBe(2025);
  });

  it('formatTakenOn với giá trị rác không ném lỗi và không trả "Chụp undefined/null"', () => {
    for (const v of [undefined, null, '', '  ', 123 as unknown as string, {} as unknown as string]) {
      const out = formatTakenOn(v);
      expect(out).not.toMatch(/undefined|null|NaN|object/);
    }
  });

  it('groupByYear bỏ qua phần tử rác trong mảng, không crash', () => {
    const good = { id: 'g', taken_on: '2026-10-12' };
    const arr = [null, undefined, 42, 'x', good] as unknown as (typeof good)[];
    const g = groupByYear(arr);
    expect(g[2026]).toEqual([good]);
  });

  it('firstSentSummary: không dùng dữ liệu rỗng/rác, chỉ 1 năm hợp lệ → rỗng', () => {
    expect(firstSentSummary([{}, { taken_on: 'rác' }])).toBe('');
    expect(firstSentSummary([{ taken_on: '2026-10-12' }, { taken_on: 'rác' }])).toBe('');
  });

  it('firstSentSummary: ngày sớm nhất mỗi năm không phụ thuộc thứ tự đầu vào', () => {
    const a = [
      { taken_on: '2025-11-05' },
      { taken_on: '2026-10-25' },
      { taken_on: '2025-10-20' },
      { taken_on: '2026-10-12' },
    ];
    const expected = 'Năm 2026 ảnh đầu tiên gửi ngày 12/10, năm 2025 ngày 20/10';
    expect(firstSentSummary(a)).toBe(expected);
    expect(firstSentSummary([...a].reverse())).toBe(expected);
  });

  it('firstSentSummary nhận cả kết quả của groupByYear', () => {
    const g = groupByYear([{ taken_on: '2026-10-12' }, { taken_on: '2025-10-20' }]);
    expect(firstSentSummary(g)).toBe('Năm 2026 ảnh đầu tiên gửi ngày 12/10, năm 2025 ngày 20/10');
  });

  it('groupByYear không tạo khoá ngoài các năm (chỉ chip năm thật)', () => {
    const g = groupByYear([{ taken_on: '2026-10-12' }, { id: 'x' }]);
    expect(Object.keys(g)).toEqual(['2026']);
  });
});
