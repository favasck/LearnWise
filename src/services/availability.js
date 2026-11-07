export const SERVICE_UNAVAILABLE = 'Service temporarily unavailable. Please try again in a few minutes.';

export async function boundedOperation(operation, timeoutMs = 12000) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve(operation()),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(SERVICE_UNAVAILABLE)), timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
}

export function createResilientFetch(fetchImpl = globalThis.fetch, timeoutMs = 10000) {
  return async (input, options = {}) => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted) controller.abort();
    try {
      const response = await boundedOperation(() => fetchImpl(input, { ...options, signal: controller.signal }), timeoutMs);
      if (response.status < 500) {
        const body = await boundedOperation(() => response.arrayBuffer(), timeoutMs);
        return new Response([204, 205, 304].includes(response.status) ? null : body, { status: response.status, statusText: response.statusText, headers: response.headers });
      }
    } catch { /* Network failures have the same safe public message. */ }
    finally {
      controller.abort();
      options.signal?.removeEventListener('abort', abort);
    }
    // Non-retryable status also prevents the auth SDK from retrying indefinitely.
    return new Response(JSON.stringify({ message: SERVICE_UNAVAILABLE, code: 'service_unavailable' }), {
      status: 424, headers: { 'Content-Type': 'application/json' },
    });
  };
}

export async function safeServiceAction(operation, timeoutMs = 12000) {
  try { return await boundedOperation(operation, timeoutMs); }
  catch { return { data: null, error: { message: SERVICE_UNAVAILABLE } }; }
}
