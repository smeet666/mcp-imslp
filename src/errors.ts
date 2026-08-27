/**
 * Error taxonomy surfaced to the calling model.
 *
 * A failure must never be reported as an empty result. A model that sees "no
 * work found" cannot tell that apart from a genuine absence, and will
 * confidently tell the user that IMSLP does not hold the score.
 */

export type ErrorCode =
  | "not_found"
  | "invalid_input"
  | "rate_limited"
  | "parse_failure"
  | "network_error"
  | "timeout";

export interface ErrorDetails {
  url?: string;
  status?: number;
  retryAfterMs?: number;
  hint?: string;
}

export class ImslpError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details: ErrorDetails = {},
  ) {
    super(message);
    this.name = "ImslpError";
  }
}

const ISSUES_URL = "https://github.com/smeet666/mcp-imslp/issues";

export function notFound(url: string, what: string): ImslpError {
  return new ImslpError("not_found", `IMSLP has nothing at ${what}.`, {
    url,
    status: 404,
    hint: "Titles are written 'Work (Composer)', for example 'Nocturnes, Op.9 (Chopin, Frédéric)'.",
  });
}

export function invalidInput(message: string, hint?: string): ImslpError {
  return new ImslpError("invalid_input", message, hint ? { hint } : {});
}

export function rateLimited(url: string, retryAfterMs: number): ImslpError {
  return new ImslpError(
    "rate_limited",
    "IMSLP is rate limiting this client. This does NOT mean the work is absent from the library.",
    {
      url,
      retryAfterMs,
      hint:
        `Wait about ${Math.ceil(retryAfterMs / 1000)} seconds, then call the same tool again with ` +
        "the same arguments. If it keeps happening, raise IMSLP_MIN_INTERVAL_MS.",
    },
  );
}

export function parseFailure(url: string, what: string): ImslpError {
  return new ImslpError(
    "parse_failure",
    `The page loaded but the expected content was not found (${what}). ` +
      "IMSLP may have changed how it publishes it.",
    { url, hint: `Please report this, with what you asked for, at ${ISSUES_URL}` },
  );
}

export function upstreamError(url: string, status: number): ImslpError {
  return new ImslpError("network_error", `IMSLP returned HTTP ${status}.`, {
    url,
    status,
    ...(status >= 500 ? { hint: "This is a problem on the IMSLP side. Try again shortly." } : {}),
  });
}
