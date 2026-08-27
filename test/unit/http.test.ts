/**
 * What one exchange with the site amounts to.
 *
 * Every case here is a way an answer can fail to be a result: a body that is
 * not JSON, an address that left the site, a refusal, a request to slow down.
 * None of them may reach a caller as an empty answer.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../../src/config.js";
import { createLogger } from "../../src/config.js";
import { ImslpError } from "../../src/errors.js";
import { backoffDelay, fetchJson, givenUp } from "../../src/imslp/http.js";
import { RateLimiter } from "../../src/imslp/rateLimiter.js";

const URL_UNDER_TEST = "https://imslp.org/api.php?format=json";

function deps(fetchImpl: typeof fetch, overrides: Partial<ReturnType<typeof loadConfig>> = {}) {
  return {
    config: { ...loadConfig({}), maxRetries: 0, ...overrides },
    limiter: new RateLimiter({ minIntervalMs: 0 }),
    logger: createLogger("silent"),
    fetchImpl,
  };
}

function serving(body: string, init: ResponseInit = {}): typeof fetch {
  return (async () =>
    new Response(body, {
      status: 200,
      headers: { "content-type": "application/json" },
      ...init,
    })) as unknown as typeof fetch;
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return (error as ImslpError).code;
  }
  throw new Error("the call was expected to fail");
}

afterEach(() => {
  vi.useRealTimers();
});

describe("an answer this client can use", () => {
  it("hands back the JSON it was served", async () => {
    const payload = await fetchJson<{ ok: boolean }>(URL_UNDER_TEST, deps(serving('{"ok":true}')));

    expect(payload).toEqual({ ok: true });
  });
});

describe("an answer this client cannot use", () => {
  it("reports a body that is not JSON rather than an empty result", async () => {
    // MediaWiki answers an overloaded moment with an HTML page under a 200,
    // and reading that as an empty query would report a work as absent.
    const failing = fetchJson(URL_UNDER_TEST, deps(serving("<html>busy</html>")));

    expect(await codeOf(failing)).toBe("parse_failure");
  });

  it("refuses a body read from anywhere but the site", async () => {
    const elsewhere = (async () =>
      Object.defineProperty(new Response("{}"), "url", {
        value: "https://example.invalid/",
      })) as unknown as typeof fetch;

    expect(await codeOf(fetchJson(URL_UNDER_TEST, deps(elsewhere)))).toBe("parse_failure");
  });

  it("refuses an answer larger than any this site serves", async () => {
    const huge = serving("{}", { headers: { "content-length": "9000000" } });

    expect(await codeOf(fetchJson(URL_UNDER_TEST, deps(huge)))).toBe("parse_failure");
  });

  it("stops reading a body that does not end", async () => {
    const chunk = new Uint8Array(1_000_000);
    const endless = (async () =>
      new Response(
        new ReadableStream({
          pull(controller) {
            controller.enqueue(chunk);
          },
        }),
      )) as unknown as typeof fetch;

    expect(await codeOf(fetchJson(URL_UNDER_TEST, deps(endless)))).toBe("parse_failure");
  });

  it("reads a body served without a stream", async () => {
    const bodiless = (async () => Response.json({ ok: 1 })) as unknown as typeof fetch;
    const response = await fetchJson<{ ok: number }>(URL_UNDER_TEST, deps(bodiless));

    expect(response.ok).toBe(1);
  });
});

describe("what the site's status says", () => {
  it("reads a 404 as an absence", async () => {
    expect(await codeOf(fetchJson(URL_UNDER_TEST, deps(serving("", { status: 404 }))))).toBe(
      "not_found",
    );
  });

  it("reads a 403 as a refusal rather than as patience", async () => {
    expect(await codeOf(fetchJson(URL_UNDER_TEST, deps(serving("", { status: 403 }))))).toBe(
      "rate_limited",
    );
  });

  it("reads any other 4xx as an error from the site", async () => {
    expect(await codeOf(fetchJson(URL_UNDER_TEST, deps(serving("", { status: 400 }))))).toBe(
      "network_error",
    );
  });

  it("reads a 5xx as worth another attempt", async () => {
    expect(await codeOf(fetchJson(URL_UNDER_TEST, deps(serving("", { status: 500 }))))).toBe(
      "network_error",
    );
  });

  it("reads a 429 as a request to slow down, never as an absence", async () => {
    const limited = serving("", { status: 429, headers: { "retry-after": "2" } });

    const failing = fetchJson(URL_UNDER_TEST, deps(limited));

    expect(await codeOf(failing)).toBe("rate_limited");
  });
});

describe("trying again", () => {
  it("answers on a second attempt after a transient failure", async () => {
    vi.useFakeTimers();
    let attempts = 0;
    const flaky = (async () => {
      attempts += 1;
      return attempts === 1 ? new Response("", { status: 503 }) : Response.json({ ok: true });
    }) as unknown as typeof fetch;

    const payload = fetchJson<{ ok: boolean }>(URL_UNDER_TEST, deps(flaky, { maxRetries: 2 }));
    await vi.advanceTimersByTimeAsync(60_000);

    await expect(payload).resolves.toEqual({ ok: true });
    expect(attempts).toBe(2);
  });

  it("waits as long as the site asked rather than guessing", async () => {
    vi.useFakeTimers();
    const asked = new Date("2026-01-01T00:00:05Z").toUTCString();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    let attempts = 0;
    const flaky = (async () => {
      attempts += 1;
      return attempts === 1
        ? new Response("", { status: 429, headers: { "retry-after": asked } })
        : Response.json({ ok: true });
    }) as unknown as typeof fetch;

    const payload = fetchJson(URL_UNDER_TEST, deps(flaky, { maxRetries: 1 }));
    await vi.advanceTimersByTimeAsync(30_000);

    await expect(payload).resolves.toEqual({ ok: true });
  });

  it("ignores a retry-after that names no time", async () => {
    vi.useFakeTimers();
    let attempts = 0;
    const flaky = (async () => {
      attempts += 1;
      return attempts === 1
        ? new Response("", { status: 503, headers: { "retry-after": "soon" } })
        : Response.json({ ok: true });
    }) as unknown as typeof fetch;

    const payload = fetchJson(URL_UNDER_TEST, deps(flaky, { maxRetries: 1 }));
    await vi.advanceTimersByTimeAsync(60_000);

    await expect(payload).resolves.toEqual({ ok: true });
  });

  it("reports a transport failure in this client's own vocabulary", async () => {
    const broken = (async () => {
      throw new Error("socket closed");
    }) as unknown as typeof fetch;

    expect(await codeOf(fetchJson(URL_UNDER_TEST, deps(broken)))).toBe("network_error");
  });

  it("reports a deadline as a timeout", async () => {
    const slow = (async () => {
      const error = new Error("too slow");
      error.name = "TimeoutError";
      throw error;
    }) as unknown as typeof fetch;

    expect(await codeOf(fetchJson(URL_UNDER_TEST, deps(slow)))).toBe("timeout");
  });

  it("keeps an error of its own rather than wrapping it twice", async () => {
    const refusing = (async () => {
      throw new ImslpError("invalid_input", "no");
    }) as unknown as typeof fetch;

    expect(await codeOf(fetchJson(URL_UNDER_TEST, deps(refusing)))).toBe("invalid_input");
  });
});

describe("a caller who stopped waiting", () => {
  it("is owed no request at all", async () => {
    const controller = new AbortController();
    controller.abort();
    const never = (async () => {
      throw new Error("this should not be reached");
    }) as unknown as typeof fetch;

    const failing = fetchJson(URL_UNDER_TEST, { ...deps(never), signal: controller.signal });

    expect(await codeOf(failing)).toBe("timeout");
  });

  it("stops the retries once they have started", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const flaky = (async () => new Response("", { status: 503 })) as unknown as typeof fetch;

    // The outcome is captured as the call is made rather than after the clock
    // has been driven: a rejection nobody is waiting on yet is reported by the
    // runner as an error of the suite.
    const outcome = fetchJson(URL_UNDER_TEST, {
      ...deps(flaky, { maxRetries: 3 }),
      signal: controller.signal,
    }).then(
      () => null,
      (error: unknown) => error as ImslpError,
    );
    await vi.advanceTimersByTimeAsync(100);
    controller.abort();
    await vi.advanceTimersByTimeAsync(60_000);

    expect((await outcome)?.code).toBe("timeout");
  });

  it("names the read that was abandoned", () => {
    expect(givenUp(URL_UNDER_TEST).code).toBe("timeout");
  });
});

describe("backing off", () => {
  it("grows with each attempt and stays under the ceiling", () => {
    expect(backoffDelay(0, () => 0)).toBe(1500);
    expect(backoffDelay(1, () => 1)).toBe(6000);
    expect(backoffDelay(10, () => 1)).toBe(30_000);
  });
});
