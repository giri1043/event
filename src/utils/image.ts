/**
 * Utility functions for parsing, converting, and validating event image URLs,
 * specifically handling Google Drive share links.
 */

export interface ParsedImageResult {
  url: string;
  isGoogleDrive: boolean;
  fileId?: string;
  originalUrl: string;
}

/**
 * Parses any raw image URL input and converts Google Drive share links
 * into direct browser-displayable image URLs (lh3.googleusercontent.com/d/FILE_ID).
 */
export function parseAndConvertImageUrl(rawUrl: string): ParsedImageResult {
  const originalUrl = (rawUrl || '').trim();
  if (!originalUrl) {
    return { url: '', isGoogleDrive: false, originalUrl: '' };
  }

  // Pattern 1: https://drive.google.com/file/d/FILE_ID/...
  const fileDMatch = originalUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileDMatch && fileDMatch[1]) {
    const fileId = fileDMatch[1];
    return {
      url: `https://lh3.googleusercontent.com/d/${fileId}`,
      isGoogleDrive: true,
      fileId,
      originalUrl
    };
  }

  // Pattern 2: https://drive.google.com/open?id=FILE_ID or uc?id=FILE_ID
  const idMatch = originalUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) {
    const fileId = idMatch[1];
    return {
      url: `https://lh3.googleusercontent.com/d/${fileId}`,
      isGoogleDrive: true,
      fileId,
      originalUrl
    };
  }

  // Pattern 3: Already googleusercontent CDN link
  if (originalUrl.includes('googleusercontent.com/d/')) {
    const parts = originalUrl.split('googleusercontent.com/d/')[1];
    const fileId = parts ? parts.split('?')[0].split('/')[0] : undefined;
    return {
      url: originalUrl,
      isGoogleDrive: true,
      fileId,
      originalUrl
    };
  }

  return {
    url: originalUrl,
    isGoogleDrive: false,
    originalUrl
  };
}

/**
 * Asynchronously tests if an image URL can be successfully loaded in the browser.
 * Returns a promise resolving to { valid: boolean, error?: string }.
 */
export function testImageLoad(url: string, isGoogleDrive: boolean): Promise<{ valid: boolean; error?: string }> {
  return new Promise((resolve) => {
    if (!url) {
      resolve({ valid: false, error: 'Please enter an image URL.' });
      return;
    }

    // Local upload URLs starting with /uploads/ are always trusted
    if (url.startsWith('/uploads/')) {
      resolve({ valid: true });
      return;
    }

    const img = new Image();
    let timer: any = null;

    img.onload = () => {
      clearTimeout(timer);
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        resolve({ valid: true });
      } else {
        resolve({
          valid: false,
          error: isGoogleDrive
            ? "Please make the Google Drive image accessible to anyone with the link."
            : "The provided link does not appear to be a valid image."
        });
      }
    };

    img.onerror = () => {
      clearTimeout(timer);
      resolve({
        valid: false,
        error: isGoogleDrive
          ? "Please make the Google Drive image accessible to anyone with the link (Set access to 'Anyone with the link' in Google Drive)."
          : "Unable to load image from URL. Please verify the URL points to a public image file."
      });
    };

    // 8 second timeout for slow external hosts
    timer = setTimeout(() => {
      img.src = '';
      resolve({
        valid: false,
        error: isGoogleDrive
          ? "Google Drive image load timed out. Please verify file sharing permission is set to 'Anyone with the link'."
          : "Image load timed out. Please check the image URL."
      });
    }, 8000);

    img.src = url;
  });
}
