/**
 * search_works and search_people, the two ways into the library.
 *
 * IMSLP publishes no count of what a search matched, whatever is asked of it,
 * so an answer here says how far the reading went and nothing about how far it
 * could go. A snippet arrives as wikitext, and the markup around the matched
 * words is not a sentence.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { loadConfig } from "../../src/config.js";
import { ImslpClient } from "../../src/imslp/client.js";
import { runSearchPeople, searchPeopleInput } from "../../src/tools/searchPeople.js";
import { runSearchWorks, searchWorksInput } from "../../src/tools/searchWorks.js";
import type { ToolResult } from "../../src/tools/shared.js";

const FIXTURES = join(import.meta.dirname, "..", "fixtures");

function payload(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES, name), "utf8"));
}

function clientServing(name: string): { client: ImslpClient; asked: string[] } {
  const asked: string[] = [];
  const fetchImpl = vi.fn(async (url: string | URL | Request) => {
    asked.push(String(url));
    return Response.json(payload(name));
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

describe("searching for a work", () => {
  it("reads the title of a page as the work and the composer it names", async () => {
    const { client } = clientServing("search-works.json");

    const result = await runSearchWorks(client, { query: "inventions" });
    const rows = structured(result).results as Record<string, unknown>[];

    expect(rows[0]).toMatchObject({
      page: "Three Inventions (Aubertin, Mireille)",
      work: "Three Inventions",
      composer: "Aubertin, Mireille",
      page_url: "https://imslp.org/wiki/Three_Inventions_(Aubertin,_Mireille)",
    });
  });

  it("keeps a title outside that form whole, and names no composer for it", async () => {
    const { client } = clientServing("search-works.json");

    const result = await runSearchWorks(client, { query: "requiem" });
    const rows = structured(result).results as Record<string, unknown>[];

    expect(rows[2]).toMatchObject({ page: "Requiem", work: "Requiem", composer: null });
  });

  it("hands back a snippet as words rather than as markup", async () => {
    const { client } = clientServing("search-works.json");

    const result = await runSearchWorks(client, { query: "inventions" });
    const rows = structured(result).results as { snippet: string | null }[];

    expect(rows[0]?.snippet).not.toContain("searchmatch");
    expect(rows[0]?.snippet).not.toContain("<span");
    expect(rows[0]?.snippet).toContain("inventions");
  });

  it("reads a row the search gave no snippet for as having none", async () => {
    const { client } = clientServing("search-works.json");

    const result = await runSearchWorks(client, { query: "petite" });
    const rows = structured(result).results as { snippet: string | null }[];

    expect(rows[1]?.snippet).toBeNull();
  });

  it("never claims a total the library does not publish", async () => {
    // The API answers no count of matches, whatever is asked of it, so an
    // answer stating one would be this server's own invention.
    const { client } = clientServing("search-works.json");

    const result = await runSearchWorks(client, { query: "inventions" });

    expect(structured(result)).toMatchObject({ total: null, returned: 3, has_more: true });
    expect(notesOf(result).join(" ")).toContain("publishes no count");
  });

  it("continues a reading from the offset the library named", async () => {
    const { client, asked } = clientServing("search-works.json");

    await runSearchWorks(client, { query: "inventions", offset: 3 });

    expect(asked[0]).toContain("sroffset=3");
  });

  it("searches the pages of works rather than the whole wiki", async () => {
    const { client, asked } = clientServing("search-works.json");

    await runSearchWorks(client, { query: "inventions" });

    expect(asked[0]).toContain("srnamespace=0");
  });

  it("says a search matched nothing rather than leaving an empty list alone", async () => {
    const { client } = clientServing("search-empty.json");

    const result = await runSearchWorks(client, { query: "zzzz" });

    expect(structured(result)).toMatchObject({ returned: 0, has_more: false });
    expect(notesOf(result).join(" ")).toContain("matched nothing");
  });
});

describe("searching for a person", () => {
  it("reads the category a person is addressed by", async () => {
    const { client, asked } = clientServing("search-people.json");

    const result = await runSearchPeople(client, { query: "nadaud" });
    const rows = structured(result).results as Record<string, unknown>[];

    expect(asked[0]).toContain("srnamespace=14");
    expect(rows[0]).toMatchObject({
      category: "Category:Nadaud, Camille",
      name: "Nadaud, Camille",
      page_url: "https://imslp.org/wiki/Category:Nadaud,_Camille",
    });
  });

  it("says which rows stand for another category rather than for a person", async () => {
    // A search over categories returns the redirects among them, and a caller
    // passing one to list_person_works would read an empty list of works.
    const { client } = clientServing("search-people.json");

    const result = await runSearchPeople(client, { query: "nadaud" });
    const rows = structured(result).results as { redirect_to: string | null }[];

    expect(rows[0]?.redirect_to).toBeNull();
    expect(rows[1]?.redirect_to).toBe("Category:Nadaud, Camille");
    expect(notesOf(result).join(" ")).toContain("redirect");
  });

  it("says a search matched nothing rather than leaving an empty list alone", async () => {
    const { client } = clientServing("search-empty.json");

    const result = await runSearchPeople(client, { query: "zzzz" });

    expect(structured(result)).toMatchObject({ returned: 0 });
    expect(notesOf(result).join(" ")).toContain("matched no person");
  });
});

describe("a row the library states sparingly", () => {
  it("leaves the day unknown when the stamp is not a date", async () => {
    const { client } = clientServing("search-odd.json");

    const result = await runSearchWorks(client, { query: "sans date" });
    const rows = structured(result).results as { last_edited: string | null }[];

    expect(rows[0]?.last_edited).toBeNull();
  });
});

describe("a search the library will not answer", () => {
  it("reports the error it stated rather than an empty result", async () => {
    const { client } = clientServing("search-refused.json");

    const result = await runSearchWorks(client, { query: "anything" });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("srsearch-error");
  });

  it("reports an answer carrying no results block", async () => {
    const { client } = clientServing("search-shapeless.json");

    const result = await runSearchPeople(client, { query: "anything" });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("[parse_failure]");
  });
});

describe("reading the same search twice", () => {
  it("says the second answer was held rather than asked for again", async () => {
    const { client, asked } = clientServing("search-works.json");
    await runSearchWorks(client, { query: "inventions" });

    const second = await runSearchWorks(client, { query: "inventions" });

    expect(asked).toHaveLength(1);
    expect(notesOf(second).join(" ")).toContain("cache");
  });

  it("says so for a search of people too", async () => {
    const { client } = clientServing("search-people.json");
    await runSearchPeople(client, { query: "nadaud" });

    const second = await runSearchPeople(client, { query: "nadaud" });

    expect(notesOf(second).join(" ")).toContain("cache");
  });
});

describe("what a search with no rows renders", () => {
  it("says no work matched, and no person matched", async () => {
    const works = clientServing("search-empty.json");
    const people = clientServing("search-empty.json");

    const noWork = await runSearchWorks(works.client, { query: "zzzz" });
    const noPerson = await runSearchPeople(people.client, { query: "zzzz" });

    expect(noWork.content[0]?.text).toContain("No work matched.");
    expect(noPerson.content[0]?.text).toContain("No person matched.");
  });
});

describe("what the searches refuse", () => {
  it("refuse a query of nothing at all", () => {
    expect(searchWorksInput.safeParse({ query: "" }).success).toBe(false);
    expect(searchPeopleInput.safeParse({ query: "  " }).success).toBe(true);
  });

  it("refuse an argument they do not declare", () => {
    const refusal = searchWorksInput.safeParse({ query: "a", srlimit: 5 });

    expect(refusal.success).toBe(false);
    expect(refusal.error?.issues[0]?.message).toContain("[invalid_input]");
  });

  it("refuse a limit outside what they serve", () => {
    expect(searchWorksInput.safeParse({ query: "a", limit: 0 }).success).toBe(false);
    expect(searchWorksInput.safeParse({ query: "a", limit: 51 }).success).toBe(false);
  });

  it("refuse a query that is only spaces once it reaches the site", async () => {
    const { client } = clientServing("search-empty.json");

    const result = await runSearchWorks(client, { query: "   " });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("[invalid_input]");
  });
});
