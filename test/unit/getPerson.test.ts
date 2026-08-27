/**
 * get_person, which reads the page a person is catalogued on.
 *
 * A person's page carries no table of fields: the name and the life dates open
 * it, and what follows is a set of lines each introduced by a symbol. Half of
 * those lines are absent on the page of someone the library holds little about.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config.js";
import { ImslpClient } from "../../src/imslp/client.js";
import { getPersonInput, runGetPerson } from "../../src/tools/getPerson.js";
import type { ToolResult } from "../../src/tools/shared.js";

const FIXTURES = join(import.meta.dirname, "..", "fixtures");

function clientServing(title: string, fixture: string): ImslpClient {
  return new ImslpClient({
    config: loadConfig({}),
    fetchImpl: (async () =>
      Response.json({
        parse: { title, text: { "*": readFileSync(join(FIXTURES, fixture), "utf8") } },
      })) as unknown as typeof fetch,
  });
}

function structured(result: ToolResult): Record<string, unknown> {
  return (result.structuredContent ?? {}) as Record<string, unknown>;
}

describe("reading a person", () => {
  it("reads the name and the life dates as the page prints them", async () => {
    const client = clientServing("Category:Aubertin, Mireille", "person.html");

    const result = await runGetPerson(client, { category: "Category:Aubertin, Mireille" });

    expect(structured(result)).toMatchObject({
      category: "Category:Aubertin, Mireille",
      name: "Mireille Aubertin",
      catalogued_as: "Aubertin, Mireille",
      life_dates: "4 March 1861 — 2 November 1934",
      page_url: "https://imslp.org/wiki/Category:Aubertin,_Mireille",
    });
  });

  it("keeps a line of other names as the library published it", async () => {
    // The line separates names with commas, and "Aubertin, Mireille Jeanne"
    // carries one of its own: cut on commas, one person becomes two.
    const client = clientServing("Category:Aubertin, Mireille", "person.html");

    const result = await runGetPerson(client, { category: "Category:Aubertin, Mireille" });

    expect(structured(result).alternative_names).toBe("Mireille Aubertin-Nadaud, M. Aubertin");
    expect(structured(result).aliases).toBe("Aubertin, Mireille Jeanne");
  });

  it("pairs each authority with the identifier it published", async () => {
    const client = clientServing("Category:Aubertin, Mireille", "person.html");

    const result = await runGetPerson(client, { category: "Category:Aubertin, Mireille" });

    expect(structured(result).authorities).toEqual([
      { authority: "WorldCat", id: null, url: "https://example.invalid/worldcat/2" },
      { authority: "VIAF", id: "900001", url: "https://example.invalid/viaf/900001" },
      { authority: "BNF", id: "900001x", url: "https://example.invalid/bnf/900001x" },
    ]);
  });

  it("reads the addresses the page points to off the site", async () => {
    const client = clientServing("Category:Aubertin, Mireille", "person.html");

    const result = await runGetPerson(client, { category: "Category:Aubertin, Mireille" });
    const links = structured(result).external_links as { url: string }[];

    expect(links.map((link) => link.url)).toContain("https://example.invalid/biography");
  });

  it("reads a page stating nothing but a name without inventing the rest", async () => {
    const client = clientServing("Category:Nadaud, Camille", "person-bare.html");

    const result = await runGetPerson(client, { category: "Category:Nadaud, Camille" });

    expect(structured(result)).toMatchObject({
      name: "Camille Nadaud",
      life_dates: null,
      alternative_names: null,
      aliases: null,
      authorities: [],
    });
  });

  it("points at the tool that lists what the person wrote", async () => {
    const client = clientServing("Category:Aubertin, Mireille", "person.html");

    const result = await runGetPerson(client, { category: "Category:Aubertin, Mireille" });
    const notes = (structured(result).notes ?? []) as string[];

    expect(notes.join(" ")).toContain("list_person_works");
  });
});

describe("a page ending on its links", () => {
  it("reads them, with nothing after them to bound the block", async () => {
    const client = clientServing("Category:Roux, Jeanne", "person-links-only.html");

    const result = await runGetPerson(client, { category: "Category:Roux, Jeanne" });
    const links = structured(result).external_links as { url: string }[];

    expect(structured(result).life_dates).toBe("1899—1975");
    expect(links).toHaveLength(1);
  });
});

describe("reading the same person twice", () => {
  it("says the second answer was held rather than asked for again", async () => {
    const client = clientServing("Category:Aubertin, Mireille", "person.html");
    await runGetPerson(client, { category: "Aubertin, Mireille" });

    const second = await runGetPerson(client, { category: "Aubertin, Mireille" });
    const notes = (structured(second).notes ?? []) as string[];

    expect(notes.join(" ")).toContain("cache");
  });
});

describe("a page that is not a person", () => {
  it("reports the shape rather than a person made of nothing", async () => {
    const client = clientServing("Category:Nocturnes", "work-full.html");

    const result = await runGetPerson(client, { category: "Category:Nocturnes" });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("[parse_failure]");
  });
});

describe("what the tool refuses", () => {
  it("refuses a category of nothing at all", () => {
    expect(getPersonInput.safeParse({ category: "" }).success).toBe(false);
  });

  it("refuses an argument it does not declare", () => {
    const refusal = getPersonInput.safeParse({ category: "Category:X", page: "Y" });

    expect(refusal.success).toBe(false);
    expect(refusal.error?.issues[0]?.message).toContain("[invalid_input]");
  });
});
