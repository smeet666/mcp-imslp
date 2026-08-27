/**
 * list_person_works and browse_category, which both read a category.
 *
 * The library files a work under its composer and under every genre, key and
 * instrumentation it belongs to, so one route answers "what did this person
 * write" and "what is written for this instrument". Neither can say how many
 * members a category holds: the API publishes no count, and it hands back an
 * opaque cursor instead of an offset.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { loadConfig } from "../../src/config.js";
import { ImslpClient } from "../../src/imslp/client.js";
import { browseCategoryInput, runBrowseCategory } from "../../src/tools/browseCategory.js";
import { listPersonWorksInput, runListPersonWorks } from "../../src/tools/listPersonWorks.js";
import type { ToolResult } from "../../src/tools/shared.js";

const FIXTURES = join(import.meta.dirname, "..", "fixtures");

function clientServing(name: string): { client: ImslpClient; asked: string[] } {
  const asked: string[] = [];
  const fetchImpl = vi.fn(async (url: string | URL | Request) => {
    asked.push(String(url));
    return Response.json(JSON.parse(readFileSync(join(FIXTURES, name), "utf8")));
  });
  return {
    asked,
    client: new ImslpClient({
      config: loadConfig({}),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    }),
  };
}

function structured(result: ToolResult): Record<string, unknown> {
  return (result.structuredContent ?? {}) as Record<string, unknown>;
}

function notesOf(result: ToolResult): string[] {
  return (structured(result).notes ?? []) as string[];
}

describe("the works of a person", () => {
  it("reads the pages filed under their category", async () => {
    const { client, asked } = clientServing("category-members.json");

    const result = await runListPersonWorks(client, { category: "Category:Nadaud, Camille" });
    const rows = structured(result).results as Record<string, unknown>[];

    expect(asked[0]).toContain("list=categorymembers");
    expect(asked[0]).toContain("cmnamespace=0");
    expect(rows[0]).toMatchObject({
      page: "Three Inventions (Aubertin, Mireille)",
      work: "Three Inventions",
      pageid: 900_000,
      page_url: "https://imslp.org/wiki/Three_Inventions_(Aubertin,_Mireille)",
    });
  });

  it("takes a name written without its prefix as the category it names", async () => {
    const { client, asked } = clientServing("category-members.json");

    await runListPersonWorks(client, { category: "Nadaud, Camille" });

    expect(asked[0]).toContain("cmtitle=Category%3ANadaud%2C+Camille");
  });

  it("hands back the cursor the library named, and never a count", async () => {
    // The API answers a listing with an opaque cursor and no total, so an
    // answer stating how many works a person wrote would be an invention.
    const { client } = clientServing("category-members.json");

    const result = await runListPersonWorks(client, { category: "Category:Nadaud, Camille" });

    expect(structured(result)).toMatchObject({
      returned: 3,
      has_more: true,
      total: null,
    });
    expect(structured(result).cursor).toBe("page|54485245457e7e4155424552544954");
    expect(notesOf(result).join(" ")).toContain("publishes no count");
  });

  it("says a listing ended when the library named no cursor", async () => {
    const { client } = clientServing("category-last-page.json");

    const result = await runListPersonWorks(client, { category: "Category:Nadaud, Camille" });

    expect(structured(result)).toMatchObject({ has_more: false, cursor: null, returned: 1 });
  });

  it("reads on from a cursor a previous answer named", async () => {
    const { client, asked } = clientServing("category-last-page.json");

    await runListPersonWorks(client, {
      category: "Category:Nadaud, Camille",
      cursor: "page|54485245457e7e4155424552544954",
    });

    expect(asked[0]).toContain("cmcontinue=page%7C54485245457e7e4155424552544954");
  });

  it("says an empty category holds nothing rather than serving a bare list", async () => {
    // A category the library does not hold answers exactly as an empty one
    // does, so the answer says both readings are open.
    const { client } = clientServing("category-empty.json");

    const result = await runListPersonWorks(client, { category: "Category:Nobody, Nemo" });

    expect(structured(result)).toMatchObject({ returned: 0, has_more: false });
    expect(notesOf(result).join(" ")).toContain("holds no work");
    expect(notesOf(result).join(" ")).toContain("search_people");
  });
});

describe("browsing a category", () => {
  it("reads the works filed under a genre, a key or an instrumentation", async () => {
    const { client, asked } = clientServing("category-members.json");

    const result = await runBrowseCategory(client, { category: "For piano" });
    const rows = structured(result).results as Record<string, unknown>[];

    expect(asked[0]).toContain("cmtitle=Category%3AFor+piano");
    expect(rows).toHaveLength(3);
    expect(structured(result).category).toBe("Category:For piano");
  });

  it("names what a work page hands back as the category to browse", async () => {
    const { client } = clientServing("category-members.json");

    const result = await runBrowseCategory(client, { category: "Category:Nocturnes" });

    expect(structured(result)).toMatchObject({ category: "Category:Nocturnes", total: null });
  });

  it("reads on from a cursor a previous answer named", async () => {
    const { client, asked } = clientServing("category-last-page.json");

    await runBrowseCategory(client, { category: "For piano", cursor: "page|4341524e4554" });

    expect(asked[0]).toContain("cmcontinue=page%7C4341524e4554");
  });

  it("says the library cannot cross two categories", async () => {
    // The search of this wiki has no 'incategory', so "nocturnes for piano" is
    // a question the library cannot be asked, and saying so beats a caller
    // reading the first category as an answer to both.
    const { client } = clientServing("category-members.json");

    const result = await runBrowseCategory(client, { category: "For piano" });

    expect(notesOf(result).join(" ")).toContain("one category at a time");
  });

  it("says an empty category holds nothing", async () => {
    const { client } = clientServing("category-empty.json");

    const result = await runBrowseCategory(client, { category: "For ondes Martenot" });

    expect(notesOf(result).join(" ")).toContain("holds no work");
  });
});

describe("a listing the library will not answer", () => {
  it("reports a category it states nothing for as an absence", async () => {
    const client = new ImslpClient({
      config: loadConfig({}),
      fetchImpl: (async () =>
        Response.json({
          error: { code: "invalidtitle", info: "Bad title" },
        })) as unknown as typeof fetch,
    });

    const result = await runBrowseCategory(client, { category: "[[[" });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("[not_found]");
  });

  it("reports an answer carrying no members block", async () => {
    const client = new ImslpClient({
      config: loadConfig({}),
      fetchImpl: (async () => Response.json({ query: {} })) as unknown as typeof fetch,
    });

    const result = await runListPersonWorks(client, { category: "Category:Nadaud, Camille" });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("[parse_failure]");
  });
});

describe("reading the same listing twice", () => {
  it("says the second answer was held rather than asked for again", async () => {
    const { client, asked } = clientServing("category-members.json");
    await runBrowseCategory(client, { category: "For piano" });

    const second = await runBrowseCategory(client, { category: "For piano" });

    expect(asked).toHaveLength(1);
    expect(notesOf(second).join(" ")).toContain("cache");
  });

  it("says so for the works of a person too", async () => {
    const { client } = clientServing("category-members.json");
    await runListPersonWorks(client, { category: "Nadaud, Camille" });

    const second = await runListPersonWorks(client, { category: "Nadaud, Camille" });

    expect(notesOf(second).join(" ")).toContain("cache");
  });
});

describe("what the listings refuse", () => {
  it("refuse a category of nothing at all", () => {
    expect(listPersonWorksInput.safeParse({ category: "" }).success).toBe(false);
    expect(browseCategoryInput.safeParse({ category: "" }).success).toBe(false);
  });

  it("refuse an argument they do not declare", () => {
    const refusal = browseCategoryInput.safeParse({ category: "For piano", cmlimit: 5 });

    expect(refusal.success).toBe(false);
    expect(refusal.error?.issues[0]?.message).toContain("[invalid_input]");
  });

  it("refuse a category that is only spaces once it reaches the site", async () => {
    const { client } = clientServing("category-empty.json");

    const result = await runListPersonWorks(client, { category: "   " });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("[invalid_input]");
  });
});
