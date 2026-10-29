// src/explore/to-co-nao/step-d.test.ts
// Test toàn diện cho bước D: Màn mở đầu (D1), Hành trình (D2), Fun fact (D3), Bạn có biết? (D4)

import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { EntityMeta } from './types';
import { meta, metaMap } from './dataLoader';
import {
  TOUR_STEPS,
  formatTourRatio,
  getTourComparison,
  parseHanhTrinhUrl,
} from './tourData';
import {
  animateViewport,
  easeInOutCubic,
} from './viewportAnimation';
import {
  funFact,
  surprisingPairs,
} from './funFacts';

const dir = path.resolve(__dirname);
const read = (f: string) => fs.readFileSync(path.join(dir, f), 'utf8');

describe('D3: Hàm thuần funFact(e, all)', () => {
  it('cho tỉnh: xếp hạng k/34, tỉ lệ % diện tích VN, chiều dài km và định dạng số Việt', () => {
    const lamDong = metaMap.get('lam-dong')!;
    expect(lamDong).toBeDefined();

    const fact = funFact(lamDong, meta);
    // Lâm Đồng là tỉnh lớn nhất (hạng 1)
    expect(fact).toContain('Lớn thứ 1/34 tỉnh');
    expect(fact).toContain('diện tích Việt Nam');
    expect(fact).toContain('dài khoảng');
    expect(fact).toContain('km');
    // % diện tích Lâm Đồng ~ 24334 / 330533 ≈ 7,4%
    expect(fact).toMatch(/7,4%\s+diện tích/);
  });

  it('cho toàn bộ Việt Nam: xếp hạng trong các nước (bỏ Nam Cực và tỉnh)', () => {
    const vn = metaMap.get('viet-nam')!;
    expect(vn).toBeDefined();

    const fact = funFact(vn, meta);
    expect(fact).toContain('nếu xếp cùng các nước');
    expect(fact).toContain('dài khoảng');
    // Số nước không tính ata và vn:
    const numCountries = meta.filter((m) => m.type === 'nuoc' && m.id !== 'ata').length;
    expect(fact).toContain(`/${numCountries}`);
  });

  it('cho quốc gia lớn hơn Việt Nam: bằng n lần Việt Nam', () => {
    const rus = metaMap.get('rus')!;
    expect(rus).toBeDefined();
    const factRus = funFact(rus, meta);
    expect(factRus).toContain('Lớn thứ 1 thế giới');
    expect(factRus).toContain('bằng 51 lần Việt Nam');

    const fra = metaMap.get('fra')!;
    expect(fra).toBeDefined();
    const factFra = funFact(fra, meta);
    expect(factFra).toContain('bằng 1,9 lần Việt Nam');
  });

  it('cho quốc gia nhỏ hơn Việt Nam: VN bằng n lần nước này và thêm cỡ tỉnh VN gần nhất', () => {
    const bel = metaMap.get('bel')!;
    expect(bel).toBeDefined();
    const factBel = funFact(bel, meta);
    expect(factBel).toContain('Việt Nam bằng 11 lần nước này');
    expect(factBel).toContain('cỡ Lâm Đồng');

    const sgp = metaMap.get('sgp')!;
    expect(sgp).toBeDefined();
    const factSgp = funFact(sgp, meta);
    expect(factSgp).toContain('Việt Nam bằng 450 lần nước này');
    expect(factSgp).toContain('cỡ');
  });

  it('loại trừ ata (Nam Cực) khỏi bảng xếp hạng quốc gia', () => {
    const ata = metaMap.get('ata');
    if (ata) {
      // Nam Cực không được tính vào danh sách xếp hạng nước
      const countries = meta.filter((m) => m.type === 'nuoc' && m.id !== 'ata');
      for (const c of countries) {
        const fact = funFact(c, meta);
        // Không quốc gia nào bị đẩy tụt hạng vì Nam Cực
        expect(fact).not.toContain('thế giới · bằng NaN');
      }
    }
  });
});

describe('D4: Hàm thuần surprisingPairs(all)', () => {
  const pairs = surprisingPairs(meta);

  it('tìm được danh sách cặp bất ngờ hợp lệ', () => {
    expect(pairs.length).toBeGreaterThan(0);
  });

  it('mọi cặp đều có độ lệch tỉ lệ |ratio - 1| <= 0,06', () => {
    for (const p of pairs) {
      const diff = Math.abs(p.ratio - 1);
      expect(diff).toBeLessThanOrEqual(0.06001);
    }
  });

  it('mỗi tỉnh xuất hiện tối đa một lần', () => {
    const provinceIds = pairs.map((p) => p.a);
    const uniqueIds = new Set(provinceIds);
    expect(provinceIds.length).toBe(uniqueIds.size);
  });

  it('không chứa nước < 50 km² và không chứa ata', () => {
    for (const p of pairs) {
      expect(p.b).not.toBe('ata');
      const country = metaMap.get(p.b)!;
      expect(country).toBeDefined();
      expect(country.area).toBeGreaterThanOrEqual(50);
    }
  });

  it('được sắp xếp theo độ lệch tăng dần (cặp sát nhất lên đầu)', () => {
    for (let i = 1; i < pairs.length; i++) {
      const diffPrev = Math.abs(pairs[i - 1].ratio - 1);
      const diffCur = Math.abs(pairs[i].ratio - 1);
      expect(diffCur).toBeGreaterThanOrEqual(diffPrev - 1e-9);
    }
  });
});

describe('D2: tourData (10 chặng hành trình)', () => {
  it('có đúng 10 chặng theo đặc tả', () => {
    expect(TOUR_STEPS).toHaveLength(10);
    TOUR_STEPS.forEach((step, idx) => {
      expect(step.step).toBe(idx + 1);
      expect(step.cau).toBeTruthy();
    });
  });

  it('mọi ID trong 10 chặng đều tồn tại trong meta.json', () => {
    for (const s of TOUR_STEPS) {
      expect(metaMap.has(s.smallId), `Chặng ${s.step}: thiếu ${s.smallId}`).toBe(true);
      expect(metaMap.has(s.largeId), `Chặng ${s.step}: thiếu ${s.largeId}`).toBe(true);
    }
  });

  it('tỉ lệ tính đúng trên từng chặng', () => {
    // Chặng 1: Singapore vs TP.HCM (~6.734 / 735 ≈ 9.16 -> "GẤP 9 LẦN")
    const step1 = getTourComparison(TOUR_STEPS[0], metaMap)!;
    expect(step1).not.toBeNull();
    expect(step1.headline).toBe('GẤP 9 LẦN');
    expect(step1.sub).toContain('6.734 km²');
    expect(step1.sub).toContain('735 km²');

    // Chặng 2: Luxembourg vs Hà Nội (~3.366 / 2.586 ≈ 1.30 -> "GẤP 1,3 LẦN")
    const step2 = getTourComparison(TOUR_STEPS[1], metaMap)!;
    expect(step2.headline).toBe('GẤP 1,3 LẦN');

    // Chặng 5: Hàn Quốc vs Việt Nam (~330.533 / 97.154 ≈ 3.40 -> "GẤP 3,4 LẦN")
    const step5 = getTourComparison(TOUR_STEPS[4], metaMap)!;
    expect(step5.headline).toBe('GẤP 3,4 LẦN');

    // Chặng 6: Phần Lan vs Việt Nam -> "GẦN NHƯ BẰNG NHAU"
    const step6 = getTourComparison(TOUR_STEPS[5], metaMap)!;
    expect(step6.headline).toBe('GẦN NHƯ BẰNG NHAU');
    expect(step6.isNearlyEqual).toBe(true);

    // Chặng 8: Pháp vs Việt Nam (~635.047 / 330.533 ≈ 1.92 -> "GẤP 1,9 LẦN")
    const step8 = getTourComparison(TOUR_STEPS[7], metaMap)!;
    expect(step8.headline).toBe('GẤP 1,9 LẦN');

    // Chặng 9: Trung Quốc vs Việt Nam (~9.37M / 330.533 ≈ 28.35 -> "GẤP 28 LẦN")
    const step9 = getTourComparison(TOUR_STEPS[8], metaMap)!;
    expect(step9.headline).toBe('GẤP 28 LẦN');

    // Chặng 10: Nga vs Việt Nam (~16.88M / 330.533 ≈ 51.07 -> "GẤP 51 LẦN")
    const step10 = getTourComparison(TOUR_STEPS[9], metaMap)!;
    expect(step10.headline).toBe('GẤP 51 LẦN');
  });

  it('formatTourRatio định dạng chuẩn quy ước', () => {
    expect(formatTourRatio(1.02)).toBe('GẦN NHƯ BẰNG NHAU');
    expect(formatTourRatio(0.98)).toBe('GẦN NHƯ BẰNG NHAU');
    expect(formatTourRatio(1.302)).toBe('GẤP 1,3 LẦN');
    expect(formatTourRatio(3.402)).toBe('GẤP 3,4 LẦN');
    expect(formatTourRatio(9.16)).toBe('GẤP 9 LẦN');
    expect(formatTourRatio(28.35)).toBe('GẤP 28 LẦN');
    expect(formatTourRatio(51.07)).toBe('GẤP 51 LẦN');
  });
});

describe('D2: Hàm phân tích tham số URL parseHanhTrinhUrl', () => {
  it('đọc đúng số chặng từ 1 đến 10', () => {
    expect(parseHanhTrinhUrl('?hanh-trinh=1')).toBe(1);
    expect(parseHanhTrinhUrl('?hanh-trinh=6')).toBe(6);
    expect(parseHanhTrinhUrl('?hanh-trinh=10')).toBe(10);
    expect(parseHanhTrinhUrl('https://example.com/to-co-nao?hanh-trinh=3')).toBe(3);
    expect(parseHanhTrinhUrl('?hanh_trinh=7')).toBe(7);
  });

  it('tham số sai hoặc ngoài phạm vi (1..10) thì trả về 1', () => {
    expect(parseHanhTrinhUrl('?hanh-trinh=0')).toBe(1);
    expect(parseHanhTrinhUrl('?hanh-trinh=11')).toBe(1);
    expect(parseHanhTrinhUrl('?hanh-trinh=99')).toBe(1);
    expect(parseHanhTrinhUrl('?hanh-trinh=abc')).toBe(1);
    expect(parseHanhTrinhUrl('?hanh-trinh=')).toBe(1);
  });

  it('không có tham số hanh-trinh thì trả về null', () => {
    expect(parseHanhTrinhUrl('')).toBeNull();
    expect(parseHanhTrinhUrl('?h=bel:0:0:0')).toBeNull();
    expect(parseHanhTrinhUrl('https://example.com/to-co-nao')).toBeNull();
  });
});

describe('D2: Tween viewport (viewportAnimation.ts)', () => {
  it('easeInOutCubic có biên chuẩn xác f(0)=0, f(0.5)=0.5, f(1)=1', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(0.5)).toBe(0.5);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.2)).toBeLessThan(easeInOutCubic(0.8));
  });

  it('khi reducedMotion bật: nhảy thẳng tới đích ngay lập tức', () => {
    const from = { cx: 0, cy: 0, scale: 1 };
    const to = { cx: 100, cy: 200, scale: 2.5 };
    let updatedVp = { ...from };
    let completed = false;

    animateViewport(from, to, {
      duration: 600,
      reducedMotion: true,
      onUpdate: (vp) => {
        updatedVp = vp;
      },
      onComplete: () => {
        completed = true;
      },
    });

    expect(updatedVp).toEqual(to);
    expect(completed).toBe(true);
  });

  it('khi duration <= 0: nhảy thẳng tới đích ngay lập tức', () => {
    const from = { cx: 0, cy: 0, scale: 1 };
    const to = { cx: 50, cy: -50, scale: 0.5 };
    let updatedVp = { ...from };
    let completed = false;

    animateViewport(from, to, {
      duration: 0,
      reducedMotion: false,
      onUpdate: (vp) => {
        updatedVp = vp;
      },
      onComplete: () => {
        completed = true;
      },
    });

    expect(updatedVp).toEqual(to);
    expect(completed).toBe(true);
  });
});

describe('UI & A11y của các component D1–D4', () => {
  it('IntroModal.svelte có đủ dialog, aria, tiêu đề và 2 nút lựa chọn', () => {
    const code = read('IntroModal.svelte');
    expect(code).toContain('role="dialog"');
    expect(code).toContain('aria-modal="true"');
    expect(code).toContain('aria-labelledby');
    expect(code).toContain('Việt Nam thật ra to cỡ nào?');
    expect(code).toContain('Bắt đầu hành trình →');
    expect(code).toContain('Tự khám phá');
    expect(code).toContain('tcn-intro-seen');
    expect(code).toContain('Escape');
    expect(code).toContain('backdrop-filter');
    expect(code).toContain('blur(3px)');
  });

  it('TourCard.svelte có tiến độ, nhịp 3 tầng, thoát, vuốt mobile, chặng 10 Tự so sánh', () => {
    const code = read('TourCard.svelte');
    expect(code).toContain('progress-track');
    expect(code).toContain('Thoát');
    expect(code).toContain('tier-headline');
    expect(code).toContain('tier-sub');
    expect(code).toContain('tier-cau');
    expect(code).toContain('Tự so sánh');
    expect(code).toContain('ontouchstart');
    expect(code).toContain('ontouchend'); // Quy chuẩn mobile 375px
  });

  it('Board.svelte hỗ trợ mốc mờ ghostShape và khoá tương tác khi tween', () => {
    const code = read('Board.svelte');
    expect(code).toContain('ghostShape');
    expect(code).toContain('ghost-shape-marker');
    expect(code).toContain('opacity="0.25"');
    expect(code).toContain('pointer-events: none');
    expect(code).toContain('isLocked');
  });

  it('Footer.svelte tích hợp Bạn có biết?, nút Hành trình và Popover Fun fact', () => {
    const code = read('Footer.svelte');
    expect(code).toContain('did-you-know-bar');
    expect(code).toContain('Bạn có biết?');
    expect(code).toContain('Hành trình');
    expect(code).toContain('tour-btn');
    expect(code).toContain('chip-info-btn');
    expect(code).toContain('chip-popover');
    expect(code).toContain('funFact');
    expect(code).toContain('surprisingPairs');
  });

  it('ToCoNao.svelte kết nối toàn bộ flow D1–D4 mượt mà', () => {
    const code = read('ToCoNao.svelte');
    expect(code).toContain('IntroModal');
    expect(code).toContain('TourCard');
    expect(code).toContain('parseHanhTrinhUrl');
    expect(code).toContain('setupTourStep');
    expect(code).toContain('animateViewport');
    expect(code).toContain('surprisingPairs');
    expect(code).toContain('funFact');
    expect(code).toContain('funfact-toast-banner');
    expect(code).toContain('tcn-intro-seen');
    expect(code).toContain('?hanh-trinh=');
  });
});
