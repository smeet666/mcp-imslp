/**
 * HTTP layer: one GET returning JSON, with backoff.
 *
 * Both endpoints this client reads answer in JSON, so the body is parsed here
 * and a body that is not JSON is a parse failure rather than a result: MediaWiki
 * answers an overloaded moment with an HTML error page under a 200, and reading
 * that as an empty query would report a work as absent.
 */

import type { Config, Logger } from "../config.js";
import { ImslpError, notFound, parseFailure, rateLimited, upstreamError } from "../errors.js";
import { type RateLimiter, sleep } from "./rateLimiter.js";
import { isImslpHost } from "./urls.js";

const BACKOFF_BASE_MS = 3000;
const BACKOFF_FACTOR = 2;
const BACKOFF_MAX_MS = 30_000;

/**
 * The most this client will read from one answer.
 *
 * The rendered page of a heavily edited work runs to about 900 kB, and the
 * listing endpoint serves a thousand entries at a time. Four megabytes leaves
 * room above both while keeping an answer that never ends from filling memory.
 */
const MAX_BODY_BYTES = 4_000_000;

/** Exponential backoff with jitter, so parallel clients do not resynchronise. */
export function backoffDelay(attempt: number, random: () => number = Math.random): number {
  const capped = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * BACKOFF_FACTOR ** attempt);
  return Math.round(capped * (0.5 + random() * 0.5));
}

export interface HttpDeps {
  config: Config;
  limiter: RateLimiter;
  logger: Logger;
  fetchImpl: typeof fetch;
  /**
   * The caller's own signal, when the host gave one.
   *
   * A host that abandons a call stops waiting for the answer, and without this
   * the retries keep going: a library run on donations would be asked again for
   * a page nobody reads any more.
   */
  signal?: AbortSignal;
}

/**
 * The pause owed before one attempt, and the two moments a caller can have gone.
 *
 * A caller that stopped waiting is not owed another request, and the site is not
 * owed one either. That is checked before the wait and again after it, because a
 * backoff can be seconds long and the answer would be thrown away regardless.
 */
async function waitBeforeAttempt(
  attempt: number,
  askedWaitMs: number | null,
  context: { url: string; deps: HttpDeps; abandoned: () => boolean },
): Promise<void> {
  const { url, deps, abandoned } = context;
  if (abandoned()) {
    throw givenUp(url);
  }
  if (attempt === 0) {
    return;
  }

  const delay = Math.min(askedWaitMs ?? backoffDelay(attempt - 1), BACKOFF_MAX_MS);
  deps.logger.info(`retry ${attempt}/${deps.config.maxRetries} in ${delay}ms for ${url}`);
  await sleep(delay);

  if (abandoned()) {
    throw givenUp(url);
  }
}

/** One exchange with the site, as it came back. */
interface Exchange {
  status: number;
  body: string;
  finalUrl: string;
  retryAfterMs: number | null;
}

/**
 * Ask once, and read what came back.
 *
 * The pacing claim sits here, before the request, so every attempt of a retry
 * chain claims its own slot: the chain runs inside one queue slot, and the
 * claim is the only thing keeping its attempts apart.
 */
async function fetchOnce(url: string, deps: HttpDeps, doFetch: typeof fetch): Promise<Exchange> {
  const { config, limiter } = deps;
  await limiter.beforeRequest();

  const response = await doFetch(url, {
    headers: {
      "User-Agent": config.userAgent,
      Accept: "application/json,*/*;q=0.8",
    },
    redirect: "follow",
    // Whichever comes first: the caller giving up, or this client's own
    // patience running out.
    signal: deps.signal
      ? AbortSignal.any([deps.signal, AbortSignal.timeout(config.timeoutMs)])
      : AbortSignal.timeout(config.timeoutMs),
  });

  return {
    status: response.status,
    // A stub may leave `url` empty, which is not an address to report.
    finalUrl: response.url || url,
    retryAfterMs: parseRetryAfter(response.headers.get("retry-after")),
    body: new TextDecoder("utf-8").decode(await readBounded(response, url)),
  };
}

/**
 * What one answer from the site amounts to.
 *
 * Three outcomes and no fourth: the body is usable, the address holds nothing or
 * the site refuses outright, or it is asking to be left alone for a while.
 */
type Answer =
  | { kind: "usable" }
  | { kind: "refused"; error: ImslpError }
  | {
      kind: "again";
      error: ImslpError;
      waitMs: number | null;
      penalise: boolean;
      because: string;
    };

function readAnswer(
  url: string,
  status: number,
  retryAfterMs: number | null,
  ownGuessMs: number,
): Answer {
  if (status === 429 || status === 503) {
    return {
      kind: "again",
      error: rateLimited(url, retryAfterMs ?? ownGuessMs),
      waitMs: retryAfterMs,
      penalise: true,
      because: "rate limited",
    };
  }

  // A 403 refuses rather than asking for patience: three more requests would be
  // three more refusals.
  if (status === 403) {
    return {
      kind: "refused",
      error: new ImslpError("rate_limited", `IMSLP refused to serve ${url}.`, {
        url,
        status,
        hint: "The site declined this request rather than asking to slow down.",
      }),
    };
  }
  if (status === 404) {
    return { kind: "refused", error: notFound(url, "that address") };
  }
  if (status >= 500) {
    return {
      kind: "again",
      error: upstreamError(url, status),
      waitMs: null,
      penalise: false,
      because: `status ${status}`,
    };
  }
  if (status >= 400) {
    return { kind: "refused", error: upstreamError(url, status) };
  }

  return { kind: "usable" };
}

/**
 * Fetch one address and parse its JSON, retrying transient conditions.
 *
 * The retry loop and its sleeps run inside a single limiter slot, so a queued
 * request cannot slip into the window the current one is backing away from.
 */
export async function fetchJson<T>(url: string, deps: HttpDeps): Promise<T> {
  const { config, limiter, logger } = deps;
  const doFetch = deps.fetchImpl;
  const abandoned = () => deps.signal?.aborted === true;

  return await limiter.schedule(async () => {
    // What is reported when every attempt has failed. It is replaced by each
    // attempt that fails in a way worth naming, and a loop that ended without
    // naming one still has something to answer with.
    let lastError = new ImslpError("network_error", `Could not fetch ${url}.`, { url });

    // Set when the site says how long to stay away; it replaces our own guess
    // for the next attempt. Applied here rather than where it is read, so no
    // wait is ever served after the last attempt, when nobody would use it.
    let askedWaitMs: number | null = null;

    for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
      await waitBeforeAttempt(attempt, askedWaitMs, { url, deps, abandoned });
      askedWaitMs = null;

      let answer: Exchange;
      try {
        answer = await fetchOnce(url, deps, doFetch);
      } catch (error) {
        lastError = asTransportError(error, url);
        logger.debug(`${lastError.code} for ${url}: ${lastError.message}`);
        continue;
      }
      const { status, body, finalUrl, retryAfterMs } = answer;

      // Redirects are followed, so the address the request ended at is the one
      // the body came from. A body read from anywhere else would enter an
      // answer that names IMSLP as its source. Asking again would land in the
      // same place, so this ends the read.
      if (!isImslpHost(finalUrl)) {
        throw parseFailure(url, `an address off the site, ${finalUrl}`);
      }

      const verdict = readAnswer(url, status, retryAfterMs, backoffDelay(attempt));
      if (verdict.kind === "refused") {
        throw verdict.error;
      }
      if (verdict.kind === "again") {
        if (verdict.penalise) {
          limiter.penalize();
          logger.info(`${verdict.because} on ${url}, interval now ${limiter.currentIntervalMs}ms`);
        }
        // A server that says when to come back knows better than our own guess.
        askedWaitMs = verdict.waitMs;
        lastError = verdict.error;
        continue;
      }

      limiter.relax();
      return parseBody<T>(body, url);
    }

    throw lastError;
  });
}

/**
 * The JSON of an answer, or a parse failure naming what arrived instead.
 *
 * MediaWiki answers some overloaded moments with an HTML page under a 200, and
 * a body that is not JSON is exactly that case: it is reported rather than
 * turned into an empty result.
 */
function parseBody<T>(body: string, url: string): T {
  try {
    return JSON.parse(body) as T;
  } catch {
    return failOnBody(body, url);
  }
}

function failOnBody(body: string, url: string): never {
  const opening = body.trim().slice(0, 40);
  throw parseFailure(url, `an answer that is not JSON, opening with "${opening}"`);
}

/**
 * The body, refused past a size no answer of this site reaches.
 *
 * Reading in chunks rather than in one call is what makes the limit a limit: an
 * answer that never ends is dropped at the threshold instead of being held
 * whole first and measured after.
 */
async function readBounded(response: Response, url: string): Promise<Uint8Array> {
  const announced = Number(response.headers.get("content-length") ?? "");
  if (Number.isFinite(announced) && announced > MAX_BODY_BYTES) {
    throw parseFailure(url, `an answer of ${announced} bytes, past what this client reads`);
  }

  if (!response.body) {
    return new Uint8Array(await response.arrayBuffer());
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let read = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      read += value.byteLength;
      if (read > MAX_BODY_BYTES) {
        throw parseFailure(url, `an answer past the ${MAX_BODY_BYTES} bytes this client reads`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(read);
  let at = 0;
  for (const chunk of chunks) {
    body.set(chunk, at);
    at += chunk.byteLength;
  }
  return body;
}

/** The read the caller stopped waiting for. */
export function givenUp(url: string): ImslpError {
  return new ImslpError("timeout", `The call was abandoned before ${url} was read.`, {
    url,
    hint: "Nothing further was asked of the site.",
  });
}

/** `Retry-After` carries either seconds or an HTTP date. */
function parseRetryAfter(raw: string | null): number | null {
  if (!raw) {
    return null;
  }
  const seconds = Number(raw.trim());
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }
  const when = Date.parse(raw);
  if (Number.isNaN(when)) {
    return null;
  }
  return Math.max(0, when - Date.now());
}

function asTransportError(error: unknown, url: string): ImslpError {
  if (error instanceof ImslpError) {
    return error;
  }
  const name = error instanceof Error ? error.name : "";
  if (name === "TimeoutError" || name === "AbortError") {
    return new ImslpError("timeout", "IMSLP did not answer in time.", {
      url,
      hint: "Raise IMSLP_TIMEOUT_MS if this happens often on a slow connection.",
    });
  }
  const message = error instanceof Error ? error.message : String(error);
  return new ImslpError("network_error", `Could not reach IMSLP: ${message}`, { url });
}
