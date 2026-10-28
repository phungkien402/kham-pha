/**
 * Module dùng chung cho cả Admin (/admin) và trang Gửi ảnh công khai (/gui-anh):
 * Vẽ lại ảnh qua <canvas> trên trình duyệt để thu nhỏ về cạnh dài ≤ 2000px (bản chính)
 * và ≤ 600px (bản lưới), xuất sang WebP chất lượng ~0,8 và tự động xoá toàn bộ EXIF/GPS.
 */

export interface CompressedWebpResult {
  blob: Blob;
  width: number;
  height: number;
}

export interface CompressedPhotoPair {
  full: CompressedWebpResult;
  thumb: CompressedWebpResult;
  fileMain: File;
  file600: File;
}

export function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Không đọc được ảnh: ${file.name}`));
    };
    img.src = url;
  });
}

export async function compressToWebp(
  img: HTMLImageElement,
  maxEdge: number,
  quality = 0.8,
): Promise<CompressedWebpResult> {
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  const longest = Math.max(srcW, srcH, 1);
  const scale = longest > maxEdge ? maxEdge / longest : 1;
  const width = Math.max(1, Math.round(srcW * scale));
  const height = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Trình duyệt không hỗ trợ Canvas 2D');
  }
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Không thể nén ảnh sang WebP'));
      },
      'image/webp',
      quality,
    );
  });

  return { blob, width, height };
}

export async function compressPhotoFile(
  rawFile: File,
  quality = 0.8,
): Promise<CompressedPhotoPair> {
  const img = await loadImageElement(rawFile);
  const full = await compressToWebp(img, 2000, quality);
  const thumb = await compressToWebp(img, 600, quality);
  const baseName = rawFile.name.replace(/\.[^.]+$/, '') || 'photo';

  const fileMain = new File([full.blob], `${baseName}.webp`, { type: 'image/webp' });
  const file600 = new File([thumb.blob], `${baseName}-600.webp`, { type: 'image/webp' });

  return {
    full,
    thumb,
    fileMain,
    file600,
  };
}
