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
 * (including /file/d/FILE_ID/view?usp=drive_link, open?id=FILE_ID, uc?id=FILE_ID)
 * into direct browser-displayable thumbnail URLs (https://drive.google.com/thumbnail?id=FILE_ID&sz=w2000).
 */
export function parseAndConvertImageUrl(rawUrl: string): ParsedImageResult {
  const originalUrl = (rawUrl || '').trim();
  if (!originalUrl) {
    return { url: '', isGoogleDrive: false, originalUrl: '' };
  }

  let fileId: string | undefined;

  // Pattern 1: https://drive.google.com/file/d/FILE_ID/...
  const fileDMatch = originalUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileDMatch && fileDMatch[1]) {
    fileId = fileDMatch[1];
  }

  // Pattern 2: https://drive.google.com/open?id=FILE_ID or uc?id=FILE_ID or thumbnail?id=FILE_ID
  if (!fileId) {
    const idMatch = originalUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idMatch && idMatch[1]) {
      fileId = idMatch[1];
    }
  }

  // Pattern 3: googleusercontent.com/d/FILE_ID
  if (!fileId && originalUrl.includes('googleusercontent.com/d/')) {
    const parts = originalUrl.split('googleusercontent.com/d/')[1];
    fileId = parts ? parts.split('?')[0].split('/')[0] : undefined;
  }

  if (fileId) {
    return {
      url: `https://drive.google.com/thumbnail?id=${fileId}&sz=w2000`,
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
            ? "Google Drive image is not publicly accessible. Please set General Access to Anyone with the link."
            : "The provided link does not appear to be a valid image."
        });
      }
    };

    img.onerror = () => {
      clearTimeout(timer);
      resolve({
        valid: false,
        error: isGoogleDrive
          ? "Google Drive image is not publicly accessible. Please set General Access to Anyone with the link."
          : "Unable to load image from URL. Please verify the URL points to a public image file."
      });
    };

    // 8 second timeout for slow external hosts
    timer = setTimeout(() => {
      img.src = '';
      resolve({
        valid: false,
        error: isGoogleDrive
          ? "Google Drive image is not publicly accessible. Please set General Access to Anyone with the link."
          : "Image load timed out. Please check the image URL."
      });
    }, 8000);

    img.src = url;
  });
}
