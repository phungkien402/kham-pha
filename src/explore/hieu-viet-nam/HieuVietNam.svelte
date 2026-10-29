<!-- src/explore/hieu-viet-nam/HieuVietNam.svelte -->
<script lang="ts">
  import questionsData from './data/cau-hoi.json';
  import {
    REGIONS,
    PROVINCES_34,
    MAP_VIEWBOX,
    to34Province,
    getProvinceName,
    pickRoundQuestions,
    scoreQuestion,
    computeGameSummary,
    exportSummaryImage,
    type Question,
    type QuestionResult,
    type GameSummary,
    type Region,
  } from './game';

  const allQuestions = questionsData as Question[];

  type GameState = 'start' | 'playing' | 'result';

  let gameState = $state<GameState>('start');
  let currentQuestions = $state<Question[]>([]);
  let currentIndex = $state(0);
  let results = $state<QuestionResult[]>([]);
  let selectedOption = $state<number | null>(null);
  let hasAnswered = $state(false);
  let isExporting = $state(false);
  let exportMessage = $state<string | null>(null);
  let hoveredProvince = $state<string | null>(null);

  const currentQuestion = $derived<Question | undefined>(
    currentQuestions[currentIndex]
  );

  const currentProvinceSlug = $derived<string>(
    currentQuestion ? to34Province(currentQuestion.tinh) : ''
  );

  const currentProvinceName = $derived<string>(
    currentProvinceSlug ? getProvinceName(currentProvinceSlug) : ''
  );

  const summary = $derived<GameSummary | null>(
    gameState === 'result' && results.length > 0
      ? computeGameSummary(results)
      : null
  );

  // Tập hợp các tỉnh đã đúng và đã ghé qua trong lượt chơi
  const answeredProvincesMap = $derived(() => {
    const map = new Map<string, { isCorrect: boolean }>();
    for (const r of results) {
      const prev = map.get(r.provinceSlug);
      if (!prev || (!prev.isCorrect && r.isCorrect)) {
        map.set(r.provinceSlug, { isCorrect: r.isCorrect });
      }
    }
    return map;
  });

  function getRegionIcon(vung: Region): string {
    switch (vung) {
      case 'Bắc':
        return '🎋';
      case 'Trung':
        return '🏮';
      case 'Tây Nguyên':
        return '🦅';
      case 'Nam':
        return '🛶';
      case 'Biển đảo':
        return '🌊';
      default:
        return '📍';
    }
  }

  function startGame() {
    currentQuestions = pickRoundQuestions(allQuestions, 12);
    currentIndex = 0;
    results = [];
    selectedOption = null;
    hasAnswered = false;
    exportMessage = null;
    gameState = 'playing';
  }

  function handleSelectOption(index: number) {
    if (hasAnswered || !currentQuestion) return;

    selectedOption = index;
    hasAnswered = true;

    const res = scoreQuestion(currentQuestion, index);
    results = [...results, res];
  }

  function nextQuestion() {
    if (currentIndex < currentQuestions.length - 1) {
      currentIndex += 1;
      selectedOption = null;
      hasAnswered = false;
    } else {
      gameState = 'result';
    }
  }

  async function handleShareImage() {
    if (!summary || isExporting) return;
    isExporting = true;
    exportMessage = 'Đang tạo ảnh chia sẻ...';

    try {
      const success = await exportSummaryImage(summary);
      if (success) {
        exportMessage = '✓ Đã tạo ảnh thành công!';
      } else {
        exportMessage = 'Không thể xuất ảnh lúc này.';
      }
    } catch {
      exportMessage = 'Đã có lỗi khi xuất ảnh.';
    } finally {
      isExporting = false;
      setTimeout(() => {
        exportMessage = null;
      }, 4000);
    }
  }
</script>

<div class="hvn-container">
  {#if gameState === 'start'}
    <!-- MÀN 1: BẮT ĐẦU -->
    <div class="start-screen">
      <div class="hero-badge">
        <span class="pulse-dot"></span>
        HOW VIETNAMESE ARE YOU?
      </div>

      <h1 class="hero-title">Bạn hiểu Việt Nam đến đâu?</h1>

      <p class="hero-subtitle">
        Một chuyến khám phá văn hoá 5 vùng miền, không phải bài kiểm tra quốc tịch hay thước đo lòng yêu nước.
      </p>

      <div class="intro-card">
        <p class="intro-desc">
          Mỗi lượt chơi sẽ bốc ngẫu nhiên <strong>12 câu hỏi</strong> đan xen khắp <strong>Bắc, Trung, Nam, Tây Nguyên và Biển đảo</strong>. Đi qua mỗi câu, bản đồ 34 tỉnh thành sẽ sáng đèn ghi dấu những điều kỳ thú bạn vừa học được.
        </p>

        <!-- 5 Vùng đất văn hóa -->
        <div class="regions-ribbon">
          <div class="region-pill r-bac"><span>🎋</span> Miền Bắc</div>
          <div class="region-pill r-trung"><span>🏮</span> Miền Trung</div>
          <div class="region-pill r-taynguyen"><span>🦅</span> Tây Nguyên</div>
          <div class="region-pill r-nam"><span>🛶</span> Miền Nam</div>
          <div class="region-pill r-biendao"><span>🌊</span> Biển đảo</div>
        </div>
      </div>

      <!-- Preview bản đồ mini toàn cảnh -->
      <div class="preview-map-wrapper">
        <svg
          class="vn-map-svg"
          viewBox={`${MAP_VIEWBOX.x} ${MAP_VIEWBOX.y} ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`}
          preserveAspectRatio="xMidYMid meet"
          aria-label="Bản đồ 34 tỉnh thành Việt Nam"
        >
          <g class="map-provinces-group">
            {#each Object.entries(PROVINCES_34) as [slug, item]}
              <path
                d={item.d}
                class="province-path preview"
              />
            {/each}
          </g>

          <text x="520" y="-100" class="sea-text">BIỂN ĐÔNG</text>
          <text x="610" y="20" class="island-text">QĐ. Hoàng Sa</text>
          <text x="860" y="740" class="island-text">QĐ. Trường Sa</text>
        </svg>
      </div>

      <div class="cta-actions">
        <button class="btn btn-primary btn-large" onclick={startGame}>
          🚀 Bắt đầu khám phá (12 câu)
        </button>
      </div>
    </div>
  {:else if gameState === 'playing' && currentQuestion}
    <!-- MÀN 2: ĐANG CHƠI -->
    <div class="playing-screen">
      <!-- Thanh tiến trình trên cùng -->
      <header class="quiz-header">
        <div class="quiz-status-row">
          <span class="step-badge">
            Câu <strong>{currentIndex + 1}</strong> / {currentQuestions.length}
          </span>

          <span class="tag-vung">
            {getRegionIcon(currentQuestion.vung)} {currentQuestion.vung}
          </span>

          <span class="tag-topic">
            {currentQuestion.chuDe}
          </span>
        </div>

        <div class="progress-bar-bg" aria-hidden="true">
          <div
            class="progress-bar-fill"
            style="width: {((currentIndex + (hasAnswered ? 1 : 0)) / currentQuestions.length) * 100}%"
          ></div>
        </div>
      </header>

      <!-- Nội dung 2 cột: Bản đồ tương tác & Khung câu hỏi -->
      <div class="quiz-body-grid">
        <!-- Cột trái: Bản đồ mini sáng đèn tỉnh hiện tại -->
        <div class="map-pane">
          <div class="map-pane-header">
            <span class="map-pane-title">
              📍 <strong>{currentProvinceName}</strong>
            </span>
            <span class="map-hint">
              {hasAnswered ? (results[results.length - 1]?.isCorrect ? '✓ Đã mở khoá' : '○ Đã ghé thăm') : 'Điểm đến câu này'}
            </span>
          </div>

          <div class="interactive-map-box">
            <svg
              class="vn-map-svg"
              viewBox={`${MAP_VIEWBOX.x} ${MAP_VIEWBOX.y} ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`}
              preserveAspectRatio="xMidYMid meet"
              aria-label="Bản đồ khám phá tỉnh {currentProvinceName}"
            >
              <g class="map-provinces-group">
                {#each Object.entries(PROVINCES_34) as [slug, item]}
                  {@const isCurrent = currentProvinceSlug === slug}
                  {@const status = answeredProvincesMap().get(slug)}
                  {@const isCorrectProv = status?.isCorrect === true}
                  {@const isVisitedProv = status !== undefined}

                  <path
                    d={item.d}
                    class="province-path"
                    class:is-current={isCurrent}
                    class:is-correct={isCorrectProv}
                    class:is-visited={isVisitedProv && !isCorrectProv}
                  />
                {/each}
              </g>

              <text x="520" y="-100" class="sea-text">BIỂN ĐÔNG</text>
              <text x="610" y="20" class="island-text">QĐ. Hoàng Sa</text>
              <text x="860" y="740" class="island-text">QĐ. Trường Sa</text>
            </svg>
          </div>
        </div>

        <!-- Cột phải: Thẻ câu hỏi và các lựa chọn -->
        <div class="question-pane">
          <div class="question-card">
            <h2 class="question-text">
              {currentQuestion.cauHoi}
            </h2>

            <!-- 4 Lựa chọn -->
            <div class="options-grid" role="radiogroup">
              {#each currentQuestion.luaChon as option, idx}
                {@const isSelected = selectedOption === idx}
                {@const isRightAnswer = currentQuestion.dapAn === idx}
                {@const showCorrect = hasAnswered && isRightAnswer}
                {@const showWrong = hasAnswered && isSelected && !isRightAnswer}

                <button
                  type="button"
                  class="option-btn"
                  class:is-selected={isSelected}
                  class:is-correct={showCorrect}
                  class:is-wrong={showWrong}
                  disabled={hasAnswered}
                  onclick={() => handleSelectOption(idx)}
                >
                  <span class="option-letter">
                    {['A', 'B', 'C', 'D'][idx]}
                  </span>
                  <span class="option-label">{option}</span>
                  {#if showCorrect}
                    <span class="feedback-icon correct">✓</span>
                  {:else if showWrong}
                    <span class="feedback-icon wrong">✕</span>
                  {/if}
                </button>
              {/each}
            </div>

            <!-- Khung giải thích mở ra ngay sau khi chọn -->
            {#if hasAnswered}
              {@const lastResult = results[results.length - 1]}
              <div
                class="explanation-card"
                class:is-correct-box={lastResult?.isCorrect}
                class:is-wrong-box={!lastResult?.isCorrect}
              >
                <div class="explanation-title">
                  {#if lastResult?.isCorrect}
                    <span class="exp-badge exp-good">✨ Chính xác!</span>
                  {:else}
                    <span class="exp-badge exp-miss">💡 Thêm một điều mới:</span>
                  {/if}
                </div>

                <p class="explanation-content">
                  {currentQuestion.giaiThich}
                </p>

                <div class="explanation-source">
                  <a
                    href={currentQuestion.nguon}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="source-link"
                  >
                    📖 Nguồn kiểm chứng ↗
                  </a>
                </div>
              </div>

              <!-- Nút chuyển câu tiếp theo -->
              <div class="action-footer">
                <button
                  class="btn btn-primary btn-next"
                  onclick={nextQuestion}
                >
                  {currentIndex < currentQuestions.length - 1 ? 'Câu tiếp theo →' : 'Xem kết quả 🏆'}
                </button>
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {:else if gameState === 'result' && summary}
    <!-- MÀN 3: KẾT QUẢ -->
    <div class="result-screen">
      <div class="result-celebration">
        <div class="celebration-badge">
          {summary.title.badge} {summary.title.name}
        </div>

        <h1 class="result-headline">
          Hành trình khám phá văn hóa đã hoàn thành!
        </h1>

        <p class="result-title-desc">
          {summary.title.description}
        </p>
      </div>

      <!-- Thống kê khám phá (tuyệt đối không hiện %) -->
      <div class="stats-row">
        <div class="stat-card">
          <span class="stat-num color-emerald">
            {summary.regionsExplored.length}/5
          </span>
          <span class="stat-label">Vùng đất đã ghé</span>
        </div>

        <div class="stat-card">
          <span class="stat-num color-blue">
            {summary.provincesExplored.length}/34
          </span>
          <span class="stat-label">Tỉnh thành đã khám phá</span>
        </div>

        <div class="stat-card">
          <span class="stat-num color-amber">
            {summary.correctCount}/{summary.total}
          </span>
          <span class="stat-label">Nét văn hoá mở khoá</span>
        </div>
      </div>

      <!-- Bản đồ 34 tỉnh thành kết quả -->
      <div class="result-map-card">
        <div class="result-map-header">
          <h2 class="section-title">Bản đồ văn hóa bạn vừa đi qua</h2>
          <div class="map-legend">
            <span class="legend-item">
              <span class="legend-color c-correct"></span> Đã mở khoá
            </span>
            <span class="legend-item">
              <span class="legend-color c-visited"></span> Đã ghé qua
            </span>
            <span class="legend-item">
              <span class="legend-color c-unvisited"></span> Chưa ghé
            </span>
          </div>
        </div>

        <div class="result-map-svg-wrap">
          <svg
            class="vn-map-svg large"
            viewBox={`${MAP_VIEWBOX.x} ${MAP_VIEWBOX.y} ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`}
            preserveAspectRatio="xMidYMid meet"
            aria-label="Bản đồ 34 tỉnh đã khám phá"
          >
            <g class="map-provinces-group">
              {#each Object.entries(PROVINCES_34) as [slug, item]}
                {@const status = answeredProvincesMap().get(slug)}
                {@const isCorrectProv = status?.isCorrect === true}
                {@const isVisitedProv = status !== undefined}

                <path
                  d={item.d}
                  class="province-path result-path"
                  class:is-correct={isCorrectProv}
                  class:is-visited={isVisitedProv && !isCorrectProv}
                  onmouseenter={() => (hoveredProvince = item.name)}
                  onmouseleave={() => (hoveredProvince = null)}
                />
              {/each}
            </g>

            <text x="520" y="-100" class="sea-text">BIỂN ĐÔNG</text>
            <text x="610" y="20" class="island-text">QĐ. Hoàng Sa</text>
            <text x="860" y="740" class="island-text">QĐ. Trường Sa</text>
          </svg>

          {#if hoveredProvince}
            <div class="map-tooltip">
              {hoveredProvince}
            </div>
          {/if}
        </div>
      </div>

      <!-- 3 điều mới học được -->
      <div class="learned-section">
        <h2 class="section-title">💡 3 điều mới học được từ chuyến đi</h2>
        <div class="facts-grid">
          {#each summary.learnedFacts as fact}
            <div class="fact-card" class:was-missed={!fact.wasCorrect}>
              <div class="fact-meta">
                <span class="fact-tag">
                  {getRegionIcon(fact.vung)} {fact.vung} · {fact.tinh}
                </span>
                <span class="fact-status">
                  {fact.wasCorrect ? '✓ Đã biết' : '💡 Điều mới'}
                </span>
              </div>
              <p class="fact-content">{fact.giaiThich}</p>
              <div class="fact-footer">
                <a
                  href={fact.nguon}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="source-link"
                >
                  Nguồn bài viết ↗
                </a>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Thao tác chia sẻ & chơi lại -->
      <div class="result-actions">
        <button
          class="btn btn-primary btn-large"
          onclick={handleShareImage}
          disabled={isExporting}
        >
          {isExporting ? '⏳ Đang tạo ảnh...' : '📸 Chia sẻ kết quả (ảnh PNG 1200×630)'}
        </button>

        <button class="btn btn-secondary btn-large" onclick={startGame}>
          🔄 Chơi lại lượt khác (bộ câu mới)
        </button>

        <a href="/" class="btn btn-outline">
          🏠 Về trang chủ
        </a>
      </div>

      {#if exportMessage}
        <div class="export-feedback" role="status">
          {exportMessage}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  :global(:root) {
    --hvn-primary: #e11d48;
    --hvn-primary-hover: #be123c;
    --hvn-emerald: #059669;
    --hvn-amber: #d97706;
    --hvn-blue: #2563eb;
    --hvn-bg-light: #faf8f5;
    --hvn-border: #e6dfd5;
    --hvn-text: #1f1d1a;
    --hvn-muted: #6b665f;
  }

  .hvn-container {
    max-width: 1040px;
    margin-inline: auto;
    padding: 1rem;
    box-sizing: border-box;
    font-family: 'Be Vietnam Pro', system-ui, -apple-system, sans-serif;
    color: var(--hvn-text);
  }

  /* NÚT BẤM DÙNG CHUNG */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    border-radius: 9999px;
    font-weight: 600;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
    text-decoration: none;
    border: none;
    max-width: 100%;
    box-sizing: border-box;
    text-align: center;
    white-space: normal;
    word-break: break-word;
  }

  .btn-large {
    padding: 0.85rem 1.5rem;
    font-size: clamp(0.95rem, 2.5vw, 1.1rem);
  }

  .btn-primary {
    background: var(--hvn-primary);
    color: #ffffff;
    box-shadow: 0 4px 14px rgba(225, 29, 72, 0.28);
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--hvn-primary-hover);
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(225, 29, 72, 0.35);
  }

  .btn-primary:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: #ffffff;
    color: var(--hvn-text);
    border: 1.5px solid var(--hvn-border);
  }

  .btn-secondary:hover {
    background: #f9f6f0;
    border-color: #d1c7b8;
  }

  .btn-outline {
    background: transparent;
    color: var(--hvn-muted);
    border: 1px solid var(--hvn-border);
  }

  .btn-outline:hover {
    color: var(--hvn-text);
    background: #ffffff;
  }

  /* MÀN BẮT ĐẦU */
  .start-screen {
    text-align: center;
    padding-block: 1.5rem 2.5rem;
  }

  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 1rem;
    background: #ffe4e6;
    color: #be123c;
    font-size: 0.8125rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    border-radius: 9999px;
    margin-bottom: 1rem;
  }

  .pulse-dot {
    width: 8px;
    height: 8px;
    background: #e11d48;
    border-radius: 50%;
    animation: pulse 1.8s infinite;
  }

  @keyframes pulse {
    0% { transform: scale(0.9); opacity: 0.7; }
    50% { transform: scale(1.3); opacity: 1; }
    100% { transform: scale(0.9); opacity: 0.7; }
  }

  .hero-title {
    font-size: clamp(2rem, 5vw, 3.2rem);
    font-weight: 800;
    line-height: 1.2;
    margin-bottom: 0.75rem;
    color: var(--hvn-text);
  }

  .hero-subtitle {
    font-size: clamp(1rem, 2.5vw, 1.25rem);
    color: var(--hvn-muted);
    max-width: 650px;
    margin-inline: auto;
    margin-bottom: 2rem;
    line-height: 1.6;
  }

  .intro-card {
    background: #ffffff;
    border: 1px solid var(--hvn-border);
    border-radius: 1.25rem;
    padding: clamp(1rem, 3.5vw, 1.75rem);
    max-width: 720px;
    margin-inline: auto;
    margin-bottom: 2rem;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);
    text-align: left;
    box-sizing: border-box;
  }

  .intro-desc {
    font-size: 1rem;
    line-height: 1.7;
    color: #374151;
    margin-bottom: 1.25rem;
  }

  .regions-ribbon {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: center;
  }

  .region-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem 0.85rem;
    border-radius: 9999px;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .r-bac { background: #fef3c7; color: #92400e; }
  .r-trung { background: #ffedd5; color: #9a3412; }
  .r-taynguyen { background: #ecfdf5; color: #065f46; }
  .r-nam { background: #e0f2fe; color: #075985; }
  .r-biendao { background: #f0fdf4; color: #166534; }

  .preview-map-wrapper {
    max-width: 320px;
    margin-inline: auto;
    margin-bottom: 2rem;
    aspect-ratio: 1740 / 1840;
  }

  /* SVG MAP DÙNG CHUNG */
  .vn-map-svg {
    width: 100%;
    height: 100%;
    display: block;
    overflow: visible;
  }

  .province-path {
    fill: #ede7de;
    stroke: #ffffff;
    stroke-width: 1.5;
    transition: all 0.25s ease;
  }

  .province-path.preview {
    fill: #e8e2d8;
  }

  .province-path.is-current {
    fill: #f43f5e;
    stroke: #be123c;
    stroke-width: 3;
    filter: drop-shadow(0 0 6px rgba(244, 63, 94, 0.6));
    animation: provinceGlow 1.8s infinite alternate;
  }

  @keyframes provinceGlow {
    from { fill: #f43f5e; }
    to { fill: #fb7185; }
  }

  .province-path.is-correct {
    fill: #059669;
    stroke: #047857;
    stroke-width: 2;
  }

  .province-path.is-visited {
    fill: #fde68a;
    stroke: #d97706;
    stroke-width: 1.8;
  }

  .province-path.result-path:hover {
    opacity: 0.85;
    cursor: pointer;
  }

  .sea-text {
    font-size: 32px;
    font-weight: 700;
    fill: #0284c7;
    letter-spacing: 0.1em;
  }

  .island-text {
    font-size: 26px;
    font-weight: 600;
    fill: #0369a1;
  }

  /* MÀN ĐANG CHƠI */
  .playing-screen {
    padding-bottom: 3rem;
  }

  .quiz-header {
    margin-bottom: 1.5rem;
  }

  .quiz-status-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.6rem;
    margin-bottom: 0.75rem;
  }

  .step-badge {
    background: #1f1d1a;
    color: #ffffff;
    padding: 0.3rem 0.85rem;
    border-radius: 9999px;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .tag-vung {
    background: #f3f4f6;
    color: #374151;
    padding: 0.3rem 0.8rem;
    border-radius: 9999px;
    font-size: 0.8125rem;
    font-weight: 600;
  }

  .tag-topic {
    background: #fff1f2;
    color: #be123c;
    padding: 0.3rem 0.8rem;
    border-radius: 9999px;
    font-size: 0.8125rem;
    font-weight: 600;
  }

  .progress-bar-bg {
    width: 100%;
    height: 8px;
    background: #e5e7eb;
    border-radius: 9999px;
    overflow: hidden;
  }

  .progress-bar-fill {
    height: 100%;
    background: var(--hvn-primary);
    border-radius: 9999px;
    transition: width 0.3s ease;
  }

  /* 2 CỘT: BẢN ĐỒ & CÂU HỎI */
  .quiz-body-grid {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: 1.5rem;
    align-items: start;
  }

  @media (max-width: 768px) {
    .quiz-body-grid {
      grid-template-columns: 1fr;
    }
  }

  .map-pane {
    background: #ffffff;
    border: 1px solid var(--hvn-border);
    border-radius: 1.25rem;
    padding: 1rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  }

  .map-pane-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
  }

  .map-pane-title {
    color: var(--hvn-text);
  }

  .map-hint {
    font-size: 0.75rem;
    color: var(--hvn-muted);
  }

  .interactive-map-box {
    width: 100%;
    max-height: 380px;
    aspect-ratio: 1740 / 1840;
    margin-inline: auto;
  }

  .question-card {
    background: #ffffff;
    border: 1px solid var(--hvn-border);
    border-radius: 1.25rem;
    padding: 1.75rem;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
  }

  .question-text {
    font-size: clamp(1.15rem, 2.5vw, 1.45rem);
    font-weight: 700;
    line-height: 1.5;
    margin-bottom: 1.5rem;
    color: var(--hvn-text);
  }

  .options-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .option-btn {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    width: 100%;
    text-align: left;
    padding: 1rem 1.25rem;
    background: #faf8f5;
    border: 1.5px solid var(--hvn-border);
    border-radius: 1rem;
    font-size: 1rem;
    font-weight: 500;
    color: #1f1d1a;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .option-btn:hover:not(:disabled) {
    background: #ffffff;
    border-color: var(--hvn-primary);
    transform: translateY(-1px);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.04);
  }

  .option-btn:disabled {
    cursor: default;
  }

  .option-letter {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    background: #e5e7eb;
    color: #374151;
    border-radius: 50%;
    font-size: 0.875rem;
    font-weight: 700;
    flex-shrink: 0;
  }

  .option-label {
    flex: 1;
    line-height: 1.45;
  }

  .feedback-icon {
    font-weight: 800;
    font-size: 1.1rem;
    flex-shrink: 0;
  }

  .feedback-icon.correct { color: #059669; }
  .feedback-icon.wrong { color: #dc2626; }

  /* Trạng thái trả lời đúng / sai */
  .option-btn.is-correct {
    background: #ecfdf5;
    border-color: #10b981;
    color: #065f46;
  }
  .option-btn.is-correct .option-letter {
    background: #059669;
    color: #ffffff;
  }

  .option-btn.is-wrong {
    background: #fef2f2;
    border-color: #f87171;
    color: #991b1b;
  }
  .option-btn.is-wrong .option-letter {
    background: #dc2626;
    color: #ffffff;
  }

  /* Khung giải thích & nguồn */
  .explanation-card {
    border-radius: 1rem;
    padding: 1.25rem;
    margin-bottom: 1.5rem;
    border: 1px solid transparent;
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .explanation-card.is-correct-box {
    background: #f0fdf4;
    border-color: #bbf7d0;
  }

  .explanation-card.is-wrong-box {
    background: #fffbeb;
    border-color: #fde68a;
  }

  .explanation-title {
    margin-bottom: 0.5rem;
  }

  .exp-badge {
    display: inline-block;
    padding: 0.2rem 0.65rem;
    border-radius: 9999px;
    font-size: 0.8125rem;
    font-weight: 700;
  }

  .exp-good {
    background: #dcfce7;
    color: #15803d;
  }

  .exp-miss {
    background: #fef3c7;
    color: #b45309;
  }

  .explanation-content {
    font-size: 0.95rem;
    line-height: 1.6;
    color: #374151;
    margin-bottom: 0.75rem;
  }

  .source-link {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.8125rem;
    color: #2563eb;
    text-decoration: underline;
    font-weight: 600;
  }

  .source-link:hover {
    color: #1d4ed8;
  }

  .action-footer {
    display: flex;
    justify-content: flex-end;
  }

  .btn-next {
    min-width: 180px;
  }

  /* MÀN KẾT QUẢ */
  .result-screen {
    padding-block: 1rem 3rem;
  }

  .result-celebration {
    text-align: center;
    margin-bottom: 2rem;
  }

  .celebration-badge {
    display: inline-block;
    padding: 0.4rem 1.2rem;
    background: #ffe4e6;
    color: #be123c;
    border-radius: 9999px;
    font-size: 1.15rem;
    font-weight: 800;
    margin-bottom: 0.75rem;
  }

  .result-headline {
    font-size: clamp(1.8rem, 4vw, 2.6rem);
    font-weight: 800;
    line-height: 1.3;
    margin-bottom: 0.75rem;
    color: var(--hvn-text);
  }

  .result-title-desc {
    font-size: 1.05rem;
    color: var(--hvn-muted);
    max-width: 640px;
    margin-inline: auto;
    line-height: 1.6;
  }

  .stats-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-bottom: 2rem;
  }

  @media (max-width: 640px) {
    .stats-row {
      grid-template-columns: 1fr;
    }
  }

  .stat-card {
    background: #ffffff;
    border: 1px solid var(--hvn-border);
    border-radius: 1rem;
    padding: 1.25rem;
    text-align: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  }

  .stat-num {
    display: block;
    font-size: 2rem;
    font-weight: 800;
    margin-bottom: 0.25rem;
  }

  .color-emerald { color: #059669; }
  .color-blue { color: #2563eb; }
  .color-amber { color: #d97706; }

  .stat-label {
    font-size: 0.875rem;
    color: var(--hvn-muted);
    font-weight: 500;
  }

  /* Thẻ bản đồ kết quả */
  .result-map-card {
    background: #ffffff;
    border: 1px solid var(--hvn-border);
    border-radius: 1.25rem;
    padding: 1.5rem;
    margin-bottom: 2rem;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);
  }

  .result-map-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-bottom: 1.25rem;
  }

  .section-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--hvn-text);
    margin: 0;
  }

  .map-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 1rem;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--hvn-muted);
  }

  .legend-item {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .legend-color {
    width: 12px;
    height: 12px;
    border-radius: 3px;
  }

  .c-correct { background: #059669; }
  .c-visited { background: #fde68a; border: 1px solid #d97706; }
  .c-unvisited { background: #ede7de; }

  .result-map-svg-wrap {
    position: relative;
    max-width: 520px;
    margin-inline: auto;
    aspect-ratio: 1740 / 1840;
  }

  .map-tooltip {
    position: absolute;
    bottom: 10px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(31, 29, 26, 0.9);
    color: #ffffff;
    padding: 0.35rem 0.85rem;
    border-radius: 9999px;
    font-size: 0.8125rem;
    font-weight: 600;
    pointer-events: none;
  }

  /* 3 ĐIỀU MỚI HỌC */
  .learned-section {
    margin-bottom: 2.5rem;
  }

  .learned-section .section-title {
    margin-bottom: 1rem;
  }

  .facts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
  }

  .fact-card {
    background: #ffffff;
    border: 1px solid var(--hvn-border);
    border-radius: 1rem;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
  }

  .fact-card.was-missed {
    border-left: 4px solid #d97706;
  }

  .fact-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .fact-tag {
    font-size: 0.8125rem;
    font-weight: 700;
    color: #374151;
  }

  .fact-status {
    font-size: 0.75rem;
    font-weight: 600;
    color: #b45309;
    background: #fef3c7;
    padding: 0.15rem 0.5rem;
    border-radius: 9999px;
  }

  .fact-content {
    font-size: 0.9375rem;
    line-height: 1.6;
    color: #4b5563;
    margin-bottom: 1rem;
    flex: 1;
  }

  .fact-footer {
    display: flex;
    justify-content: flex-end;
  }

  /* HÀNH ĐỘNG KẾT QUẢ */
  .result-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.85rem;
    width: 100%;
    max-width: 480px;
    margin-inline: auto;
  }

  .result-actions .btn {
    width: 100%;
  }

  .export-feedback {
    margin-top: 1rem;
    padding: 0.75rem 1.25rem;
    background: #f0fdf4;
    border: 1px solid #86efac;
    color: #15803d;
    border-radius: 9999px;
    font-weight: 600;
    font-size: 0.875rem;
    text-align: center;
  }
</style>
