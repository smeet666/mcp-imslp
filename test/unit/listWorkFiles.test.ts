/**
 * list_work_files, which pages through what a work page holds.
 *
 * A work of the library runs from one file to a few hundred, so this is where
 * the editions are read: it says how many the page holds, where the reading
 * stopped, and what a restriction set aside.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { loadConfig } from "../../src/config.js";
import { ImslpClient } from "../../src/imslp/client.js";
import { listWorkFilesInput, runListWorkFiles } from "../../src/tools/listWorkFiles.js";
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

function notesOf(result: ToolResult): string[] {
  return (structured(result).notes ?? []) as string[];
}

describe("reading the editions of a work", () => {
  it("hands back the editions with the files each holds", async () => {
    const client = clientServing("Three Inventions (Aubertin, Mireille)", "work-full.html");

    const result = await runListWorkFiles(client, {
      page: "Three Inventions (Aubertin, Mireille)",
    });

    expect(structured(result)).toMatchObject({
      page_title: "Three Inventions (Aubertin, Mireille)",
      editions_on_page: 2,
      offset: 0,
      returned: 2,
      has_more: false,
    });
    const editions = structured(result).editions as { section: string; files: unknown[] }[];
    expect(editions.map((each) => each.section)).toEqual(["Recordings", "Scores"]);
    expect(editions[1]?.files).toHaveLength(2);
  });

  it("counts the editions the page holds rather than the ones it served", async () => {
    const client = clientServing("Six éditions (Nadaud, Camille)", "work-many-editions.html");

    const result = await runListWorkFiles(client, {
      page: "Six éditions (Nadaud, Camille)",
      limit: 2,
    });

    expect(structured(result)).toMatchObject({
      editions_on_page: 6,
      returned: 2,
      offset: 0,
      has_more: true,
    });
  });

  it("continues from where a reading stopped", async () => {
    const client = clientServing("Six éditions (Nadaud, Camille)", "work-many-editions.html");

    const result = await runListWorkFiles(client, {
      page: "Six éditions (Nadaud, Camille)",
      limit: 2,
      offset: 4,
    });

    expect(structured(result)).toMatchObject({ returned: 2, offset: 4, has_more: false });
  });

  it("says an offset past the last edition served nothing", async () => {
    const client = clientServing("Six éditions (Nadaud, Camille)", "work-many-editions.html");

    const result = await runListWorkFiles(client, {
      page: "Six éditions (Nadaud, Camille)",
      offset: 50,
    });

    expect(structured(result)).toMatchObject({ returned: 0, has_more: false });
    expect(notesOf(result).join(" ")).toContain("past the last edition");
  });
});

describe("restricting to one section", () => {
  it("serves the editions of the section that was named", async () => {
    const client = clientServing("Three Inventions (Aubertin, Mireille)", "work-full.html");

    const result = await runListWorkFiles(client, {
      page: "Three Inventions (Aubertin, Mireille)",
      section: "scores",
    });

    const editions = structured(result).editions as { section: string }[];
    expect(editions.map((each) => each.section)).toEqual(["Scores"]);
    expect(structured(result)).toMatchObject({ editions_on_page: 2, editions_in_section: 1 });
  });

  it("names the sections the page holds when a restriction matches none", async () => {
    // A restriction that finds nothing must not read as a work without scores,
    // so the answer says what was asked for and what the page does hold.
    const client = clientServing("Three Inventions (Aubertin, Mireille)", "work-full.html");

    const result = await runListWorkFiles(client, {
      page: "Three Inventions (Aubertin, Mireille)",
      section: "Libretti",
    });

    expect(structured(result)).toMatchObject({ returned: 0, editions_in_section: 0 });
    expect(notesOf(result).join(" ")).toContain("Recordings");
    expect(notesOf(result).join(" ")).toContain("Scores");
  });
});

describe("a title that stands for another", () => {
  it("reads the editions of the page it stands for, and says so", async () => {
    const pages = ["work-redirect.html", "work-full.html"];
    let at = 0;
    const client = new ImslpClient({
      config: loadConfig({}),
      fetchImpl: (async () => {
        const fixture = pages[Math.min(at, pages.length - 1)] ?? "work-full.html";
        at += 1;
        return Response.json({
          parse: {
            title:
              at === 1 ? "Conseil (Rebikov, Vladimir)" : "Three Inventions (Aubertin, Mireille)",
            text: { "*": readFileSync(join(FIXTURES, fixture), "utf8") },
          },
        });
      }) as unknown as typeof fetch,
    });

    vi.useFakeTimers();
    const answering = runListWorkFiles(client, { page: "Conseil (Rebikov, Vladimir)" });
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await answering;
    vi.useRealTimers();

    expect(structured(result).redirected_from).toBe("Conseil (Rebikov, Vladimir)");
    expect(notesOf(result).join(" ")).toContain("redirect");
  });
});

describe("what an answer says about copyright", () => {
  it("carries the statement of every edition it serves", async () => {
    const client = clientServing("Three Inventions (Aubertin, Mireille)", "work-full.html");

    const result = await runListWorkFiles(client, {
      page: "Three Inventions (Aubertin, Mireille)",
      section: "Scores",
    });

    const editions = structured(result).editions as { copyright: unknown }[];
    expect(editions[0]?.copyright).toMatchObject({
      headline: "Public Domain",
      restrictions: ["Non-PD US"],
    });
    expect(notesOf(result).join(" ")).toContain("Non-PD US");
  });
});

describe("terms the library qualified with a remark", () => {
  it("says how many editions carry one, and where to read it", async () => {
    const client = clientServing(
      "Édition urtext (Nadaud, Camille)",
      "work-remarked-copyright.html",
    );

    const result = await runListWorkFiles(client, { page: "Édition urtext (Nadaud, Camille)" });

    expect(notesOf(result).join(" ")).toContain("copyright.remark");
    const editions = structured(result).editions as { copyright: { remark: string | null } }[];
    expect(editions[0]?.copyright.remark).toBe("See notes on copyright status for urtext editions");
  });
});

describe("a file the library has suspended", () => {
  it("says so, rather than serving it among the ordinary entries", async () => {
    const client = clientServing("Pièce bloquée (Nadaud, Camille)", "work-blocked-file.html");

    const result = await runListWorkFiles(client, { page: "Pièce bloquée (Nadaud, Camille)" });

    expect(notesOf(result).join(" ")).toContain("blocked");
    expect(result.content[0]?.text).toContain("[blocked]");
    const editions = structured(result).editions as { files: { blocked: boolean }[] }[];
    expect(editions[0]?.files[0]?.blocked).toBe(true);
  });
});

describe("a work page holding nothing yet", () => {
  it("says the page holds no edition rather than serving an empty list alone", async () => {
    const client = clientServing("Œuvre sans fichier (Nadaud, Camille)", "work-no-files.html");

    const result = await runListWorkFiles(client, {
      page: "Œuvre sans fichier (Nadaud, Camille)",
    });

    expect(structured(result)).toMatchObject({ editions_on_page: 0, returned: 0 });
    expect(notesOf(result).join(" ")).toContain("no score and no recording");
  });
});

describe("what the text block carries", () => {
  it("names a work whose page names no composer by its title alone", async () => {
    const client = clientServing("Œuvre anonyme", "work-no-composer.html");

    const result = await runListWorkFiles(client, { page: "Œuvre anonyme" });

    expect(result.content[0]?.text.split("\n")[0]).toBe("Œuvre anonyme");
    expect(result.content[0]?.text).toContain("No edition served.");
  });

  it("prints an entry publishing nothing but its name without inventing figures", async () => {
    const client = clientServing("Petite pièce (Nadaud, Camille)", "work-sparse.html");

    const result = await runListWorkFiles(client, { page: "Petite pièce (Nadaud, Camille)" });
    const text = result.content[0]?.text ?? "";

    expect(text).toContain("#900010 Complete Score");
    expect(text).not.toContain("pp.");
    expect(text).not.toContain("downloads");
  });

  it("names the performers of a recording where an edition names its publisher", async () => {
    const client = clientServing("Three Inventions (Aubertin, Mireille)", "work-full.html");

    const result = await runListWorkFiles(client, {
      page: "Three Inventions (Aubertin, Mireille)",
      section: "Recordings",
    });

    expect(result.content[0]?.text).toContain("perf. Ensemble inventé");
  });
});

describe("an edition the page describes with nothing", () => {
  it("prints its section and its files, and states no terms it was not given", async () => {
    const client = clientServing(
      "Entrées inhabituelles (Nadaud, Camille)",
      "work-odd-entries.html",
    );

    const result = await runListWorkFiles(client, {
      page: "Entrées inhabituelles (Nadaud, Camille)",
    });
    const text = result.content[0]?.text ?? "";

    expect(text).toContain("\nScores\n");
    expect(text).toContain("#900200");
  });
});

describe("what the tool refuses", () => {
  it("refuses a call naming neither a page nor a page id", async () => {
    const client = clientServing("Three Inventions (Aubertin, Mireille)", "work-full.html");

    const result = await runListWorkFiles(client, {});

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("[invalid_input]");
  });

  it("refuses an argument it does not declare", () => {
    const refusal = listWorkFilesInput.safeParse({ page: "A work (A composer)", kind: "scores" });

    expect(refusal.success).toBe(false);
    expect(refusal.error?.issues[0]?.message).toContain("[invalid_input]");
  });

  it("refuses a limit outside what it serves", () => {
    expect(listWorkFilesInput.safeParse({ page: "A work (A composer)", limit: 0 }).success).toBe(
      false,
    );
    expect(listWorkFilesInput.safeParse({ page: "A work (A composer)", limit: 101 }).success).toBe(
      false,
    );
  });
});

describe("reading a work twice", () => {
  it("costs one request, since both readings are of the same page", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        parse: {
          title: "Three Inventions (Aubertin, Mireille)",
          text: { "*": readFileSync(join(FIXTURES, "work-full.html"), "utf8") },
        },
      }),
    );
    const client = new ImslpClient({
      config: loadConfig({}),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await runListWorkFiles(client, { page: "Three Inventions (Aubertin, Mireille)" });
    await runListWorkFiles(client, { page: "Three Inventions (Aubertin, Mireille)", offset: 1 });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
