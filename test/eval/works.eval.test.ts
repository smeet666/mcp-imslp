/**
 * Works nobody chose, held to what every answer must satisfy.
 *
 * The live suite reads pages this repository picked, so it cannot see a reading
 * that works on those and breaks on the rest of a catalogue of a quarter of a
 * million works. This draws works at random and asserts the properties an
 * answer has to have whatever page it came from.
 *
 * It reads pages a volunteer-run library pays for, so it is opt-in: set
 * IMSLP_EVAL=1, and IMSLP_EVAL_DRAWS to say how many works to draw.
 */

import process from "node:process";
import { describe, expect, it } from "vitest";
import { ImslpClient } from "../../src/imslp/client.js";
import type { Edition, Work, WorkFile } from "../../src/types.js";
import { PKG_VERSION, REPO_URL } from "../../src/version.js";

const evaluating = process.env.IMSLP_EVAL === "1";
const draws = Number(process.env.IMSLP_EVAL_DRAWS ?? "5");

/** The end of the works listing, measured rather than guessed. */
const WORKS_IN_THE_LISTING = 250_000;
const LISTING_PAGE = 1000;

const client = new ImslpClient();

/**
 * A page of the listing the library documents, read here rather than through
 * the client: drawing a work is what a test does, not what a tool offers.
 */
async function drawTitles(count: number): Promise<string[]> {
  const start = Math.floor(Math.random() * (WORKS_IN_THE_LISTING - LISTING_PAGE));
  const url =
    "https://imslp.org/imslpscripts/API.ISCR.php?account=worklist/" +
    `disclaimer=accepted/sort=id/type=2/start=${start}/retformat=json`;
  const answer = await fetch(url, {
    headers: { "User-Agent": `mcp-imslp v${PKG_VERSION} (${REPO_URL})` },
  });
  const payload = (await answer.json()) as Record<string, { id?: string }>;
  const titles = Object.entries(payload)
    .filter(([key]) => key !== "metadata")
    .map(([, row]) => row.id)
    .filter((id): id is string => typeof id === "string");

  const drawn: string[] = [];
  while (drawn.length < count && titles.length > 0) {
    const [taken] = titles.splice(Math.floor(Math.random() * titles.length), 1);
    if (taken !== undefined) {
      drawn.push(taken);
    }
  }
  return drawn;
}

/** What the pages of the library never print inside a value of an answer. */
const INTERFACE = /\[tag\/|force assignment|Javascript is required|searchmatch|<span|<div/;
/** The paths the robots.txt of IMSLP disallows, which no answer may carry. */
const DISALLOWED = /\/images\/|\/imglnks\/|wiki\/File:|ImagefromIndex/;

/** Every value of a work, held to what a value of an answer may hold. */
function statesWordsRatherThanInterface(work: Work, title: string): void {
  for (const [field, value] of Object.entries(work)) {
    if (typeof value === "string") {
      expect(value, `${title}: ${field} carries interface rather than words`).not.toMatch(
        INTERFACE,
      );
    }
  }
}

/** Every file of an edition, held to what a file has to state about itself. */
function statesWhatAFileMustState(file: WorkFile, title: string): void {
  expect(file.description, `${title}: file ${file.imslp_id} is named`).toBeTruthy();
  expect(file.imslp_id, `${title}: a file carries its number`).toBeGreaterThan(0);
  expect(file.page_url, `${title}: a file links to the work page`).toContain(
    "https://imslp.org/wiki/",
  );
  if (file.format !== null) {
    expect(file.format_code, `${title}: a format states its code`).toBeTruthy();
  }
  if (file.blocked) {
    expect(file.blocked_reason, `${title}: a blocked file says why`).toBeTruthy();
  }
}

/** Every edition of a work, held to what an edition may claim. */
function statesWhatAnEditionMayClaim(edition: Edition, title: string): void {
  expect(edition.section, `${title}: an edition names its section`).toBeTruthy();
  for (const restriction of edition.copyright?.restrictions ?? []) {
    expect(restriction, `${title}: a restriction names a place`).toMatch(/^(Non-PD|PML-)/);
  }
  for (const file of edition.files) {
    statesWhatAFileMustState(file, title);
  }
}

describe.skipIf(!evaluating)("works drawn from the catalogue", () => {
  it("answer the properties every work has to satisfy", async () => {
    const titles = await drawTitles(draws);
    expect(titles.length).toBeGreaterThan(0);

    for (const title of titles) {
      const { data } = await client.getWork({ page: title });

      expect(data.title, `${title}: a work states a title`).toBeTruthy();
      expect(JSON.stringify(data), `${title}: no address under a disallowed path`).not.toMatch(
        DISALLOWED,
      );
      statesWordsRatherThanInterface(data, title);

      for (const edition of data.editions) {
        statesWhatAnEditionMayClaim(edition, title);
      }
    }
  }, 300_000);
});
