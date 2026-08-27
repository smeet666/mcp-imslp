/**
 * The client above the transport: the cache, the reads that join, and what a
 * caller walking away does to a read someone else is still waiting on.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../../src/config.js";
import type { ImslpError } from "../../src/errors.js";
import { ImslpClient } from "../../src/imslp/client.js";
import { MIN_ALLOWED_INTERVAL_MS } from "../../src/config.js";

const FIXTURES = join(import.meta.dirname, "..", "fixtures");

function envelope(title: string, fixture: string): Response {
  return Response.json({
    parse: { title, text: { "*": readFileSync(join(FIXTURES, fixture), "utf8") } },
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("reading the same page twice", () => {
  it("asks the site once and says the second answer was held", async () => {
    const fetchImpl = vi.fn(async () =>
      envelope("Three Inventions (Aubertin, Mireille)", "work-full.html"),
    );
    const client = new ImslpClient({
      config: loadConfig({}),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const first = await client.getWork({ page: "Three Inventions (Aubertin, Mireille)" });
    const second = await client.getWork({ page: "Three Inventions (Aubertin, Mireille)" });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
  });

  it("joins a read already under way rather than asking twice", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Promise<Response>((resolve) => {
          setTimeout(() => resolve(envelope("A work (A composer)", "work-sparse.html")), 10);
        }),
    );
    const client = new ImslpClient({
      config: loadConfig({}),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const [one, two] = await Promise.all([
      client.renderPage({ page: "A work (A composer)" }),
      client.renderPage({ page: "A work (A composer)" }),
    ]);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(one.data.title).toBe("A work (A composer)");
    expect(two.data.title).toBe("A work (A composer)");
  });
});

describe("a caller who stopped waiting", () => {
  it("is answered with an abandoned read, with nothing asked of the site", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn(async () => envelope("A work (A composer)", "work-sparse.html"));
    const client = new ImslpClient({
      config: loadConfig({}),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(
      client.renderPage({ page: "A work (A composer)" }, controller.signal),
    ).rejects.toMatchObject({ code: "timeout" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("leaves a read running for whoever else joined it", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const fetchImpl = vi.fn(
      async () =>
        new Promise<Response>((resolve) => {
          setTimeout(() => resolve(envelope("A work (A composer)", "work-sparse.html")), 50);
        }),
    );
    const client = new ImslpClient({
      config: loadConfig({}),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const leaving = client.renderPage({ page: "A work (A composer)" }, controller.signal).then(
      () => null,
      (error: unknown) => error as ImslpError,
    );
    const staying = client.renderPage({ page: "A work (A composer)" });
    controller.abort();
    await vi.advanceTimersByTimeAsync(100);

    expect((await leaving)?.code).toBe("timeout");
    expect((await staying).data.title).toBe("A work (A composer)");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("a page IMSLP does not hold", () => {
  it("reads a missing title as an absence rather than as an unreadable answer", async () => {
    // The API states this under HTTP 200, so an absence is only ever visible in
    // the payload: read as a failure to parse, it would send someone to report
    // a defect over a work the library simply does not have.
    const client = new ImslpClient({
      config: loadConfig({}),
      fetchImpl: (async () =>
        Response.json({
          error: { code: "missingtitle", info: "The page you specified doesn't exist" },
        })) as unknown as typeof fetch,
    });

    await expect(client.renderPage({ page: "Nothing (Nobody)" })).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("reads a page id nobody holds the same way", async () => {
    const client = new ImslpClient({
      config: loadConfig({}),
      fetchImpl: (async () =>
        Response.json({
          error: { code: "nosuchpageid", info: "There is no page with ID 999999999" },
        })) as unknown as typeof fetch,
    });

    await expect(client.renderPage({ pageid: 999_999_999 })).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("names an error of the API it does not know rather than guessing at it", async () => {
    const client = new ImslpClient({
      config: loadConfig({}),
      fetchImpl: (async () =>
        Response.json({
          error: { code: "readapidenied", info: "Read access denied" },
        })) as unknown as typeof fetch,
    });

    await expect(client.renderPage({ pageid: 1 })).rejects.toMatchObject({
      code: "parse_failure",
      message: expect.stringContaining("readapidenied"),
    });
  });
});

describe("an error the API states without naming", () => {
  it("says so rather than reporting a code nobody sent", async () => {
    const client = new ImslpClient({
      config: loadConfig({}),
      fetchImpl: (async () =>
        Response.json({ error: { info: "Something went wrong" } })) as unknown as typeof fetch,
    });

    await expect(client.renderPage({ pageid: 1 })).rejects.toMatchObject({
      code: "parse_failure",
      message: expect.stringContaining("did not name"),
    });
  });
});

describe("an answer that is not a rendered page", () => {
  it("reports the shape rather than an empty work", async () => {
    const client = new ImslpClient({
      config: loadConfig({}),
      fetchImpl: (async () => Response.json({ parse: {} })) as unknown as typeof fetch,
    });

    await expect(client.renderPage({ pageid: 12 })).rejects.toMatchObject({
      code: "parse_failure",
    });
  });
});

describe("the guarantees this client keeps whoever built it", () => {
  it("paces at the floor even when handed a config below it", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      envelope("A work (A composer)", "work-sparse.html"),
    );
    const client = new ImslpClient({
      config: { ...loadConfig({}), minIntervalMs: 1, userAgent: "someone-else/1.0" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await client.renderPage({ page: "A work (A composer)" });
    const headers = fetchImpl.mock.calls[0]?.[1]?.headers as Record<string, string> | undefined;

    expect(headers?.["User-Agent"]).toContain("someone-else/1.0");
    expect(headers?.["User-Agent"]).toContain("mcp-imslp");
    expect(MIN_ALLOWED_INTERVAL_MS).toBe(2000);
  });

  it("reads the environment when it is handed nothing", () => {
    expect(() => new ImslpClient()).not.toThrow();
  });
});
