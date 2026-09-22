import { Membership } from '../models';

export const STARTER_FILE_LIMIT = 10;
export const STARTER_LINK_LIMIT = 10;
export const PREMIUM_FILE_LIMIT = 35;
export const PREMIUM_LINK_LIMIT = 15;
export const PORTFOLIO_PDF_MAX_MB = 40;
export const PORTFOLIO_IMAGE_MAX_MB = 40;
const MB = 1024 * 1024;

export interface PortfolioCaps {
  files: number;
  links: number;
  allowPdf: boolean;
}

export function portfolioCapsFor(membership?: Membership | string | null): PortfolioCaps {
  if (membership === 'premium') {
    return { files: PREMIUM_FILE_LIMIT, links: PREMIUM_LINK_LIMIT, allowPdf: true };
  }
  return { files: STARTER_FILE_LIMIT, links: STARTER_LINK_LIMIT, allowPdf: false };
}

export function isPortfolioPdf(item: { media_type?: string; url?: string | null }): boolean {
  if (item.media_type === 'pdf') return true;
  return /\.pdf(\?|#|$)/i.test(item.url || '');
}

export function isPortfolioVideo(item: { media_type?: string }): boolean {
  return item.media_type === 'video';
}

export function isDirectVideoUrl(url?: string | null): boolean {
  return /\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/i.test(url || '');
}

export function isPlayableVideoFile(item: { media_type?: string; url?: string | null }): boolean {
  if (!isPortfolioVideo(item)) return false;
  const url = item.url || '';
  if (isDirectVideoUrl(url)) return true;
  return !/^https?:\/\//i.test(url);
}

export function videoEmbedUrl(raw?: string | null): string | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw.trim());
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      const id =
        parsed.searchParams.get('v') ||
        parsed.pathname.match(/\/(?:embed|shorts|live)\/([^/?#]+)/)?.[1];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const id = parsed.pathname.match(/(\d+)/)?.[1];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

export function isHttpUrl(value?: string | null): boolean {
  return /^https?:\/\//i.test((value || '').trim());
}

export function isPdfUpload(file: File): boolean {
  const mime = (file.type || '').toLowerCase();
  return mime === 'application/pdf' || mime === 'application/x-pdf' || /\.pdf$/i.test(file.name);
}

export function isImageUpload(file: File): boolean {
  return (file.type || '').toLowerCase().startsWith('image/');
}

export function isVideoUpload(file: File): boolean {
  return (file.type || '').toLowerCase().startsWith('video/');
}

export function portfolioFileTooLargeMessage(file: File): string | null {
  if (isPdfUpload(file) && file.size > PORTFOLIO_PDF_MAX_MB * MB) {
    return 'This PDF is over 40MB. Compress it or upload a PDF of 40MB or less.';
  }
  if (!isPdfUpload(file) && file.size > PORTFOLIO_IMAGE_MAX_MB * MB) {
    return `This image is over ${PORTFOLIO_IMAGE_MAX_MB}MB. Use an image of ${PORTFOLIO_IMAGE_MAX_MB}MB or less.`;
  }
  return null;
}
