/**
 * What a work page amounts to, read from the corpus.
 *
 * The contract stated here is what IMSLP publishes and nothing beyond it: a
 * facet the page leaves empty is null, a rating nobody voted on is absent
 * rather than zero, and a copyright statement keeps the jurisdictions it names.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ImslpError } from "../../src/errors.js";
import { parseWorkPage } from "../../src/imslp/parseWork.js";

const FIXTURES = join(import.meta.dirname, "..", "fixtures");

function fixture(name: string): string {
  return readFileSync(join(FIXTURES, name), "utf8");
}

const CONTEXT = {
  pageTitle: "Three Inventions (Aubertin, Mireille)",
  pageid: null,
  url: "https://imslp.org/api.php?action=parse",
};

function readFull() {
  const outcome = parseWorkPage(fixture("work-full.html"), CONTEXT);
  if (outcome.kind !== "work") {
    throw new Error(`expected a work, read a ${outcome.kind}`);
  }
  return outcome.work;
}

describe("the facets of a work", () => {
  it("reads what the page states", () => {
    const work = readFull();

    expect(work).toMatchObject({
      title: "Three Inventions",
      page_title: "Three Inventions (Aubertin, Mireille)",
      page_url: "https://imslp.org/wiki/Three_Inventions_(Aubertin,_Mireille)",
      pageid: null,
      alternative_title: "Trois inventions",
      composer: "Aubertin, Mireille",
      composer_page_url: "https://imslp.org/wiki/Category:Aubertin,_Mireille",
      opus_catalogue_number: "Op.12",
      internal_catalogue_number: "MAI 12",
      composition_year: "ca.1899",
      first_publication: "1902",
      dedication: "à ma sœur",
      average_duration: "12 minutes",
      language: "French",
      composer_period: "Romantic",
      piece_style: "Romantic",
      instrumentation: "piano",
      movements: "3",
      source: "IMSLP",
      license: "CC BY-SA 4.0",
      redirected_from: null,
    });
  });

  it("keeps a date in the wording the page used", () => {
    // "ca.1899" is what the page says, and a year on its own would state a
    // certainty the page declined to state.
    expect(readFull().composition_year).toBe("ca.1899");
  });

  it("reads the genre categories the header lists", () => {
    expect(readFull().genre_categories).toEqual(["Nocturnes", "For piano"]);
  });

  it("reads an external link with the label it was given", () => {
    expect(readFull().external_links).toEqual([
      { label: "Composer page", url: "https://example.invalid/aubertin" },
    ]);
  });

  it("pairs an authority with the identifier it published", () => {
    // The page writes the name of a register as a link to the article
    // explaining it, then the identifier itself as a link to the register. Read
    // as two entries, half of an authority list points at encyclopedia pages.
    expect(readFull().authorities).toEqual([
      { authority: "WorldCat", id: null, url: "https://example.invalid/worldcat/1" },
      { authority: "VIAF", id: "900000", url: "https://example.invalid/viaf/900000" },
      { authority: "BNF", id: "12345678x", url: "https://example.invalid/bnf/12345678x" },
    ]);
  });

  it("drops an entry of that cell that links to nothing", () => {
    // The cell ends with a remark rather than a register on some pages, and a
    // remark is no record of the work anywhere.
    expect(readFull().authorities.map((entry) => entry.authority)).not.toContain(
      "see also the composer category",
    );
  });

  it("reads a facet the page left empty as absent", () => {
    const outcome = parseWorkPage(fixture("work-sparse.html"), {
      ...CONTEXT,
      pageTitle: "Petite pièce (Nadaud, Camille)",
    });
    if (outcome.kind !== "work") {
      throw new Error("expected a work");
    }

    expect(outcome.work.alternative_title).toBeNull();
    expect(outcome.work.opus_catalogue_number).toBeNull();
    expect(outcome.work.dedication).toBeNull();
  });

  it("reads an unassigned catalogue number as absent", () => {
    // The page prints "None" beside an editor-only assignment link, which says
    // the library has assigned none.
    const outcome = parseWorkPage(fixture("work-sparse.html"), CONTEXT);
    if (outcome.kind !== "work") {
      throw new Error("expected a work");
    }
    expect(outcome.work.internal_catalogue_number).toBeNull();
  });
});

describe("what a work says about copyright as a whole", () => {
  it("summarises the statements its editions carry, and counts each", () => {
    expect(readFull().copyright_summary).toEqual([
      {
        statement: "Public Domain - Non-PD US",
        headline: "Public Domain",
        restrictions: ["Non-PD US"],
        remark: null,
        reviewed_in: ["Canada", "United States", "European Union"],
        editions: 1,
      },
    ]);
  });
});

describe("the sections of a work", () => {
  it("counts each section as the page counts it", () => {
    expect(readFull().sections).toEqual([
      { name: "Recordings", files: 1 },
      { name: "Scores", files: 2 },
      { name: "Parts", files: 0 },
    ]);
  });
});

describe("the editions of a work", () => {
  it("groups the files of one edition under the metadata they share", () => {
    const editions = readFull().editions ?? [];
    expect(editions).toHaveLength(2);

    const scores = editions[1];
    expect(scores?.section).toBe("Scores");
    expect(scores?.publisher_info).toBe("Ville-Inventée: Éditions Nulle Part, n.d. (1902).");
    expect(scores?.editor).toBe("Aubertin, Mireille (1861-1934)");
    expect(scores?.misc_notes).toBe("Scanned at 600dpi.");
    expect(scores?.files.map((file) => file.imslp_id)).toEqual([900_002, 900_003]);
  });

  it("reads a copyright statement per jurisdiction", () => {
    const copyright = readFull().editions?.[1]?.copyright;

    expect(copyright).toEqual({
      statement: "Public Domain - Non-PD US",
      headline: "Public Domain",
      restrictions: ["Non-PD US"],
      remark: null,
      reviewed_in: ["Canada", "United States", "European Union"],
    });
  });

  it("tells a jurisdiction apart from a remark written beside the statement", () => {
    // Some editions carry "Public Domain - See notes on copyright status for
    // urtext editions". Counted as a jurisdiction, that reads as a country the
    // score is protected in, and there is no such country.
    const remarked = parseWorkPage(fixture("work-remarked-copyright.html"), CONTEXT);
    if (remarked.kind !== "work") {
      throw new Error("expected a work");
    }

    expect(remarked.work.copyright_summary[0]).toMatchObject({
      statement: "Public Domain - See notes on copyright status for urtext editions",
      headline: "Public Domain",
      restrictions: [],
      remark: "See notes on copyright status for urtext editions",
    });
  });

  it("keeps a remark and a jurisdiction apart when a statement holds both", () => {
    const work = readFull();

    expect(work.copyright_summary[0]).toMatchObject({
      restrictions: ["Non-PD US"],
      remark: null,
    });
  });

  it("drops the editor-only links printed beside a statement", () => {
    // The page prints "[tag/del]" for logged-in editors, which is a control
    // rather than part of what the statement says.
    expect(readFull().editions?.[1]?.copyright?.statement).not.toContain("tag");
  });

  it("leaves a recording without the metadata a score edition carries", () => {
    const recording = readFull().editions?.[0];

    expect(recording?.section).toBe("Recordings");
    expect(recording?.copyright).toBeNull();
    expect(recording?.publisher_info).toBeNull();
    expect(recording?.files).toHaveLength(1);
  });
});

describe("the files of an edition", () => {
  it("reads what the entry publishes about a file", () => {
    const file = readFull().editions?.[1]?.files[0];

    expect(file).toEqual({
      imslp_id: 900_002,
      description: "Complete Score",
      format: "PDF",
      format_code: "PDF",
      blocked: false,
      blocked_reason: null,
      size_bytes: 1_614_807,
      pages: 24,
      downloads: 1280,
      rating: { score: 7.5, votes: 4 },
      uploader: "Inventaire",
      uploaded_on: "2014-08-15",
      scanned_by_code: "ZZ-Q",
      scanned_by_name: "Bibliothèque inventée",
      page_url: "https://imslp.org/wiki/Three_Inventions_(Aubertin,_Mireille)",
    });
  });

  it("reads a rating nobody voted on as absent", () => {
    // The page prints 0.0 out of 10 next to a dash. Reported as a score, that
    // reads as the worst rating on the scale rather than as no rating at all.
    expect(readFull().editions?.[0]?.files[0]?.rating).toBeNull();
  });

  it("reads a counter the page prints nothing for as unknown", () => {
    const preview = readFull().editions?.[1]?.files[1];

    expect(preview?.downloads).toBeNull();
    expect(preview?.rating).toBeNull();
  });

  it("reads an entry that publishes nothing but its name", () => {
    const outcome = parseWorkPage(fixture("work-sparse.html"), CONTEXT);
    if (outcome.kind !== "work") {
      throw new Error("expected a work");
    }
    const file = outcome.work.editions?.[0]?.files[0];

    expect(file?.imslp_id).toBe(900_010);
    expect(file?.size_bytes).toBeNull();
    expect(file?.pages).toBeNull();
    expect(file?.uploader).toBeNull();
    expect(file?.uploaded_on).toBeNull();
    expect(file?.format).toBeNull();
    expect(file?.scanned_by_code).toBeNull();
    expect(file?.scanned_by_name).toBeNull();
  });

  it("never publishes an address under a path the site disallows", () => {
    const serialised = JSON.stringify(readFull());

    expect(serialised).not.toContain("/images/");
    expect(serialised).not.toContain("/imglnks/");
    expect(serialised).not.toContain("wiki/File:");
    expect(serialised).not.toContain("ImagefromIndex");
  });
});

describe("a file the library has blocked", () => {
  function blocked() {
    const outcome = parseWorkPage(fixture("work-blocked-file.html"), {
      ...CONTEXT,
      pageTitle: "Pièce bloquée (Nadaud, Camille)",
    });
    if (outcome.kind !== "work") {
      throw new Error("expected a work");
    }
    return outcome.work.editions[0]?.files[0];
  }

  it("reads its name, which the page states like any other", () => {
    // The library marks the state on the link rather than in a field, and a
    // reading that looked for the ordinary wording lost the name with it.
    expect(blocked()?.description).toBe("Complete Score");
    expect(blocked()?.pages).toBe(9);
  });

  it("says it is blocked, and why, in the library's own words", () => {
    // IMSLP has suspended access to this file while it reviews its copyright.
    // Served as an ordinary score, it would be reported as available.
    expect(blocked()?.blocked).toBe(true);
    expect(blocked()?.blocked_reason).toBe(
      "This file is currently blocked pending copyright review",
    );
  });

  it("says a file nobody blocked is not blocked", () => {
    const ordinary = readFull().editions[1]?.files[0];

    expect(ordinary?.blocked).toBe(false);
    expect(ordinary?.blocked_reason).toBeNull();
  });
});

describe("the format of a file", () => {
  it("keeps what the page wrote, and names the format it stands for", () => {
    // The library writes "PDF" on a score and "MP3 file" on a recording, so a
    // caller filtering on the published word finds one and misses the other.
    const recording = readFull().editions[0]?.files[0];
    const score = readFull().editions[1]?.files[0];

    expect(recording?.format).toBe("MP3 file");
    expect(recording?.format_code).toBe("MP3");
    expect(score?.format).toBe("PDF");
    expect(score?.format_code).toBe("PDF");
  });

  it("names no format for an entry the page gives none", () => {
    const outcome = parseWorkPage(fixture("work-sparse.html"), CONTEXT);
    if (outcome.kind !== "work") {
      throw new Error("expected a work");
    }
    const file = outcome.work.editions[0]?.files[0];

    expect(file?.format).toBeNull();
    expect(file?.format_code).toBeNull();
  });
});

describe("a page that stands for another", () => {
  it("names the page it redirects to", () => {
    const outcome = parseWorkPage(fixture("work-redirect.html"), CONTEXT);

    expect(outcome).toEqual({
      kind: "redirect",
      target: "Trois inventions, Op.12 (Aubertin, Mireille)",
    });
  });
});

describe("a page this parser cannot read", () => {
  it("reports the failure rather than an empty work", () => {
    expect(() => parseWorkPage(fixture("work-empty.html"), CONTEXT)).toThrowError(ImslpError);

    try {
      parseWorkPage(fixture("work-empty.html"), CONTEXT);
    } catch (error) {
      expect((error as ImslpError).code).toBe("parse_failure");
    }
  });
});
