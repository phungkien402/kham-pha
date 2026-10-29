// src/explore/hieu-viet-nam/step-hvn.test.ts
// Bộ kiểm thử tự động cho game /hieu-viet-nam:
// 1. Kiểm tra tính hợp lệ của cau-hoi.json (40 câu, 8/vùng, 4 lựa chọn, dapAn hợp lệ, nguon https, tinh thuộc 34 tỉnh)
// 2. Thuật toán bốc 12 câu cân đối 5 vùng
// 3. Logic chấm điểm câu hỏi
// 4. Chọn danh hiệu vui không phán xét, không hiện %
// 5. Tính toán tóm tắt chuyến khám phá (3 điều mới học)

import { describe, it, expect } from 'vitest';
import questionsData from './data/cau-hoi.json';
import {
  REGIONS,
  PROVINCE_34_SLUGS,
  isValid34Province,
  to34Province,
  validateQuestions,
  pickRoundQuestions,
  scoreQuestion,
  determineFunTitle,
  computeGameSummary,
  PROVINCES_34,
  MAP_VIEWBOX,
  type Question,
  type QuestionResult,
} from './game';

const questions = questionsData as Question[];

describe('Kiểm tra dữ liệu câu hỏi (cau-hoi.json)', () => {
  it('đúng 40 câu hỏi', () => {
    expect(questions).toHaveLength(40);
  });

  it('đúng 5 vùng, mỗi vùng đúng 8 câu', () => {
    const regionCounts: Record<string, number> = {};
    for (const q of questions) {
      regionCounts[q.vung] = (regionCounts[q.vung] || 0) + 1;
    }

    expect(Object.keys(regionCounts).sort()).toEqual(
      ['Biển đảo', 'Bắc', 'Nam', 'Trung', 'Tây Nguyên'].sort()
    );

    for (const vung of REGIONS) {
      expect(regionCounts[vung]).toBe(8);
    }
  });

  it('mỗi câu có đúng 4 lựa chọn', () => {
    for (const q of questions) {
      expect(q.luaChon).toBeInstanceOf(Array);
      expect(q.luaChon).toHaveLength(4);
      for (const opt of q.luaChon) {
        expect(typeof opt).toBe('string');
        expect(opt.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('dapAn là chỉ số hợp lệ từ 0 đến 3', () => {
    for (const q of questions) {
      expect(Number.isInteger(q.dapAn)).toBe(true);
      expect(q.dapAn).toBeGreaterThanOrEqual(0);
      expect(q.dapAn).toBeLessThanOrEqual(3);
    }
  });

  it('nguon là URL hợp lệ bắt đầu bằng https://', () => {
    for (const q of questions) {
      expect(q.nguon).toMatch(/^https:\/\/.+/);
    }
  });

  it('tinh của mỗi câu thuộc 34 tỉnh của bản đồ (trực tiếp hoặc qua ánh xạ)', () => {
    for (const q of questions) {
      expect(isValid34Province(q.tinh)).toBe(true);
      const mapped = to34Province(q.tinh);
      expect(PROVINCE_34_SLUGS).toContain(mapped);
    }
  });

  it('hàm validateQuestions xác nhận dữ liệu hoàn toàn hợp lệ', () => {
    const res = validateQuestions(questions);
    expect(res.valid).toBe(true);
    expect(res.errors).toHaveLength(0);
  });
});

describe('Bốc câu hỏi ngẫu nhiên cân đối vùng (pickRoundQuestions)', () => {
  it('mỗi lượt bốc đúng 12 câu', () => {
    const picked = pickRoundQuestions(questions, 12);
    expect(picked).toHaveLength(12);
  });

  it('không có câu hỏi bị trùng lặp trong cùng 1 lượt', () => {
    const picked = pickRoundQuestions(questions, 12);
    const ids = picked.map((q) => q.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(12);
  });

  it('cân đối 5 vùng: mỗi vùng có tối thiểu 2 câu, tối đa 3 câu (2+2+2+3+3 = 12)', () => {
    for (let run = 0; run < 10; run++) {
      const picked = pickRoundQuestions(questions, 12);
      const counts: Record<string, number> = {};
      for (const q of picked) {
        counts[q.vung] = (counts[q.vung] || 0) + 1;
      }

      // Đủ cả 5 vùng
      expect(Object.keys(counts)).toHaveLength(5);

      let countOfThree = 0;
      let countOfTwo = 0;
      for (const r of REGIONS) {
        const c = counts[r];
        expect(c).toBeGreaterThanOrEqual(2);
        expect(c).toBeLessThanOrEqual(3);
        if (c === 3) countOfThree++;
        if (c === 2) countOfTwo++;
      }
      expect(countOfThree).toBe(2);
      expect(countOfTwo).toBe(3);
    }
  });

  it('hỗ trợ seed giả lập tạo kết quả tái lập', () => {
    let seed = 42;
    const fakeRng = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    const run1 = pickRoundQuestions(questions, 12, fakeRng);
    seed = 42;
    const run2 = pickRoundQuestions(questions, 12, fakeRng);

    expect(run1.map((q) => q.id)).toEqual(run2.map((q) => q.id));
  });
});

describe('Chấm điểm câu hỏi (scoreQuestion)', () => {
  it('xác định chính xác khi trả lời đúng', () => {
    const q = questions[0];
    const res = scoreQuestion(q, q.dapAn);
    expect(res.isCorrect).toBe(true);
    expect(res.selectedIndex).toBe(q.dapAn);
    expect(res.provinceSlug).toBe(to34Province(q.tinh));
  });

  it('xác định chính xác khi trả lời sai', () => {
    const q = questions[0];
    const wrongIndex = (q.dapAn + 1) % 4;
    const res = scoreQuestion(q, wrongIndex);
    expect(res.isCorrect).toBe(false);
    expect(res.selectedIndex).toBe(wrongIndex);
  });
});

describe('Chọn danh hiệu vui không phán xét (determineFunTitle)', () => {
  it('trả về danh hiệu có đủ id, name, badge và description khích lệ', () => {
    const sampleResults: QuestionResult[] = questions.slice(0, 12).map((q, idx) => ({
      question: q,
      selectedIndex: idx % 2 === 0 ? q.dapAn : (q.dapAn + 1) % 4,
      isCorrect: idx % 2 === 0,
      provinceSlug: to34Province(q.tinh),
    }));

    const title = determineFunTitle(sampleResults);
    expect(title.name.length).toBeGreaterThan(0);
    expect(title.badge.length).toBeGreaterThan(0);
    expect(title.description.length).toBeGreaterThan(0);

    // Không bao giờ hiện % trong danh hiệu hay mô tả
    expect(title.name).not.toContain('%');
    expect(title.description).not.toContain('%');
  });

  it('danh hiệu tôn vinh thế mạnh ẩm thực khi làm tốt các câu món ăn', () => {
    const foodQuestions = questions.filter((q) => q.chuDe === 'món ăn vùng miền');
    const results: QuestionResult[] = foodQuestions.slice(0, 4).map((q) => ({
      question: q,
      selectedIndex: q.dapAn,
      isCorrect: true,
      provinceSlug: to34Province(q.tinh),
    }));

    const title = determineFunTitle(results);
    expect(title.id).toBe('su-gia-am-thuc');
    expect(title.name).toContain('ẩm thực');
  });
});

describe('Tổng hợp kết quả màn chơi (computeGameSummary)', () => {
  it('chọn đúng 3 điều mới học ưu tiên câu trả lời sai', () => {
    const roundQuestions = questions.slice(0, 12);
    // Giả lập 2 câu sai, 10 câu đúng
    const results: QuestionResult[] = roundQuestions.map((q, idx) => ({
      question: q,
      selectedIndex: idx < 2 ? (q.dapAn + 1) % 4 : q.dapAn,
      isCorrect: idx >= 2,
      provinceSlug: to34Province(q.tinh),
    }));

    const summary = computeGameSummary(results);

    expect(summary.total).toBe(12);
    expect(summary.correctCount).toBe(10);
    expect(summary.learnedFacts).toHaveLength(3);

    // 2 câu sai đầu tiên được ưu tiên lên đầu trong điều mới học
    expect(summary.learnedFacts[0].questionId).toBe(roundQuestions[0].id);
    expect(summary.learnedFacts[0].wasCorrect).toBe(false);
    expect(summary.learnedFacts[1].questionId).toBe(roundQuestions[1].id);
    expect(summary.learnedFacts[1].wasCorrect).toBe(false);
    expect(summary.learnedFacts[2].wasCorrect).toBe(true);
  });

  it('tuyệt đối không hiển thị tỷ lệ % trong kết quả', () => {
    const roundQuestions = questions.slice(0, 12);
    const results: QuestionResult[] = roundQuestions.map((q) => ({
      question: q,
      selectedIndex: q.dapAn,
      isCorrect: true,
      provinceSlug: to34Province(q.tinh),
    }));

    const summary = computeGameSummary(results);
    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain('%');
  });

  it('thống kê đủ các vùng đất và tỉnh thành đã ghé qua', () => {
    const roundQuestions = pickRoundQuestions(questions, 12);
    const results: QuestionResult[] = roundQuestions.map((q, i) => ({
      question: q,
      selectedIndex: i % 2 === 0 ? q.dapAn : (q.dapAn + 1) % 4,
      isCorrect: i % 2 === 0,
      provinceSlug: to34Province(q.tinh),
    }));

    const summary = computeGameSummary(results);
    expect(summary.regionsExplored.length).toBe(5);
    expect(summary.provincesExplored.length).toBeGreaterThanOrEqual(6);
  });
});

describe('Dữ liệu bản đồ 34 tỉnh (PROVINCES_34)', () => {
  it('có đủ 34 tỉnh thành với SVG path d hợp lệ', () => {
    expect(Object.keys(PROVINCES_34)).toHaveLength(34);
    for (const slug of PROVINCE_34_SLUGS) {
      const p = PROVINCES_34[slug];
      expect(p).toBeDefined();
      expect(p.d).toMatch(/^M/);
      expect(p.name.length).toBeGreaterThan(0);
    }
  });

  it('MAP_VIEWBOX có toạ độ bao quát toàn quốc gồm Hoàng Sa và Trường Sa', () => {
    expect(MAP_VIEWBOX.width).toBe(1740);
    expect(MAP_VIEWBOX.height).toBe(1840);
  });
});
