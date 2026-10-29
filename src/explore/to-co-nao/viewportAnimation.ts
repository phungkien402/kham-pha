// src/explore/to-co-nao/viewportAnimation.ts
// Hàm tween viewport mượt mà (rAF + ease-in-out), hỗ trợ prefers-reduced-motion và huỷ hoạt ảnh.

import type { Viewport } from './types';

export interface ViewportAnimationOptions {
  duration?: number; // ms, mặc định 600
  easing?: (t: number) => number;
  onUpdate: (vp: Viewport) => void;
  onComplete?: () => void;
  reducedMotion?: boolean;
}

/**
 * Hàm easing ease-in-out cubic.
 */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Kiểm tra xem người dùng có yêu cầu giảm chuyển động (reduced-motion) hay không.
 */
export function isReducedMotionPreferred(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Tween mượt mà giữa toạ độ viewport cũ và mới.
 * Nếu reduced-motion được kích hoạt, nhảy thẳng tới vị trí đích ngay lập tức.
 * Trả về hàm huỷ (cancel) hoạt ảnh.
 */
export function animateViewport(
  from: Viewport,
  to: Viewport,
  options: ViewportAnimationOptions
): () => void {
  const {
    duration = 600,
    easing = easeInOutCubic,
    onUpdate,
    onComplete,
  } = options;

  const reduced = options.reducedMotion ?? isReducedMotionPreferred();

  // Khi reduced-motion bật hoặc thời lượng <= 0: nhảy thẳng
  if (reduced || duration <= 0) {
    onUpdate({ cx: to.cx, cy: to.cy, scale: to.scale });
    onComplete?.();
    return () => {};
  }

  // Nếu môi trường không có requestAnimationFrame (ví dụ Node test không mock rAF)
  if (typeof requestAnimationFrame === 'undefined') {
    onUpdate({ cx: to.cx, cy: to.cy, scale: to.scale });
    onComplete?.();
    return () => {};
  }

  let rafId: number | null = null;
  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

  function step(now: number) {
    const elapsed = now - startTime;
    const progress = Math.min(Math.max(elapsed / duration, 0), 1);
    const ease = easing(progress);

    const currentVp: Viewport = {
      cx: from.cx + (to.cx - from.cx) * ease,
      cy: from.cy + (to.cy - from.cy) * ease,
      scale: from.scale + (to.scale - from.scale) * ease,
    };

    onUpdate(currentVp);

    if (progress < 1) {
      rafId = requestAnimationFrame(step);
    } else {
      rafId = null;
      onComplete?.();
    }
  }

  rafId = requestAnimationFrame(step);

  return () => {
    if (rafId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };
}
