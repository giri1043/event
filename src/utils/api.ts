/**
 * Safe Frontend API Client for Digital Invitation Application.
 * Prevents "Unexpected token 'A' ... is not valid JSON" crashes by checking
 * HTTP status codes and Content-Type before parsing JSON.
 */

export async function apiRequest<T = any>(
  url: string,
  options?: RequestInit
): Promise<T> {
  let res: Response;

  try {
    res = await fetch(url, options);
  } catch (netErr: any) {
    throw new Error(`Network Error: ${netErr.message || 'Failed to connect to server. Please check your internet connection.'}`);
  }

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.toLowerCase().includes('application/json');

  let data: any = null;

  if (isJson) {
    try {
      data = await res.json();
    } catch (parseErr) {
      data = null;
    }
  } else {
    // Non-JSON response (e.g. Vercel 500 HTML or plain text error page)
    const rawText = await res.text().catch(() => '');
    if (!res.ok) {
      // Strip HTML tags for clean error message display
      const cleanText = rawText.replace(/<[^>]*>/g, '').trim().replace(/\s+/g, ' ').slice(0, 200);
      throw new Error(`Server Error (${res.status}): ${cleanText || res.statusText || 'A server error occurred'}`);
    }
  }

  if (!res.ok) {
    const errorMsg =
      data?.error ||
      data?.message ||
      (typeof data === 'string' ? data : null) ||
      `Request failed with status ${res.status}`;
    throw new Error(errorMsg);
  }

  return data as T;
}
