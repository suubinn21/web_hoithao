/**
 * Resilient HTTP JSON helper with AbortController timeout and weak-network classification.
 */

export interface FetchJsonResult<T = Record<string, unknown>> {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
  isNetworkError: boolean;
  isTimeout: boolean;
}

export interface FetchJsonOptions extends RequestInit {
  timeoutMs?: number;
}

/**
 * Fetches JSON with an explicit timeout and graceful fallback when response body is HTML/empty.
 */
export async function fetchJsonWithTimeout<T = Record<string, unknown>>(
  url: string,
  options: FetchJsonOptions = {}
): Promise<FetchJsonResult<T>> {
  const { timeoutMs = 10000, signal: externalSignal, ...fetchInit } = options;

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: 'Thiết bị đang mất kết nối mạng (Offline).',
      isNetworkError: true,
      isTimeout: false,
    };
  }

  const controller = new AbortController();
  let timedOut = false;

  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const res = await fetch(url, {
      ...fetchInit,
      signal: controller.signal,
    });

    const rawText = await res.text();
    let parsed: T | null = null;
    if (rawText.trim() !== '') {
      try {
        parsed = JSON.parse(rawText) as T;
      } catch {
        parsed = null;
      }
    }

    const parsedRecord = parsed as Record<string, unknown> | null;
    const serverError =
      parsedRecord && typeof parsedRecord.error === 'string' && parsedRecord.error.trim() !== ''
        ? parsedRecord.error
        : undefined;

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        data: parsed,
        error: serverError || `Máy chủ phản hồi lỗi HTTP ${res.status}.`,
        isNetworkError: false,
        isTimeout: false,
      };
    }

    if (parsed === null) {
      return {
        ok: false,
        status: res.status,
        data: null,
        error: 'Phản hồi từ máy chủ không đúng định dạng JSON (có thể mạng chập chờn hoặc hosting quá tải).',
        isNetworkError: false,
        isTimeout: false,
      };
    }

    return {
      ok: true,
      status: res.status,
      data: parsed,
      isNetworkError: false,
      isTimeout: false,
    };
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    if (isAbort && timedOut) {
      return {
        ok: false,
        status: 0,
        data: null,
        error: 'Kết nối quá chậm (hết thời gian chờ), hệ thống sẽ tự thử lại.',
        isNetworkError: true,
        isTimeout: true,
      };
    }
    return {
      ok: false,
      status: 0,
      data: null,
      error: 'Không thể kết nối tới máy chủ (mạng yếu hoặc mất sóng).',
      isNetworkError: true,
      isTimeout: false,
    };
  } finally {
    clearTimeout(timeoutId);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}

export function isRetryableFailure(res: FetchJsonResult<unknown>): boolean {
  if (res.isNetworkError || res.isTimeout || res.status === 0) return true;
  return res.status === 408 || res.status === 429 || res.status >= 500;
}
