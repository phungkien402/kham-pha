// Test bước 29 ("Nhắc mùa hoa" .ics) theo spec docs/buoc-28-32-mua-hoa.md mục 29.
import { describe, expect, it } from 'vitest';
import { buildIcs, escapeIcsText, foldIcsLine, formatIcsDate, unfoldIcs } from './ics';

// 12:00 trưa giờ VN
const vn = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 5));
const dayNum = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d) / 86_400_000;

const xuan = {
  slug: 'hoa-xuan',
  name: 'Hoa Xuân',
  regionLabel: 'Miền Bắc',
  seasons: [{ start: { month: 3, day: 1 }, peak: { month: 3, day: 20 }, end: { month: 4, day: 30 } }],
};

// Lấy giá trị DTSTART của sự kiện theo UID (sau khi unfold).
function dtstart(ics: string, uid: string): string | undefined {
  const text = unfoldIcs(ics);
  const ev = text.split('BEGIN:VEVENT').find((b) => b.includes(`UID:${uid}`));
  return ev && /DTSTART;VALUE=DATE:(\d{8})/.exec(ev)?.[1];
}

describe('buildIcs: cấu trúc RFC 5545', () => {
  const ics = buildIcs(xuan, vn(2026, 2, 10));

  it('bắt đầu/kết thúc VCALENDAR, dùng CRLF, kết thúc bằng CRLF', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    expect(ics).toContain('VERSION:2.0');
  });

  it('mỗi đợt nở có 2 sự kiện, mỗi sự kiện có RRULE yearly và VALARM -P1D', () => {
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics.match(/END:VEVENT/g)).toHaveLength(2);
    expect(ics.match(/RRULE:FREQ=YEARLY/g)).toHaveLength(2);
    expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(2);
    expect(ics.match(/TRIGGER:-P1D/g)).toHaveLength(2);
    expect(ics.match(/DTSTAMP:/g)).toHaveLength(2);
  });

  it('UID ổn định theo dạng <slug>-<đợt>-<loại>@kham-pha', () => {
    expect(ics).toContain('UID:hoa-xuan-1-sap-no@kham-pha');
    expect(ics).toContain('UID:hoa-xuan-1-dinh-mua@kham-pha');
  });

  it('tiêu đề đúng và mô tả có link trang loài', () => {
    const text = unfoldIcs(ics);
    expect(text).toContain('SUMMARY:Sắp tới mùa Hoa Xuân');
    expect(text).toContain('SUMMARY:Hoa Xuân vào đỉnh mùa');
    expect(text).toMatch(/DESCRIPTION:[^\r\n]*\/mua-hoa-viet\/hoa-xuan\//);
  });

  it('không dòng nào quá 75 octet UTF-8', () => {
    const enc = new TextEncoder();
    for (const line of ics.split('\r\n')) expect(enc.encode(line).length).toBeLessThanOrEqual(75);
  });

  it('thuần: cùng đầu vào cho cùng kết quả', () => {
    expect(buildIcs(xuan, vn(2026, 2, 10))).toBe(ics);
  });
});

describe('buildIcs: chọn năm', () => {
  it('đợt năm nay chưa tới: nhắc trước 7 ngày bắt đầu, đỉnh đúng ngày', () => {
    const ics = buildIcs(xuan, vn(2026, 2, 10));
    expect(dtstart(ics, 'hoa-xuan-1-sap-no@kham-pha')).toBe('20260222');
    expect(dtstart(ics, 'hoa-xuan-1-dinh-mua@kham-pha')).toBe('20260320');
  });

  it('đang trong đợt: vẫn dùng đợt năm nay', () => {
    const ics = buildIcs(xuan, vn(2026, 4, 30));
    expect(dtstart(ics, 'hoa-xuan-1-dinh-mua@kham-pha')).toBe('20260320');
  });

  it('đợt năm nay đã hết: chuyển sang năm sau', () => {
    const ics = buildIcs(xuan, vn(2026, 5, 1));
    expect(dtstart(ics, 'hoa-xuan-1-sap-no@kham-pha')).toBe('20270222');
    expect(dtstart(ics, 'hoa-xuan-1-dinh-mua@kham-pha')).toBe('20270320');
  });

  it('nhiều đợt: UID đánh số 1, 2 và mỗi đợt có 2 sự kiện', () => {
    const f = {
      slug: 'hoa-hai-dot',
      name: 'Hai Đợt',
      seasons: [
        { start: { month: 3, day: 1 }, end: { month: 3, day: 31 } },
        { start: { month: 10, day: 1 }, end: { month: 10, day: 31 } },
      ],
    };
    const ics = buildIcs(f, vn(2026, 1, 1));
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(4);
    expect(ics).toContain('UID:hoa-hai-dot-2-sap-no@kham-pha');
    expect(ics).toContain('UID:hoa-hai-dot-2-dinh-mua@kham-pha');
  });
});

describe('buildIcs: mùa vắt qua năm (T12 → T1)', () => {
  const tet = {
    slug: 'hoa-tet',
    name: 'Hoa Tết',
    seasons: [{ start: { month: 12, day: 1 }, peak: { month: 1, day: 10 }, end: { month: 1, day: 31 } }],
  };

  it('đang giữa đợt (T12): đỉnh rơi sang tháng 1 năm sau', () => {
    const ics = buildIcs(tet, vn(2026, 12, 20));
    expect(dtstart(ics, 'hoa-tet-1-dinh-mua@kham-pha')).toBe('20270110');
  });

  it('đã sang tháng 1 nhưng đợt chưa hết: vẫn là đợt bắt đầu năm trước', () => {
    const ics = buildIcs(tet, vn(2027, 1, 20));
    expect(dtstart(ics, 'hoa-tet-1-dinh-mua@kham-pha')).toBe('20270110');
  });

  it('sau khi đợt hết (T2): sang đợt kế tiếp, nhắc 7 ngày trước 1/12', () => {
    const ics = buildIcs(tet, vn(2027, 2, 5));
    expect(dtstart(ics, 'hoa-tet-1-sap-no@kham-pha')).toBe('20271124');
    expect(dtstart(ics, 'hoa-tet-1-dinh-mua@kham-pha')).toBe('20280110');
  });

  it('nhắc 7 ngày trước ngày 3/1 trượt ngược sang năm trước', () => {
    const f = { slug: 'x', name: 'X', seasons: [{ start: { month: 1, day: 3 }, end: { month: 2, day: 10 } }] };
    expect(dtstart(buildIcs(f, vn(2026, 12, 1)), 'x-1-sap-no@kham-pha')).toBe('20261227');
  });
});

describe('buildIcs: ngày 29/2', () => {
  it('nhắc trước 7 ngày rơi đúng 29/2 năm nhuận', () => {
    const f = { slug: 'x', name: 'X', seasons: [{ start: { month: 3, day: 7 }, end: { month: 4, day: 30 } }] };
    expect(dtstart(buildIcs(f, vn(2028, 2, 1)), 'x-1-sap-no@kham-pha')).toBe('20280229');
  });

  it('năm thường: 3/3 - 7 ngày = 24/2', () => {
    const f = { slug: 'x', name: 'X', seasons: [{ start: { month: 3, day: 3 }, end: { month: 4, day: 30 } }] };
    expect(dtstart(buildIcs(f, vn(2027, 2, 1)), 'x-1-sap-no@kham-pha')).toBe('20270224');
  });

  it('đợt kết thúc "cuối tháng 2" (không ghi ngày): 29/2/2028 vẫn còn trong đợt', () => {
    const f = { slug: 'x', name: 'X', seasons: [{ start: { month: 1, day: 5 }, peak: { month: 1, day: 15 }, end: { month: 2 } }] };
    expect(dtstart(buildIcs(f, vn(2028, 2, 29)), 'x-1-dinh-mua@kham-pha')).toBe('20280115');
    expect(dtstart(buildIcs(f, vn(2028, 3, 1)), 'x-1-dinh-mua@kham-pha')).toBe('20290115');
  });

  it('today là chuỗi 2028-02-29 hợp lệ; 2027-02-29 là rác -> chuỗi rỗng', () => {
    expect(buildIcs(xuan, '2028-02-29')).not.toBe('');
    expect(buildIcs(xuan, '2027-02-29')).toBe('');
  });
});

describe('buildIcs: dữ liệu rỗng / rác không ném lỗi', () => {
  it('không có mùa nở -> chuỗi rỗng', () => {
    expect(buildIcs({ slug: 'a', name: 'A', seasons: [] }, vn(2026, 1, 1))).toBe('');
    expect(buildIcs({ slug: 'a', name: 'A' }, vn(2026, 1, 1))).toBe('');
    expect(buildIcs({}, vn(2026, 1, 1))).toBe('');
  });

  it('flower null/undefined/không phải object', () => {
    expect(buildIcs(null as never, vn(2026, 1, 1))).toBe('');
    expect(buildIcs(undefined as never, vn(2026, 1, 1))).toBe('');
    expect(buildIcs('rác' as never, vn(2026, 1, 1))).toBe('');
  });

  it('tháng ngoài 1–12 hoặc thiếu tháng bị bỏ qua', () => {
    const bad = { slug: 'a', name: 'A', seasons: [{ start: { month: 13 }, end: { month: 4 } }] };
    expect(buildIcs(bad as never, vn(2026, 1, 1))).toBe('');
    const bad2 = { slug: 'a', name: 'A', seasons: [{ start: { month: 0 }, end: { month: 4 } }] };
    expect(buildIcs(bad2 as never, vn(2026, 1, 1))).toBe('');
    const bad3 = { slug: 'a', name: 'A', seasons: [{ start: { month: 'ba' }, end: null }] };
    expect(buildIcs(bad3 as never, vn(2026, 1, 1))).toBe('');
  });

  it('today là rác -> chuỗi rỗng', () => {
    expect(buildIcs(xuan, new Date('rác'))).toBe('');
    expect(buildIcs(xuan, 'không phải ngày')).toBe('');
    expect(buildIcs(xuan, '')).toBe('');
    expect(buildIcs(xuan, Number.NaN)).toBe('');
    expect(buildIcs(xuan, { year: 2026, month: 13, day: 1 })).toBe('');
  });

  it('thiếu tên: vẫn ra file hợp lệ (không "undefined")', () => {
    const ics = buildIcs({ slug: 'hoa-la', seasons: xuan.seasons }, vn(2026, 2, 10));
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).not.toContain('undefined');
  });

  it('thiếu slug: UID vẫn hợp lệ, không có khoảng trắng', () => {
    const ics = buildIcs({ name: 'Hoa', seasons: xuan.seasons }, vn(2026, 2, 10));
    const uids = [...ics.matchAll(/UID:([^\r\n]+)/g)].map((m) => m[1]);
    expect(uids).toHaveLength(2);
    for (const u of uids) expect(u).toMatch(/^[^\s]+@kham-pha$/);
  });

  it('thiếu đỉnh mùa: lấy giữa đợt, nằm trong đợt', () => {
    const f = { slug: 'x', name: 'X', seasons: [{ start: { month: 3, day: 1 }, end: { month: 3, day: 31 } }] };
    const p = dtstart(buildIcs(f, vn(2026, 1, 1)), 'x-1-dinh-mua@kham-pha')!;
    expect(p >= '20260301' && p <= '20260331').toBe(true);
  });
});

describe('escape dấu đặc biệt trong tên', () => {
  it('escapeIcsText: , ; \\ và xuống dòng', () => {
    expect(escapeIcsText('a,b;c\\d')).toBe('a\\,b\\;c\\\\d');
    expect(escapeIcsText('một\nhai')).toBe('một\\nhai');
    expect(escapeIcsText('một\r\nhai')).toBe('một\\nhai');
    expect(escapeIcsText('')).toBe('');
  });

  it('tên có dấu phẩy/chấm phẩy được escape trong SUMMARY', () => {
    const ics = buildIcs({ ...xuan, name: 'Hoa A, B; C' }, vn(2026, 2, 10));
    expect(unfoldIcs(ics)).toContain('SUMMARY:Sắp tới mùa Hoa A\\, B\\; C');
  });
});

describe('foldIcsLine / unfoldIcs', () => {
  it('dòng ngắn giữ nguyên', () => {
    expect(foldIcsLine('SUMMARY:ngắn')).toBe('SUMMARY:ngắn');
  });

  it('dòng dài tiếng Việt: mỗi đoạn ≤ 75 octet, unfold trả đúng bản gốc', () => {
    const line = 'DESCRIPTION:' + 'Hoa đào nở rộ ở Nhật Tân, Hà Nội — ắẳẵặ ' .repeat(12);
    const folded = foldIcsLine(line);
    const enc = new TextEncoder();
    const parts = folded.split('\r\n');
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(enc.encode(p).length).toBeLessThanOrEqual(75);
    for (const p of parts.slice(1)) expect(p.startsWith(' ')).toBe(true);
    expect(unfoldIcs(folded)).toBe(line);
    expect(folded).not.toContain('�');
  });

  it('đúng 75 octet không gập; 76 octet thì gập', () => {
    expect(foldIcsLine('a'.repeat(75))).toBe('a'.repeat(75));
    expect(foldIcsLine('a'.repeat(76))).toContain('\r\n ');
  });

  it('rỗng / giá trị rác không ném lỗi', () => {
    expect(foldIcsLine('')).toBe('');
    expect(foldIcsLine(undefined as never)).toBe('');
    expect(unfoldIcs('')).toBe('');
    expect(unfoldIcs(undefined as never)).toBe('');
  });
});

describe('formatIcsDate', () => {
  it('định dạng YYYYMMDD, có đệm 0', () => {
    expect(formatIcsDate(dayNum(2026, 1, 5))).toBe('20260105');
    expect(formatIcsDate(dayNum(2028, 2, 29))).toBe('20280229');
    expect(formatIcsDate(dayNum(2026, 12, 31) + 1)).toBe('20270101');
  });
});
