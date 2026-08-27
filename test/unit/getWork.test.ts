/**
 * get_work, from the arguments a caller passes to the answer they read.
 *
 * The site is stubbed here, and what is exercised is everything above it: the
 * refusals, the redirect a title can hide, the threshold that hands a heavily
 * edited work over to another tool, and the notes that qualify an answer.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../../src/config.js";
import { ImslpClient } from "../../src/imslp/client.js";
import { getWorkInput, runGetWork } from "../../src/tools/getWork.js";
import type { ToolResult } from "../../src/tools/shared.js";

const FIXTURES = join(import.meta.dirname, "..", "fixtures");

function fixture(name: string): string {
  return readFileSync(join(FIXTURES, name), "utf8");
}

/** The envelope MediaWiki wraps a rendered page in. */
/**
 * The envelope MediaWiki wraps a rendered page in.
 *
 * IMSLP runs a version that states the title and the rendering and nothing
 * else: no page id and no revision come back with a parsed page.
 */
function rendered(title: string, name: string): Response {
  return new Response(JSON.stringify({ parse: { title, text: { "*": fixture(name) } } }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

interface Served {
  title: string;
  fixture: string;
}

/** A client answering each call with the next page of a script. */
function clientServing(pages: Served[]): { client: ImslpClient; asked: string[] } {
  const asked: string[] = [];
  const fetchImpl = vi.fn(async (url: string | URL | Request) => {
    asked.push(String(url));
    const page = pages[Math.min(asked.length - 1, pages.length - 1)];
    if (!page) {
      throw new Error("nothing left to serve");
    }
    return rendered(page.title, page.fixture);
  });

  return {
    asked,
    client: new ImslpClient({
      config: loadConfig({}),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    }),
  };
}

/** The notes of an answer, which is where an answer qualifies itself. */
function notesOf(result: ToolResult): string[] {
  return (result.structuredContent?.notes ?? []) as string[];
}

/** Run a call that waits on the pacing this client owes the site. */
async function withPacing<T>(work: Promise<T>): Promise<T> {
  vi.useFakeTimers();
  try {
    const settled = work;
    await vi.advanceTimersByTimeAsync(10_000);
    return await settled;
  } finally {
    vi.useRealTimers();
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe("reading a work", () => {
  it("answers with the facets the page states", async () => {
    const { client } = clientServing([
      {
        title: "Three Inventions (Aubertin, Mireille)",
        fixture: "work-full.html",
      },
    ]);

    const result = await runGetWork(client, { page: "Three Inventions (Aubertin, Mireille)" });

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({
      title: "Three Inventions",
      composer: "Aubertin, Mireille",
      opus_catalogue_number: "Op.12",
      editions_truncated: false,
      source: "IMSLP",
      license: "CC BY-SA 4.0",
    });
  });

  it("writes a text block that reads on its own", async () => {
    const { client } = clientServing([
      {
        title: "Three Inventions (Aubertin, Mireille)",
        fixture: "work-full.html",
      },
    ]);

    const result = await runGetWork(client, { page: "Three Inventions (Aubertin, Mireille)" });
    const text = result.content[0]?.text ?? "";

    expect(text).toContain("Three Inventions");
    expect(text).toContain("Aubertin, Mireille");
    expect(text).toContain("imslp.org/wiki/");
  });

  it("says where a copyright statement does not hold", async () => {
    const { client } = clientServing([
      {
        title: "Three Inventions (Aubertin, Mireille)",
        fixture: "work-full.html",
      },
    ]);

    const result = await runGetWork(client, { page: "Three Inventions (Aubertin, Mireille)" });
    expect(notesOf(result).join(" ")).toContain("Non-PD US");
  });

  it("reads a work by the page id a search hands back", async () => {
    const { client, asked } = clientServing([
      {
        title: "Three Inventions (Aubertin, Mireille)",
        fixture: "work-full.html",
      },
    ]);

    const result = await runGetWork(client, { pageid: 900_000 });

    expect(asked[0]).toContain("pageid=900000");
    expect(result.structuredContent).toMatchObject({ pageid: 900_000 });
  });
});

describe("a title that stands for another", () => {
  it("follows the redirect once and says which title was asked for", async () => {
    const { client, asked } = clientServing([
      {
        title: "Conseil inutile (Rebikov, Vladimir)",
        fixture: "work-redirect.html",
      },
      {
        title: "Trois inventions, Op.12 (Aubertin, Mireille)",
        fixture: "work-full.html",
      },
    ]);

    const result = await withPacing(
      runGetWork(client, { page: "Conseil inutile (Rebikov, Vladimir)" }),
    );

    expect(asked).toHaveLength(2);
    expect(result.structuredContent).toMatchObject({
      page_title: "Trois inventions, Op.12 (Aubertin, Mireille)",
      redirected_from: "Conseil inutile (Rebikov, Vladimir)",
    });
    expect(notesOf(result).join(" ")).toContain("redirect");
  });

  it("reports a redirect that leads to another redirect rather than following it", async () => {
    const { client } = clientServing([
      { title: "One (Composer)", fixture: "work-redirect.html" },
      { title: "Two (Composer)", fixture: "work-redirect.html" },
    ]);

    const result = await withPacing(runGetWork(client, { page: "One (Composer)" }));

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("[parse_failure]");
  });
});

describe("a work with more editions than one answer holds", () => {
  it("hands the editions over rather than cutting them silently", async () => {
    const { client } = clientServing([
      {
        title: "Six éditions (Nadaud, Camille)",
        fixture: "work-many-editions.html",
      },
    ]);

    const result = await runGetWork(client, { page: "Six éditions (Nadaud, Camille)" });

    expect(result.structuredContent).toMatchObject({
      editions: null,
      editions_truncated: true,
      sections: [{ name: "Scores", files: 6 }],
    });
    expect(notesOf(result).join(" ")).toContain("list_work_files");
  });
});

describe("what the tool refuses", () => {
  it("refuses a call naming neither a page nor a page id", async () => {
    const { client } = clientServing([
      {
        title: "Three Inventions (Aubertin, Mireille)",
        fixture: "work-full.html",
      },
    ]);

    const result = await runGetWork(client, {});

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("[invalid_input]");
  });

  it("refuses a call naming both", async () => {
    const { client } = clientServing([
      {
        title: "Three Inventions (Aubertin, Mireille)",
        fixture: "work-full.html",
      },
    ]);

    const result = await runGetWork(client, {
      page: "Three Inventions (Aubertin, Mireille)",
      pageid: 900_000,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("[invalid_input]");
  });

  it("refuses an argument it does not declare, and names it", () => {
    const refusal = getWorkInput.safeParse({ page: "A work (A composer)", titel: "typo" });

    expect(refusal.success).toBe(false);
    expect(refusal.error?.issues[0]?.message).toContain("[invalid_input]");
    expect(refusal.error?.issues[0]?.message).toContain("titel");
  });
});

describe("a work IMSLP does not hold", () => {
  it("reports a title the library states it does not have as an absence", async () => {
    const client = new ImslpClient({
      config: loadConfig({}),
      fetchImpl: (async () =>
        Response.json({
          error: { code: "missingtitle", info: "The page you specified doesn't exist" },
        })) as unknown as typeof fetch,
    });

    const result = await runGetWork(client, { page: "Gymnopédies (Satie, Erik)" });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("[not_found]");
    expect(result.content[0]?.text).toContain("Work (Composer)");
  });

  it("reports an absence as an absence", async () => {
    const client = new ImslpClient({
      config: loadConfig({}),
      fetchImpl: (async () => new Response("", { status: 404 })) as unknown as typeof fetch,
    });

    const result = await runGetWork(client, { page: "Nothing (Nobody)" });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("[not_found]");
  });
});
