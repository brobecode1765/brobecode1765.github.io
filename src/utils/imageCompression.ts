import { BLUEPRINT_LIMITS } from '../firebase';

/**
 * Compresses an image File or HTMLVideoElement frame into a compact JPEG Data URL
 * strictly conforming to BLUEPRINT_LIMITS.BOOK_PHOTO_MAX (<= 300,000 chars).
 */
export async function compressImageFileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file format.'));
      img.onload = () => {
        try {
          const dataUrl = renderAndCompressToBudget(img, img.width, img.height);
          resolve(dataUrl);
        } catch (err) {
          reject(err);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function captureVideoFrameToDataUrl(video: HTMLVideoElement): string {
  const width = video.videoWidth || 640;
  const height = video.videoHeight || 480;
  return renderAndCompressToBudget(video, width, height);
}

function renderAndCompressToBudget(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number
): string {
  const maxDimensionCandidates = [540, 440, 360, 280];
  const qualityCandidates = [0.72, 0.62, 0.52, 0.42];

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context is unavailable.');
  }

  for (let i = 0; i < maxDimensionCandidates.length; i++) {
    const maxDim = maxDimensionCandidates[i];
    const quality = qualityCandidates[i];
    const scale = Math.min(1, maxDim / Math.max(sourceWidth, sourceHeight, 1));
    const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
    const targetHeight = Math.max(1, Math.round(sourceHeight * scale));

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    ctx.fillStyle = '#FAF8F5';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(source, 0, 0, targetWidth, targetHeight);

    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (
      dataUrl.length >= BLUEPRINT_LIMITS.BOOK_PHOTO_MIN &&
      dataUrl.length <= BLUEPRINT_LIMITS.BOOK_PHOTO_MAX - 20000
    ) {
      return dataUrl;
    }
  }

  const fallback = canvas.toDataURL('image/jpeg', 0.35);
  if (fallback.length > BLUEPRINT_LIMITS.BOOK_PHOTO_MAX) {
    throw new Error('Captured photo exceeds maximum storage size. Please try another angle.');
  }
  return fallback;
}
