import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase-types";

const SUPABASE_REQUEST_TIMEOUT_MS = 4_000;
const SUPABASE_READ_RETRIES = 1;
const RETRYABLE_STATUS_CODES = new Set([408, 429, 502, 503, 504]);

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function getRequestMethod(input: RequestInfo | URL, init?: RequestInit) {
  if (init?.method) {
    return init.method.toUpperCase();
  }

  if (typeof Request !== "undefined" && input instanceof Request) {
    return input.method.toUpperCase();
  }

  return "GET";
}

function createResilientFetch(): typeof fetch {
  return async (input, init) => {
    const method = getRequestMethod(input, init);
    const canRetry = method === "GET" || method === "HEAD";
    const maxAttempts = canRetry ? SUPABASE_READ_RETRIES + 1 : 1;
    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const upstreamSignal = init?.signal;
      const forwardAbort = () => controller.abort(upstreamSignal?.reason);
      const timeoutId = setTimeout(() => {
        controller.abort(new DOMException("Supabase request timed out", "TimeoutError"));
      }, SUPABASE_REQUEST_TIMEOUT_MS);

      if (upstreamSignal?.aborted) {
        clearTimeout(timeoutId);
        throw upstreamSignal.reason ?? new DOMException("Request aborted", "AbortError");
      }

      upstreamSignal?.addEventListener("abort", forwardAbort, { once: true });

      try {
        const response = await fetch(input, {
          ...init,
          signal: controller.signal,
        });

        if (attempt + 1 < maxAttempts && RETRYABLE_STATUS_CODES.has(response.status)) {
          await response.body?.cancel().catch(() => undefined);
          await sleep(125 * (attempt + 1));
          continue;
        }

        return response;
      } catch (error) {
        lastError = error;

        if (upstreamSignal?.aborted || attempt + 1 >= maxAttempts) {
          throw error;
        }

        await sleep(125 * (attempt + 1));
      } finally {
        clearTimeout(timeoutId);
        upstreamSignal?.removeEventListener("abort", forwardAbort);
      }
    }

    throw lastError ?? new Error("Supabase request failed");
  };
}

const resilientFetch = createResilientFetch();

export function createServiceSupabaseClient(supabaseUrl: string, secretKey: string) {
  return createClient<Database>(supabaseUrl, secretKey, {
    global: {
      fetch: resilientFetch,
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function createBrowserSupabaseClient(
  supabaseUrl: string,
  publishableKey: string,
  getAccessToken: () => Promise<string>,
) {
  return createClient<Database>(supabaseUrl, publishableKey, {
    accessToken: getAccessToken,
    global: {
      fetch: resilientFetch,
    },
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
