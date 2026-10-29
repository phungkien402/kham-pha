// src/explore/hieu-viet-nam/game.ts
// Các hàm thuần tính toán, logic chọn câu hỏi, chấm điểm, danh hiệu và xuất ảnh chia sẻ

import docVnData from '../to-co-nao/data/doc-vn.json';

export type Region = 'Bắc' | 'Trung' | 'Nam' | 'Tây Nguyên' | 'Biển đảo';

export interface Question {
  id: string;
  vung: Region;
  chuDe: string;
  tinh: string;
  cauHoi: string;
  luaChon: string[];
  dapAn: number;
  giaiThich: string;
  nguon: string;
  ngayTruyCap: string;
  goiY?: string;
}

export interface QuestionResult {
  question: Question;
  selectedIndex: number;
  isCorrect: boolean;
  provinceSlug: string; // mã tỉnh thuộc 34 tỉnh
  usedHint?: boolean;
}

export interface FunTitle {
  id: string;
  name: string;
  badge: string;
  description: string;
}

export interface LearnedFact {
  questionId: string;
  vung: Region;
  tinh: string;
  cauHoi: string;
  giaiThich: string;
  nguon: string;
  wasCorrect: boolean;
  usedHint?: boolean;
}

export interface GameSummary {
  total: number;
  correctCount: number;
  regionsExplored: Region[];
  provincesExplored: {
    slug: string;
    name: string;
    isCorrect: boolean;
    vung: Region;
  }[];
  learnedFacts: LearnedFact[];
  title: FunTitle;
}

export interface ProvinceMapItem {
  name: string;
  d: string;
  labelX: number;
  labelY: number;
}

export const REGIONS: readonly Region[] = [
  'Bắc',
  'Trung',
  'Nam',
  'Tây Nguyên',
  'Biển đảo',
] as const;

export const PROVINCE_34_SLUGS: readonly string[] = [
  'an-giang',
  'bac-ninh',
  'ca-mau',
  'can-tho',
  'cao-bang',
  'da-nang',
  'dak-lak',
  'dien-bien',
  'dong-nai',
  'dong-thap',
  'gia-lai',
  'ha-noi',
  'ha-tinh',
  'hai-phong',
  'hue',
  'hung-yen',
  'khanh-hoa',
  'lai-chau',
  'lam-dong',
  'lang-son',
  'lao-cai',
  'nghe-an',
  'ninh-binh',
  'phu-tho',
  'quang-ngai',
  'quang-ninh',
  'quang-tri',
  'son-la',
  'tay-ninh',
  'thai-nguyen',
  'thanh-hoa',
  'tp-ho-chi-minh',
  'tuyen-quang',
  'vinh-long',
] as const;

// Ánh xạ các địa phương cũ/tiểu vùng vào 34 tỉnh thành của bản đồ
export const PROVINCE_MAPPING: Record<string, string> = {
  'thua-thien-hue': 'hue',
  'quang-nam': 'da-nang',
  'quang-binh': 'quang-tri',
  'kon-tum': 'gia-lai',
  'ba-ria-vung-tau': 'dong-nai',
  'ben-tre': 'vinh-long',
  'kien-giang': 'an-giang',
};

// Dữ liệu hình học 34 tỉnh thành từ to-co-nao (doc-vn.json)
export const PROVINCES_34: Record<string, ProvinceMapItem> =
  (docVnData as any).provinces || {};

export const MAP_VIEWBOX = {
  x: -460,
  y: -800,
  width: 1740,
  height: 1840,
};

/**
 * Chuyển đổi mã tỉnh câu hỏi về 1 trong 34 tỉnh của bản đồ
 */
export function to34Province(tinh: string): string {
  return PROVINCE_MAPPING[tinh] || tinh;
}

/**
 * Kiểm tra mã tỉnh có hợp lệ và thuộc 34 tỉnh (trực tiếp hoặc qua ánh xạ)
 */
export function isValid34Province(tinh: string): boolean {
  const norm = to34Province(tinh);
  return PROVINCE_34_SLUGS.includes(norm);
}

/**
 * Lấy tên hiển thị tiếng Việt của tỉnh
 */
export function getProvinceName(slugOrTinh: string): string {
  const norm = to34Province(slugOrTinh);
  if (PROVINCES_34[norm]?.name) {
    return PROVINCES_34[norm].name;
  }
  // Dự phòng viết hoa chữ cái đầu
  return norm
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Kiểm tra tính hợp lệ của toàn bộ tập dữ liệu câu hỏi
 */
export function validateQuestions(questions: unknown[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!Array.isArray(questions)) {
    return { valid: false, errors: ['Dữ liệu không phải là mảng'] };
  }

  if (questions.length !== 99) {
    errors.push(`Số câu hỏi phải đúng 99 câu (hiện có: ${questions.length})`);
  }

  const vungCount: Record<string, number> = {};

  questions.forEach((q: any, i) => {
    const id = q?.id || `index-${i}`;
    if (!q?.id) errors.push(`Câu hỏi #${i} thiếu id`);
    if (!q?.vung || !REGIONS.includes(q.vung)) {
      errors.push(`Câu [${id}]: vùng "${q?.vung}" không hợp lệ`);
    } else {
      vungCount[q.vung] = (vungCount[q.vung] || 0) + 1;
    }

    if (!Array.isArray(q?.luaChon) || q.luaChon.length !== 4) {
      errors.push(`Câu [${id}]: phải có đúng 4 lựa chọn`);
    }

    if (
      typeof q?.dapAn !== 'number' ||
      q.dapAn < 0 ||
      q.dapAn > 3 ||
      !Number.isInteger(q.dapAn)
    ) {
      errors.push(`Câu [${id}]: dapAn phải là số nguyên từ 0 đến 3`);
    }

    if (typeof q?.nguon !== 'string' || !q.nguon.startsWith('https://')) {
      errors.push(`Câu [${id}]: nguồn phải bắt đầu bằng https://`);
    }

    if (!q?.tinh || !isValid34Province(q.tinh)) {
      errors.push(`Câu [${id}]: tỉnh "${q?.tinh}" không thuộc 34 tỉnh`);
    }

    if (typeof q?.goiY !== 'string' || q.goiY.trim().length === 0) {
      errors.push(`Câu [${id}]: thiếu gợi ý (goiY)`);
    }
  });

  for (const vung of REGIONS) {
    const expected = vung === 'Tây Nguyên' ? 19 : 20;
    if (vungCount[vung] !== expected) {
      errors.push(`Vùng "${vung}" phải có đúng ${expected} câu (hiện có: ${vungCount[vung] || 0})`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Thuật toán xáo trộn mảng (Fisher-Yates) hỗ trợ hàm sinh số ngẫu nhiên tuỳ biến
 */
export function shuffleArray<T>(array: T[], rng: () => number = Math.random): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export interface ShuffledOption {
  text: string;
  originalIndex: number;
}

/**
 * Xáo trộn 4 lựa chọn của câu hỏi bằng Fisher-Yates, giữ nguyên liên kết chỉ số gốc
 */
export function shuffleQuestionOptions(
  question: Question,
  rng: () => number = Math.random,
): ShuffledOption[] {
  const items: ShuffledOption[] = question.luaChon.map((text, originalIndex) => ({
    text,
    originalIndex,
  }));
  return shuffleArray(items, rng);
}

export const PLAYED_STORAGE_KEY = 'hvn_played_ids';

/**
 * Đọc danh sách ID câu hỏi đã chơi từ localStorage (bảo vệ bằng try/catch)
 */
export function getStoredPlayedIds(): string[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(PLAYED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Lưu danh sách ID câu hỏi đã chơi vào localStorage (bảo vệ bằng try/catch)
 */
export function savePlayedIds(ids: string[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(PLAYED_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Bỏ qua lỗi quota hoặc chế độ ẩn danh
  }
}

/**
 * Bốc ngẫu nhiên 12 câu cho mỗi lượt chơi, cân đối 5 vùng:
 * - Mỗi vùng có tối thiểu 2 câu (5 × 2 = 10 câu)
 * - 2 vùng ngẫu nhiên có thêm 1 câu (tổng 12 câu: phân bổ 3, 3, 2, 2, 2)
 * - Ưu tiên tránh lặp các câu trong excludeIds; hết câu mới thì bù từ câu đã chơi
 * - Các câu được xáo đều
 */
export function pickRoundQuestions(
  allQuestions: Question[],
  count = 12,
  rng: () => number = Math.random,
  excludeIds: string[] | Set<string> = [],
): Question[] {
  const excludeSet = excludeIds instanceof Set ? excludeIds : new Set(excludeIds);

  const byRegion: Record<Region, Question[]> = {
    Bắc: [],
    Trung: [],
    Nam: [],
    'Tây Nguyên': [],
    'Biển đảo': [],
  };

  for (const q of allQuestions) {
    if (byRegion[q.vung]) {
      byRegion[q.vung].push(q);
    }
  }

  // Chọn 2 vùng ngẫu nhiên nhận thêm 1 câu
  const shuffledRegions = shuffleArray([...REGIONS], rng);
  const extraCount = Math.max(0, count - REGIONS.length * 2);
  const extraRegions = new Set(shuffledRegions.slice(0, extraCount)); // 2 vùng

  const picked: Question[] = [];
  for (const r of REGIONS) {
    const quota = extraRegions.has(r) ? 3 : 2;
    const regionQuestions = byRegion[r];
    const unplayed = regionQuestions.filter((q) => !excludeSet.has(q.id));
    const played = regionQuestions.filter((q) => excludeSet.has(q.id));

    const shuffledUnplayed = shuffleArray(unplayed, rng);
    if (shuffledUnplayed.length >= quota) {
      picked.push(...shuffledUnplayed.slice(0, quota));
    } else {
      // Hết câu mới trong vùng này thì bù từ các câu đã chơi
      const shuffledPlayed = shuffleArray(played, rng);
      const needed = quota - shuffledUnplayed.length;
      picked.push(...shuffledUnplayed, ...shuffledPlayed.slice(0, needed));
    }
  }

  // Xáo trộn ngẫu nhiên thứ tự 12 câu cuối cùng để các vùng đan xen tự nhiên
  return shuffleArray(picked, rng);
}

/**
 * Chấm điểm câu trả lời và lưu thông tin tỉnh thành, cờ dùng gợi ý
 */
export function scoreQuestion(
  question: Question,
  selectedIndex: number,
  usedHint = false,
): QuestionResult {
  const isCorrect = selectedIndex === question.dapAn;
  const provinceSlug = to34Province(question.tinh);

  return {
    question,
    selectedIndex,
    isCorrect,
    provinceSlug,
    usedHint,
  };
}

/**
 * Chọn danh hiệu vui, tích cực, không phán xét, không phần trăm
 */
export function determineFunTitle(results: QuestionResult[]): FunTitle {
  const correctCount = results.filter((r) => r.isCorrect).length;

  // Thống kê số câu đúng theo vùng và chủ đề
  const correctByRegion: Record<string, number> = {};
  const correctByTopic: Record<string, number> = {};

  for (const r of results) {
    if (r.isCorrect) {
      correctByRegion[r.question.vung] = (correctByRegion[r.question.vung] || 0) + 1;
      correctByTopic[r.question.chuDe] = (correctByTopic[r.question.chuDe] || 0) + 1;
    }
  }

  // Tìm vùng có duyên nhất
  let maxRegion = '';
  let maxRegionScore = 0;
  for (const [vung, score] of Object.entries(correctByRegion)) {
    if (score > maxRegionScore) {
      maxRegionScore = score;
      maxRegion = vung;
    }
  }

  // Tìm chủ đề nổi bật
  const foodScore = correctByTopic['món ăn vùng miền'] || 0;
  const geoScore = correctByTopic['địa danh & địa lý'] || 0;
  const dialectScore = correctByTopic['phương ngữ & cách gọi'] || 0;

  // Danh hiệu theo thế mạnh đặc trưng
  if (foodScore >= 2 && foodScore >= maxRegionScore) {
    return {
      id: 'su-gia-am-thuc',
      name: 'Sứ giả ẩm thực 5 miền',
      badge: '🍲',
      description: 'Bạn có trực giác tuyệt vời với hương vị và nét đặc sắc trong mâm cơm người Việt khắp ba miền.',
    };
  }

  if (dialectScore >= 2 && dialectScore >= maxRegionScore) {
    return {
      id: 'nha-ngon-ngu-hoc',
      name: 'Bậc thầy phương ngữ',
      badge: '🗣️',
      description: 'Mô, tê, răng, rứa hay trâm bắp… tiếng quê ngọt ngào nghe qua là bạn bắt sóng được ngay.',
    };
  }

  if (maxRegion === 'Biển đảo' && maxRegionScore >= 2) {
    return {
      id: 'thuy-thu-bien-dong',
      name: 'Nhà thám hiểm đại dương',
      badge: '🌊',
      description: 'Gió mặn mòi, đảo xa và những lễ hội ngư dân ven biển dường như đã ngấm sâu trong tâm hồn bạn.',
    };
  }

  if (maxRegion === 'Tây Nguyên' && maxRegionScore >= 2) {
    return {
      id: 'canh-chim-dai-ngan',
      name: 'Cánh chim đại ngàn',
      badge: '🦅',
      description: 'Âm vang cồng chiêng, mái nhà rông và hương cà phê đất đỏ luôn có một vị trí đặc biệt trong lòng bạn.',
    };
  }

  if (maxRegion === 'Trung' && maxRegionScore >= 2) {
    return {
      id: 'lu-khach-mien-trung',
      name: 'Lữ khách miền Trung',
      badge: '🏮',
      description: 'Dải đất hẹp đầy ân tình, đầm phá và những câu hát đối hữu tình đã để lại trong bạn nhiều kỷ niệm đẹp.',
    };
  }

  if (maxRegion === 'Bắc' && maxRegionScore >= 2) {
    return {
      id: 'nguoi-ban-kinh-bac',
      name: 'Giai điệu Kinh Bắc & Đất Bắc',
      badge: '🎋',
      description: 'Bạn trân quý những nét văn hóa cổ kính, hương cốm mùa thu và điệu hát giao duyên làng quan họ.',
    };
  }

  if (maxRegion === 'Nam' && maxRegionScore >= 2) {
    return {
      id: 'dai-su-phuong-nam',
      name: 'Đại sứ văn hóa phương Nam',
      badge: '🛶',
      description: 'Bạn yêu tính cách hào sảng, chợ nổi sông nước và những câu chuyện đượm tình đất chín rồng.',
    };
  }

  if (correctCount >= 10) {
    return {
      id: 'nha-du-hanh-phong-vi',
      name: 'Nhà du hành phong vị Việt Nam',
      badge: '✨',
      description: 'Một tâm hồn yêu văn hoá sâu sắc, mở lòng đón nhận vẻ đẹp đa sắc của mọi miền Tổ quốc.',
    };
  }

  // Danh hiệu mặc định đầy ấm áp, khích lệ
  return {
    id: 'lu-khach-to-mo',
    name: 'Lữ khách tò mò & mến thương',
    badge: '🧭',
    description: 'Chuyến đi văn hóa vừa mở ra nhiều điều mới lạ. Đất nước mình mỗi góc nhỏ đều có một điều kỳ thú chờ bạn khám phá.',
  };
}

/**
 * Tổng hợp kết quả màn chơi:
 * - Bản đồ 34 tỉnh (tô màu theo đã đúng/đã ghé)
 * - Số vùng đã khám phá
 * - 3 điều mới học (ưu tiên từ các câu làm sai để người chơi bổ sung kiến thức)
 * - Danh hiệu vui không phán xét
 * - Tuyệt đối không có phần trăm (%)
 */
export function computeGameSummary(results: QuestionResult[]): GameSummary {
  const total = results.length;
  const correctCount = results.filter((r) => r.isCorrect).length;

  // Danh sách các vùng đất đã chạm tới
  const regionSet = new Set<Region>();
  for (const r of results) {
    regionSet.add(r.question.vung);
  }
  const regionsExplored = Array.from(regionSet);

  // Danh sách các tỉnh đã khám phá
  const provMap = new Map<
    string,
    { slug: string; name: string; isCorrect: boolean; vung: Region }
  >();

  for (const r of results) {
    const slug = r.provinceSlug;
    const existing = provMap.get(slug);
    // Nếu có 2 câu cùng 1 tỉnh, ưu tiên trạng thái đúng
    if (!existing || (!existing.isCorrect && r.isCorrect)) {
      provMap.set(slug, {
        slug,
        name: getProvinceName(slug),
        isCorrect: r.isCorrect,
        vung: r.question.vung,
      });
    }
  }

  const provincesExplored = Array.from(provMap.values());

  // Chọn 3 điều mới học:
  // Ưu tiên câu làm sai (học điều mới), nếu không đủ 3 thì bổ sung từ các câu làm đúng
  const wrongResults = results.filter((r) => !r.isCorrect);
  const correctResults = results.filter((r) => r.isCorrect);

  const factCandidates = [...wrongResults, ...correctResults];
  const learnedFacts: LearnedFact[] = factCandidates.slice(0, 3).map((r) => ({
    questionId: r.question.id,
    vung: r.question.vung,
    tinh: getProvinceName(r.provinceSlug),
    cauHoi: r.question.cauHoi,
    giaiThich: r.question.giaiThich,
    nguon: r.question.nguon,
    wasCorrect: r.isCorrect,
    usedHint: r.usedHint,
  }));

  const title = determineFunTitle(results);

  return {
    total,
    correctCount,
    regionsExplored,
    provincesExplored,
    learnedFacts,
    title,
  };
}

/**
 * Xuất ảnh PNG 1200×630 tóm tắt chuyến khám phá (bản đồ 34 tỉnh + danh hiệu vui)
 */
export async function exportSummaryImage(summary: GameSummary): Promise<boolean> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 630;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    // 1. Nền kem sáng ấm áp
    ctx.fillStyle = '#faf8f5';
    ctx.fillRect(0, 0, 1200, 630);

    // Viền thẻ bo góc nghệ thuật
    ctx.strokeStyle = '#e6dfd5';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, 1160, 590);

    // 2. Cột trái: Thông tin kết quả & danh hiệu (rộng ~ 650px)
    // Badge phụ
    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    ctx.roundRect(50, 48, 280, 32, 16);
    ctx.fill();

    ctx.fillStyle = '#b45309';
    ctx.font = '700 13px "Be Vietnam Pro", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HOW VIETNAMESE ARE YOU?', 190, 64);

    // Tiêu đề chính
    ctx.textAlign = 'left';
    ctx.fillStyle = '#1f1d1a';
    ctx.font = '800 38px "Be Vietnam Pro", system-ui, sans-serif';
    ctx.fillText('Bạn hiểu Việt Nam đến đâu?', 50, 122);

    // Danh hiệu lớn
    ctx.font = '700 30px "Be Vietnam Pro", system-ui, sans-serif';
    ctx.fillStyle = '#e11d48';
    ctx.fillText(`${summary.title.badge} ${summary.title.name}`, 50, 172);

    // Mô tả danh hiệu
    ctx.font = '500 16px "Be Vietnam Pro", system-ui, sans-serif';
    ctx.fillStyle = '#6b665f';
    const descLines = wrapText(summary.title.description, 45);
    descLines.forEach((line, idx) => {
      ctx.fillText(line, 50, 208 + idx * 24);
    });

    // Thống kê ấn tượng (KHÔNG %!)
    const statY = 280;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#f0ece1';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(50, statY, 480, 84, 12);
    ctx.fill();
    ctx.stroke();

    // Box 1: Vùng đất
    ctx.fillStyle = '#059669';
    ctx.font = '800 24px "Be Vietnam Pro", system-ui, sans-serif';
    ctx.fillText(`${summary.regionsExplored.length}/5`, 75, statY + 36);
    ctx.fillStyle = '#6b665f';
    ctx.font = '500 14px "Be Vietnam Pro", system-ui, sans-serif';
    ctx.fillText('Vùng đất đã ghé', 75, statY + 62);

    // Box 2: Tỉnh thành
    ctx.fillStyle = '#2563eb';
    ctx.font = '800 24px "Be Vietnam Pro", system-ui, sans-serif';
    ctx.fillText(`${summary.provincesExplored.length}/34`, 215, statY + 36);
    ctx.fillStyle = '#6b665f';
    ctx.font = '500 14px "Be Vietnam Pro", system-ui, sans-serif';
    ctx.fillText('Tỉnh thành đã khám phá', 215, statY + 62);

    // Box 3: Điều thú vị
    ctx.fillStyle = '#d97706';
    ctx.font = '800 24px "Be Vietnam Pro", system-ui, sans-serif';
    ctx.fillText(`${summary.correctCount}/${summary.total}`, 380, statY + 36);
    ctx.fillStyle = '#6b665f';
    ctx.font = '500 14px "Be Vietnam Pro", system-ui, sans-serif';
    ctx.fillText('Nét văn hoá mở khoá', 380, statY + 62);

    // Điều mới học ngắn gọn
    if (summary.learnedFacts.length > 0) {
      ctx.fillStyle = '#1f1d1a';
      ctx.font = '700 16px "Be Vietnam Pro", system-ui, sans-serif';
      ctx.fillText('💡 Điều mới học được từ hành trình:', 50, 395);

      summary.learnedFacts.slice(0, 2).forEach((fact, idx) => {
        const itemY = 425 + idx * 60;
        ctx.fillStyle = '#374151';
        ctx.font = '500 13px "Be Vietnam Pro", system-ui, sans-serif';
        const lines = wrapText(`• [${fact.tinh}] ${fact.giaiThich}`, 55);
        lines.slice(0, 2).forEach((l, lIdx) => {
          ctx.fillText(l, 55, itemY + lIdx * 20);
        });
      });
    }

    // Chân trang
    ctx.strokeStyle = '#e6dfd5';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(50, 560);
    ctx.lineTo(1150, 560);
    ctx.stroke();

    ctx.fillStyle = '#9ca3af';
    ctx.font = '500 14px "Be Vietnam Pro", system-ui, sans-serif';
    ctx.fillText('Chuyến khám phá văn hoá Việt Nam · Không phải bài kiểm tra quốc tịch', 50, 585);
    ctx.textAlign = 'right';
    ctx.fillText('kham-pha.phungkien4002.workers.dev/hieu-viet-nam', 1150, 585);

    // 3. Cột phải: Bản đồ 34 tỉnh Việt Nam
    // Khung bản đồ: x=620, y=50, w=520, h=490
    const mapBox = { x: 620, y: 50, w: 520, h: 490 };
    const correctSlugs = new Set(
      summary.provincesExplored.filter((p) => p.isCorrect).map((p) => p.slug)
    );
    const visitedSlugs = new Set(summary.provincesExplored.map((p) => p.slug));

    // Hệ toạ độ viewBox: -460 -800 1740 1840
    const scale = Math.min(mapBox.w / 1740, mapBox.h / 1840);
    const offsetX = mapBox.x + (mapBox.w - 1740 * scale) / 2 - -460 * scale;
    const offsetY = mapBox.y + (mapBox.h - 1840 * scale) / 2 - -800 * scale;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    if (typeof Path2D !== 'undefined') {
      for (const [slug, item] of Object.entries(PROVINCES_34)) {
        if (!item.d) continue;
        const p2d = new Path2D(item.d);

        if (correctSlugs.has(slug)) {
          // Đúng: màu đậm nổi bật (#10b981)
          ctx.fillStyle = '#059669';
          ctx.fill(p2d, 'evenodd');
          ctx.strokeStyle = '#047857';
          ctx.lineWidth = 2.5 / scale;
          ctx.stroke(p2d);
        } else if (visitedSlugs.has(slug)) {
          // Sai ("đã ghé"): màu nhạt (#fdba74)
          ctx.fillStyle = '#fde68a';
          ctx.fill(p2d, 'evenodd');
          ctx.strokeStyle = '#d97706';
          ctx.lineWidth = 2 / scale;
          ctx.stroke(p2d);
        } else {
          // Chưa ghé: màu kem nhạt trung tính
          ctx.fillStyle = '#e8e2d8';
          ctx.fill(p2d, 'evenodd');
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.2 / scale;
          ctx.stroke(p2d);
        }
      }

      // Nhãn chủ quyền biển đảo
      ctx.fillStyle = '#0369a1';
      ctx.font = `${Math.round(26 / scale)}px "Be Vietnam Pro", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('BIỂN ĐÔNG', 520, -100);
      ctx.font = `${Math.round(20 / scale)}px "Be Vietnam Pro", sans-serif`;
      ctx.fillText('QĐ. Hoàng Sa', 610, 20);
      ctx.fillText('QĐ. Trường Sa', 860, 740);
    }
    ctx.restore();

    // Chú thích bản đồ (Legend) ở góc dưới phải
    ctx.textAlign = 'left';
    ctx.font = '600 12px "Be Vietnam Pro", system-ui, sans-serif';

    // Đã mở khoá (Đúng)
    ctx.fillStyle = '#059669';
    ctx.fillRect(800, 525, 12, 12);
    ctx.fillStyle = '#374151';
    ctx.fillText('Đã mở khoá (đúng)', 820, 535);

    // Đã ghé qua (Chưa đúng)
    ctx.fillStyle = '#fde68a';
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 1;
    ctx.fillRect(960, 525, 12, 12);
    ctx.strokeRect(960, 525, 12, 12);
    ctx.fillStyle = '#374151';
    ctx.fillText('Đã ghé qua', 980, 535);

    // 4. Chia sẻ hoặc tải file
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png')
    );

    if (!blob) return false;

    const file = new File([blob], 'hieu-viet-nam.png', { type: 'image/png' });

    if (
      typeof navigator !== 'undefined' &&
      navigator.canShare &&
      navigator.canShare({ files: [file] })
    ) {
      await navigator.share({
        title: `Bạn hiểu Việt Nam đến đâu? — Danh hiệu: ${summary.title.name}`,
        text: `Mình vừa khám phá ${summary.regionsExplored.length}/5 vùng đất và nhận danh hiệu "${summary.title.name}"!`,
        files: [file],
      });
      return true;
    }

    // Fallback tải xuống
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hieu-viet-nam.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.error('Lỗi xuất ảnh chia sẻ:', err);
    return false;
  }
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const w of words) {
    if ((current + ' ' + w).trim().length > maxChars) {
      if (current) lines.push(current.trim());
      current = w;
    } else {
      current += (current ? ' ' : '') + w;
    }
  }
  if (current) lines.push(current.trim());
  return lines;
}
