// Test bước 31 (Ảnh theo năm) theo spec docs/buoc-28-32-mua-hoa.md mục 31.
import { describe, expect, it } from 'vitest';
import {
  firstSentSummary,
  formatTakenOn,
  getDistinctYears,
  getEarliestPhotoInYear,
  getPhotoYear,
  groupByYear,
  parsePhotoDate,
} from './photoYear';
import * as fromPublicPhotos from './publicPhotos';

describe('xuất khẩu tương thích', () => {
  it('publicPhotos re-export đủ các hàm thuần của bước 31', () => {
    expect(fromPublicPhotos.groupByYear).toBe(groupByYear);
    expect(fromPublicPhotos.getPhotoYear).toBe(getPhotoYear);
    expect(fromPublicPhotos.formatTakenOn).toBe(formatTakenOn);
    expect(fromPublicPhotos.getDistinctYears).toBe(getDistinctYears);
    expect(fromPublicPhotos.firstSentSummary).toBe(firstSentSummary);
  });
});

describe('getPhotoYear & parsePhotoDate', () => {
  it('ưu tiên taken_on trước, thiếu mới lấy created_at', () => {
    const both = { taken_on: '2025-10-17', created_at: '2026-01-01T00:00:00Z' };
    expect(getPhotoYear(both)).toBe(2025);

    const onlyCreated = { created_at: '2026-10-20T12:00:00Z' };
    expect(getPhotoYear(onlyCreated)).toBe(2026);

    const onlyTaken = { taken_on: '2024-03-15' };
    expect(getPhotoYear(onlyTaken)).toBe(2024);
  });

  it('hỗ trợ cả camelCase (takenOn, createdAt)', () => {
    expect(getPhotoYear({ takenOn: '2026-10-17' })).toBe(2026);
    expect(getPhotoYear({ createdAt: '2025-05-01' })).toBe(2025);
  });

  it('nhận các định dạng ngày: YYYY-MM-DD, DD/MM/YYYY, Date object', () => {
    expect(getPhotoYear({ taken_on: '2026-10-17' })).toBe(2026);
    expect(getPhotoYear({ taken_on: '17/10/2026' })).toBe(2026);
    expect(getPhotoYear({ taken_on: '2026/10/17' })).toBe(2026);
    expect(getPhotoYear({ taken_on: new Date(Date.UTC(2026, 9, 17)) })).toBe(2026);
  });

  it('dữ liệu rỗng, sai định dạng hoặc không có ngày trả về undefined', () => {
    expect(getPhotoYear(null)).toBeUndefined();
    expect(getPhotoYear(undefined)).toBeUndefined();
    expect(getPhotoYear({})).toBeUndefined();
    expect(getPhotoYear({ taken_on: '' })).toBeUndefined();
    expect(getPhotoYear({ taken_on: 'không phải ngày' })).toBeUndefined();
  });
});

describe('formatTakenOn', () => {
  it('dưới mỗi ảnh ghi "Chụp 17/10/2026" khi có taken_on (YYYY-MM-DD)', () => {
    expect(formatTakenOn('2026-10-17')).toBe('Chụp 17/10/2026');
  });

  it('đã là DD/MM/YYYY thì thêm tiền tố Chụp', () => {
    expect(formatTakenOn('17/10/2026')).toBe('Chụp 17/10/2026');
  });

  it('nếu đã có chữ "Chụp" thì không lặp từ', () => {
    expect(formatTakenOn('Chụp 17/10/2026')).toBe('Chụp 17/10/2026');
  });

  it('chèn số 0 vào ngày/tháng 1 chữ số trong DD/MM/YYYY', () => {
    expect(formatTakenOn('2026-05-04')).toBe('Chụp 04/05/2026');
    expect(formatTakenOn('4/5/2026')).toBe('Chụp 04/05/2026');
  });

  it('thiếu taken_on hoặc rỗng trả về chuỗi rỗng', () => {
    expect(formatTakenOn('')).toBe('');
    expect(formatTakenOn(null)).toBe('');
    expect(formatTakenOn(undefined)).toBe('');
    expect(formatTakenOn('   ')).toBe('');
  });
});

describe('groupByYear: hàm thuần theo spec', () => {
  const p1 = { id: 'p1', taken_on: '2026-10-12', author: 'A' };
  const p2 = { id: 'p2', taken_on: '2026-10-25', author: 'B' };
  const p3 = { id: 'p3', taken_on: '2025-10-20', author: 'C' };
  const p4 = { id: 'p4', created_at: '2025-11-05T00:00:00Z', author: 'D' };
  const pNoDate = { id: 'p5', author: 'E' };

  it('gom nhóm theo năm đúng (theo taken_on, thiếu thì created_at)', () => {
    const groups = groupByYear([p1, p2, p3, p4]);
    expect(groups[2026]).toHaveLength(2);
    expect(groups[2025]).toHaveLength(2);
    expect(groups[2026].map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(groups[2025].map((p) => p.id)).toEqual(['p3', 'p4']);
  });

  it('truy cập được cả bằng số và bằng chuỗi: groups[2026] và groups["2026"]', () => {
    const groups = groupByYear([p1, p3]);
    expect(groups[2026]).toEqual([p1]);
    expect(groups['2026']).toEqual([p1]);
    expect(groups[2025]).toEqual([p3]);
    expect(groups['2025']).toEqual([p3]);
  });

  it('ảnh không có ngày hợp lệ bị bỏ qua khỏi các nhóm năm', () => {
    const groups = groupByYear([p1, pNoDate]);
    expect(groups[2026]).toEqual([p1]);
    expect(Object.keys(groups)).toEqual(['2026']);
  });

  it('mảng rỗng hoặc null/undefined trả về đối tượng rỗng, không crash', () => {
    expect(groupByYear([])).toEqual({});
    expect(groupByYear(null)).toEqual({});
    expect(groupByYear(undefined)).toEqual({});
  });

  it('không làm thay đổi mảng đầu vào', () => {
    const orig = [p1, p2, p3];
    const snapshot = JSON.parse(JSON.stringify(orig));
    groupByYear(orig);
    expect(orig).toEqual(snapshot);
  });
});

describe('getDistinctYears', () => {
  it('danh sách năm giảm dần: 2026 rồi 2025', () => {
    const photos = [
      { taken_on: '2024-01-01' },
      { taken_on: '2026-10-12' },
      { taken_on: '2025-10-20' },
    ];
    expect(getDistinctYears(photos)).toEqual([2026, 2025, 2024]);
  });

  it('chấp nhận cả đối tượng Record kết quả từ groupByYear', () => {
    const groups = { 2025: [{ id: 'a' }], 2026: [{ id: 'b' }] };
    expect(getDistinctYears(groups)).toEqual([2026, 2025]);
  });

  it('chỉ 1 năm trả về mảng 1 phần tử', () => {
    expect(getDistinctYears([{ taken_on: '2026-05-01' }])).toEqual([2026]);
  });

  it('không có năm nào trả về mảng rỗng', () => {
    expect(getDistinctYears([])).toEqual([]);
    expect(getDistinctYears(null)).toEqual([]);
  });
});

describe('firstSentSummary: gợi ý hoa nở sớm/muộn khi ≥ 2 năm', () => {
  it('chuẩn theo spec: "Năm 2026 ảnh đầu tiên gửi ngày 12/10, năm 2025 ngày 20/10"', () => {
    const photos = [
      { id: '1', taken_on: '2026-10-25' },
      { id: '2', taken_on: '2026-10-12' }, // sớm nhất 2026: 12/10
      { id: '3', taken_on: '2025-10-20' }, // sớm nhất 2025: 20/10
      { id: '4', taken_on: '2025-11-05' },
    ];
    const summary = firstSentSummary(photos);
    expect(summary).toBe('Năm 2026 ảnh đầu tiên gửi ngày 12/10, năm 2025 ngày 20/10');
  });

  it('tìm ngày sớm nhất qua created_at khi không có taken_on', () => {
    const photos = [
      { id: '1', created_at: '2026-10-12T05:00:00Z' },
      { id: '2', created_at: '2025-10-20T05:00:00Z' },
    ];
    expect(firstSentSummary(photos)).toBe('Năm 2026 ảnh đầu tiên gửi ngày 12/10, năm 2025 ngày 20/10');
  });

  it('hỗ trợ ≥ 3 năm nối bằng dấu phẩy', () => {
    const photos = [
      { taken_on: '2026-10-12' },
      { taken_on: '2025-10-20' },
      { taken_on: '2024-11-05' },
    ];
    expect(firstSentSummary(photos)).toBe(
      'Năm 2026 ảnh đầu tiên gửi ngày 12/10, năm 2025 ngày 20/10, năm 2024 ngày 5/11',
    );
  });

  it('chỉ có 1 năm → trả về chuỗi rỗng (không hiện theo spec)', () => {
    const oneYear = [
      { taken_on: '2026-10-12' },
      { taken_on: '2026-10-25' },
    ];
    expect(firstSentSummary(oneYear)).toBe('');
  });

  it('không có ảnh hoặc mảng rỗng → trả về chuỗi rỗng', () => {
    expect(firstSentSummary([])).toBe('');
    expect(firstSentSummary(null)).toBe('');
  });
});

describe('getEarliestPhotoInYear', () => {
  it('chọn đúng ảnh có ngày sớm nhất trong năm', () => {
    const photos = [
      { id: 'muon', taken_on: '2026-12-01' },
      { id: 'som', taken_on: '2026-03-15' },
      { id: 'giua', taken_on: '2026-07-20' },
    ];
    const earliest = getEarliestPhotoInYear(photos);
    expect(earliest).toBeDefined();
    expect(earliest?.photo.id).toBe('som');
    expect(earliest?.year).toBe(2026);
    expect(earliest?.month).toBe(3);
    expect(earliest?.day).toBe(15);
    expect(earliest?.dateText).toBe('15/3');
  });
});
