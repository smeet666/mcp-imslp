/**
 * The cases a corpus of ordinary pages does not reach.
 *
 * Each one is a shape the site does publish: a composer named without a
 * category, a page holding nothing yet, an answer served with no body at all,
 * and a caller mistyping an argument in a way no suggestion can rescue.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { z } from "zod";
import { createLogger, loadConfig } from "../../src/config.js";
import { createServer } from "../../src/server.js";
import { ImslpClient } from "../../src/imslp/client.js";
import { group, startOf } from "../../src/imslp/html.js";
import { parseWorkPage } from "../../src/imslp/parseWork.js";
import { strictInput } from "../../src/tools/arguments.js";
import { runGetWork } from "../../src/tools/getWork.js";

const FIXTURES = join(import.meta.dirname, "..", "fixtures");

function fixture(name: string): string {
  return readFileSync(join(FIXTURES, name), "utf8");
}

function envelope(title: string, name: string): Response {
  return Response.json({ parse: { title, text: { "*": fixture(name) } } });
}

function clientServing(title: string, name: string): ImslpClient {
  return new ImslpClient({
    config: loadConfig({}),
    fetchImpl: (async () => envelope(title, name)) as unknown as typeof fetch,
  });
}

function workOf(name: string, pageTitle: string) {
  const outcome = parseWorkPage(fixture(name), {
    pageTitle,
    pageid: null,
    url: "https://imslp.org/api.php",
  });
  if (outcome.kind !== "work") {
    throw new Error("expected a work");
  }
  return outcome.work;
}

describe("a composer the page names without linking", () => {
  it("keeps the name and points at the category it would live in", () => {
    const work = workOf("work-no-files.html", "Œuvre sans fichier (Nadaud, Camille)");

    expect(work.composer).toBe("Nadaud, Camille");
    expect(work.composer_page_url).toBe("https://imslp.org/wiki/Category:Nadaud,_Camille");
  });

  it("names none when the page names none", () => {
    const work = workOf("work-no-composer.html", "Œuvre anonyme");

    expect(work.composer).toBeNull();
    expect(work.composer_page_url).toBeNull();
  });

  it("names none when the page prints no composer row", () => {
    const work = workOf("work-no-composer-row.html", "Œuvre sans auteur nommé");

    expect(work.composer).toBeNull();
    expect(work.piece_style).toBe("Baroque");
  });

  it("writes a work without a composer as its title alone", async () => {
    const result = await runGetWork(clientServing("Œuvre anonyme", "work-no-composer.html"), {
      page: "Œuvre anonyme",
    });

    expect(result.content[0]?.text.split("\n")[0]).toBe("Œuvre anonyme");
  });

  it("writes a copyright that excludes nowhere without naming a country", async () => {
    const result = await runGetWork(
      clientServing("Petite pièce (Nadaud, Camille)", "work-sparse.html"),
      { page: "Petite pièce (Nadaud, Camille)" },
    );

    expect(result.content[0]?.text).toContain("Creative Commons Attribution 4.0");
    expect(result.content[0]?.text).not.toContain("not in");
  });

  it("keeps a link that stays on the site out of the external ones", () => {
    // The external links of a work are addresses off IMSLP, and a category on
    // the site listed there is not one of them.
    expect(workOf("work-no-composer.html", "Œuvre anonyme").external_links).toEqual([]);
  });
});

describe("a work page holding nothing yet", () => {
  it("says so rather than leaving a caller to read an empty list", async () => {
    const result = await runGetWork(
      clientServing("Œuvre sans fichier (Nadaud, Camille)", "work-no-files.html"),
      {
        page: "Œuvre sans fichier (Nadaud, Camille)",
      },
    );
    const notes = (result.structuredContent?.notes ?? []) as string[];

    expect(notes.join(" ")).toContain("no score and no recording");
  });

  it("says when an answer was held rather than asked for again", async () => {
    const client = clientServing("Œuvre sans fichier (Nadaud, Camille)", "work-no-files.html");
    await runGetWork(client, { page: "Œuvre sans fichier (Nadaud, Camille)" });

    const second = await runGetWork(client, { page: "Œuvre sans fichier (Nadaud, Camille)" });
    const notes = (second.structuredContent?.notes ?? []) as string[];

    expect(notes.join(" ")).toContain("cache");
  });
});

describe("entries written in unusual ways", () => {
  it("falls back on the page title when the page states no work title", () => {
    const work = workOf("work-odd-entries.html", "Entrées inhabituelles (Nadaud, Camille)");

    expect(work.title).toBe("Entrées inhabituelles (Nadaud, Camille)");
  });

  it("reads the facets of a page that carries no General Information section", () => {
    const work = workOf("work-odd-entries.html", "Entrées inhabituelles (Nadaud, Camille)");

    expect(work.composer).toBe("Nadaud, Camille");
    expect(work.piece_style).toBe("Baroque");
  });

  it("counts no section for a tab the page labels with nothing", () => {
    const work = workOf("work-odd-entries.html", "Entrées inhabituelles (Nadaud, Camille)");

    expect(work.sections).toEqual([{ name: "Scores", files: 2 }]);
  });

  it("names a tab section by its identifier when the tab bar lists none", () => {
    const work = workOf("work-odd-entries.html", "Entrées inhabituelles (Nadaud, Camille)");

    expect(work.editions?.map((each) => each.section)).toEqual(["Scores", "Scores"]);
  });

  it("reads an entry sitting in no numbered block", () => {
    const work = workOf("work-odd-entries.html", "Entrées inhabituelles (Nadaud, Camille)");
    const editions = work.editions ?? [];

    expect(editions).toHaveLength(2);
    expect(editions[0]?.files[0]?.imslp_id).toBe(900_200);
  });

  it("reads an entry publishing neither a size nor a name for itself", () => {
    const work = workOf("work-odd-entries.html", "Entrées inhabituelles (Nadaud, Camille)");
    const file = work.editions?.[0]?.files[0];

    expect(file?.description).toBe("");
    expect(file?.size_bytes).toBeNull();
    expect(file?.format).toBeNull();
    expect(file?.scanned_by_code).toBeNull();
  });

  it("reads an empty copyright cell as a statement of nothing", () => {
    const work = workOf("work-odd-entries.html", "Entrées inhabituelles (Nadaud, Camille)");

    expect(work.editions?.[1]?.copyright).toEqual({
      statement: "",
      headline: "",
      restrictions: [],
      remark: null,
      reviewed_in: ["Canada", "United States", "European Union"],
    });
  });
});

describe("a failure that is not an error object", () => {
  it("is reported in this client's own vocabulary", async () => {
    // No retry here: what is under test is how the failure is named, and three
    // more attempts would only wait out three backoffs to name it the same way.
    const client = new ImslpClient({
      config: { ...loadConfig({}), maxRetries: 0 },
      // A transport can reject with something that is not an error at all,
      // and the answer still has to carry one of the six codes.
      fetchImpl: (() => Promise.reject("the socket went away")) as unknown as typeof fetch,
    });

    await expect(client.renderPage({ pageid: 1 })).rejects.toMatchObject({
      code: "network_error",
    });
  });
});

describe("a redirect read twice", () => {
  it("is served from the cache on both of its reads", async () => {
    const pages = ["work-redirect.html", "work-full.html"];
    let at = 0;
    const client = new ImslpClient({
      config: loadConfig({}),
      fetchImpl: (async () => {
        const name = pages[Math.min(at, pages.length - 1)] ?? "work-full.html";
        at += 1;
        return envelope(
          at === 1 ? "Conseil (Rebikov, Vladimir)" : "Three Inventions (Aubertin, Mireille)",
          name,
        );
      }) as unknown as typeof fetch,
    });

    vi.useFakeTimers();
    const first = client.getWork({ page: "Conseil (Rebikov, Vladimir)" });
    await vi.advanceTimersByTimeAsync(10_000);
    await first;
    vi.useRealTimers();

    const second = await client.getWork({ page: "Conseil (Rebikov, Vladimir)" });

    expect(second.cached).toBe(true);
    expect(second.data.redirected_from).toBe("Conseil (Rebikov, Vladimir)");
  });
});

describe("an answer served with no body", () => {
  it("reports the shape rather than an empty result", async () => {
    const client = new ImslpClient({
      config: loadConfig({}),
      fetchImpl: (async () => new Response(null)) as unknown as typeof fetch,
    });

    await expect(client.renderPage({ pageid: 1 })).rejects.toMatchObject({
      code: "parse_failure",
    });
  });
});

describe("where a match begins", () => {
  it("reads a match built by hand as beginning at the start", () => {
    expect(startOf(["ab"] as unknown as RegExpMatchArray)).toBe(0);
    expect(startOf(/b/.exec("ab") as RegExpMatchArray)).toBe(1);
  });
});

describe("the group of a match", () => {
  it("reads a group that did not take part as empty", () => {
    expect(group(/a(b)?/.exec("a"), 1)).toBe("");
  });

  it("reads a pattern that matched nowhere as empty too", () => {
    expect(group(/(z)/.exec("a"), 1)).toBe("");
  });
});

describe("naming an argument that was meant", () => {
  const schema = strictInput({ page: z.string().optional() });

  it("reads a name written differently as the same name", () => {
    const refusal = schema.safeParse({ PAGE: "A work (A composer)" });

    expect(refusal.error?.issues[0]?.message).toContain("did you mean 'page'");
  });

  it("offers the name a caller was one slip away from", () => {
    const withId = strictInput({ pageid: z.number().optional() });

    const refusal = withId.safeParse({ pageud: 1 });

    expect(refusal.error?.issues[0]?.message).toContain("did you mean 'pageid'");
  });

  it("offers nothing for a name too far from any it declares", () => {
    // A suggestion that misses sends a caller to an argument answering a
    // different question, so past a third of the name nothing is offered.
    const refusal = schema.safeParse({ paxz: 1 });

    expect(refusal.error?.issues[0]?.message).not.toContain("did you mean");
  });

  it("offers nothing for a name that is punctuation alone", () => {
    const refusal = schema.safeParse({ ___: 1 });

    expect(refusal.error?.issues[0]?.message).not.toContain("did you mean");
  });
});

describe("calling the tool through the protocol", () => {
  it("answers a host that asks for a work", async () => {
    const server = createServer({
      config: loadConfig({}),
      logger: createLogger("silent"),
      fetchImpl: (async () =>
        envelope(
          "Three Inventions (Aubertin, Mireille)",
          "work-full.html",
        )) as unknown as typeof fetch,
    });
    const client = new Client({ name: "test", version: "0.0.0" });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverSide), client.connect(clientSide)]);

    const result = await client.callTool({
      name: "get_work",
      arguments: { page: "Three Inventions (Aubertin, Mireille)" },
    });

    expect((result.structuredContent as { title?: string }).title).toBe("Three Inventions");
    await server.close();
  });
});

describe("calling the second tool through the protocol", () => {
  it("answers a host that asks for the editions of a work", async () => {
    const server = createServer({
      config: loadConfig({}),
      logger: createLogger("silent"),
      fetchImpl: (async () =>
        envelope(
          "Three Inventions (Aubertin, Mireille)",
          "work-full.html",
        )) as unknown as typeof fetch,
    });
    const client = new Client({ name: "test", version: "0.0.0" });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverSide), client.connect(clientSide)]);

    const result = await client.callTool({
      name: "list_work_files",
      arguments: { page: "Three Inventions (Aubertin, Mireille)", section: "Scores" },
    });

    expect((result.structuredContent as { returned?: number }).returned).toBe(1);
    await server.close();
  });
});

describe("calling the searches through the protocol", () => {
  it("answers a host that searches for a work and for a person", async () => {
    const payloads = ["search-works.json", "search-people.json"];
    let at = 0;
    const server = createServer({
      config: loadConfig({}),
      logger: createLogger("silent"),
      fetchImpl: (async () => {
        const name = payloads[Math.min(at, payloads.length - 1)] ?? "search-works.json";
        at += 1;
        return Response.json(JSON.parse(fixture(name)));
      }) as unknown as typeof fetch,
    });
    const client = new Client({ name: "test", version: "0.0.0" });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverSide), client.connect(clientSide)]);

    const works = await client.callTool({
      name: "search_works",
      arguments: { query: "inventions" },
    });
    const people = await client.callTool({ name: "search_people", arguments: { query: "nadaud" } });

    expect((works.structuredContent as { returned?: number }).returned).toBe(3);
    expect((people.structuredContent as { returned?: number }).returned).toBe(2);
    await server.close();
  });
});

describe("calling the listings and the person through the protocol", () => {
  /**
   * One call per host, each with its own server.
   *
   * Calls made through one server queue behind the pacing it owes IMSLP, so
   * three of them in a row would be a test measuring a wait rather than an
   * answer.
   */
  async function hostFor(payload: () => Response) {
    const server = createServer({
      config: loadConfig({}),
      logger: createLogger("silent"),
      fetchImpl: (async () => payload()) as unknown as typeof fetch,
    });
    const client = new Client({ name: "test", version: "0.0.0" });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
    return { client, server };
  }

  it("answers a host that asks for the works of a person", async () => {
    const { client, server } = await hostFor(() =>
      Response.json(JSON.parse(fixture("category-members.json"))),
    );

    const result = await client.callTool({
      name: "list_person_works",
      arguments: { category: "Category:Aubertin, Mireille" },
    });

    expect((result.structuredContent as { returned?: number }).returned).toBe(3);
    await server.close();
  });

  it("answers a host that asks for the person", async () => {
    const { client, server } = await hostFor(() =>
      Response.json({
        parse: { title: "Category:Aubertin, Mireille", text: { "*": fixture("person.html") } },
      }),
    );

    const result = await client.callTool({
      name: "get_person",
      arguments: { category: "Category:Aubertin, Mireille" },
    });

    expect((result.structuredContent as { name?: string }).name).toBe("Mireille Aubertin");
    await server.close();
  });

  it("answers a host that browses a category", async () => {
    const { client, server } = await hostFor(() =>
      Response.json(JSON.parse(fixture("category-members.json"))),
    );

    const result = await client.callTool({
      name: "browse_category",
      arguments: { category: "For piano" },
    });

    expect((result.structuredContent as { returned?: number }).returned).toBe(3);
    await server.close();
  });
});

describe("a read nobody is waiting for any more", () => {
  it("is not asked of the site a second time", async () => {
    const fetchImpl = vi.fn(async () => envelope("A work (A composer)", "work-sparse.html"));
    const client = new ImslpClient({
      config: loadConfig({}),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await client.renderPage({ page: "A work (A composer)" });
    await client.renderPage({ page: "A work (A composer)" });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
