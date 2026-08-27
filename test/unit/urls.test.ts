/** The addresses this client builds, and the ones it refuses to treat as IMSLP. */

import { describe, expect, it } from "vitest";
import {
  apiUrl,
  iscrUrl,
  isImslpHost,
  splitWorkTitle,
  toAbsoluteUrl,
  wikiPageUrl,
} from "../../src/imslp/urls.js";

describe("the address of a page", () => {
  it("writes a title the way the site writes it", () => {
    expect(wikiPageUrl("Nocturnes, Op.9 (Chopin, Frédéric)")).toBe(
      "https://imslp.org/wiki/Nocturnes,_Op.9_(Chopin,_Fr%C3%A9d%C3%A9ric)",
    );
  });
});

describe("the calls this client makes", () => {
  it("asks the API in JSON", () => {
    const url = apiUrl({ action: "parse", page: "A work (A composer)" });

    expect(url).toContain("https://imslp.org/api.php?");
    expect(url).toContain("format=json");
    expect(url).toContain("page=A+work+%28A+composer%29");
  });

  it("writes the listing arguments as the path the site documents", () => {
    expect(iscrUrl({ disclaimer: "accepted", type: 2, start: 0 })).toBe(
      "https://imslp.org/imslpscripts/API.ISCR.php?account=worklist/disclaimer=accepted/type=2/start=0",
    );
  });
});

describe("what counts as the site", () => {
  it("accepts the site and its www name", () => {
    expect(isImslpHost("https://imslp.org/wiki/Main_Page")).toBe(true);
    expect(isImslpHost("http://www.imslp.org/api.php")).toBe(true);
  });

  it("refuses anywhere else, and anything that is not an address", () => {
    expect(isImslpHost("https://imslp.org.example.invalid/")).toBe(false);
    expect(isImslpHost("ftp://imslp.org/")).toBe(false);
    expect(isImslpHost("not an address")).toBe(false);
  });
});

describe("an address the site published", () => {
  it("resolves a relative one against the site", () => {
    expect(toAbsoluteUrl("/wiki/Category:Chopin,_Frédéric")).toBe(
      "https://imslp.org/wiki/Category:Chopin,_Fr%C3%A9d%C3%A9ric",
    );
  });

  it("invents nothing in place of one that is no address", () => {
    expect(toAbsoluteUrl("http://[")).toBeNull();
  });
});

describe("the title of a work page", () => {
  it("reads the composer out of the last parenthesis", () => {
    expect(splitWorkTitle("Sonata (No.2) (Ives, Charles)")).toEqual({
      work: "Sonata (No.2)",
      composer: "Ives, Charles",
    });
  });

  it("keeps a title outside that form whole", () => {
    expect(splitWorkTitle("Requiem")).toEqual({ work: "Requiem", composer: null });
  });
});
