/**
 * One request per route, against the library itself.
 *
 * This is what says whether IMSLP still publishes its pages the way this server
 * reads them. It reads pages a volunteer-run library pays for, so it is opt-in:
 * set IMSLP_LIVE=1. Everything here is asserted on the shape of an answer
 * rather than on its content, because the catalogue changes and a test that
 * pinned a number would fail on an edit rather than on a defect.
 */

import process from "node:process";
import { describe, expect, it } from "vitest";
import { ImslpClient } from "../../src/imslp/client.js";

const live = process.env.IMSLP_LIVE === "1";

/** One client for the suite, so its pacing applies across every route. */
const client = new ImslpClient();

/** A work the library has held for years, in many editions. */
const A_WORK = "Nocturnes, Op.9 (Chopin, Frédéric)";
const A_PERSON = "Category:Chopin, Frédéric";

describe.skipIf(!live)("the routes this server reads", () => {
  it("searches the works", async () => {
    const { data } = await client.search({ query: "nocturne", namespace: 0, limit: 3, offset: 0 });

    expect(data.rows.length).toBeGreaterThan(0);
    expect(data.rows[0]?.title).toBeTruthy();
  });

  it("searches the people", async () => {
    const { data } = await client.search({ query: "Chopin", namespace: 14, limit: 3, offset: 0 });

    expect(data.rows.length).toBeGreaterThan(0);
    expect(data.rows[0]?.title.startsWith("Category:")).toBe(true);
  });

  it("reads a work, its facets and its editions", async () => {
    const { data } = await client.getWork({ page: A_WORK });

    expect(data.title).toBeTruthy();
    expect(data.composer).toBe("Chopin, Frédéric");
    expect(data.editions.length).toBeGreaterThan(0);
    expect(data.sections.some((section) => section.files > 0)).toBe(true);
  });

  it("states the terms its scores are published under", async () => {
    const { data } = await client.getWork({ page: A_WORK });

    expect(data.copyright_summary.length).toBeGreaterThan(0);
    for (const terms of data.copyright_summary) {
      expect(terms.statement).toBeTruthy();
      expect(terms.reviewed_in).toContain("United States");
    }
  });

  it("reads a work again without asking the library twice", async () => {
    const second = await client.getWork({ page: A_WORK });

    expect(second.cached).toBe(true);
  });

  it("lists what a category holds", async () => {
    const { data } = await client.categoryMembers({ category: A_PERSON, limit: 5 });

    expect(data.members.length).toBeGreaterThan(0);
    expect(data.members[0]?.pageid).toBeGreaterThan(0);
  });

  it("reads a person", async () => {
    const { data } = await client.getPerson(A_PERSON);

    expect(data.name).toBeTruthy();
    expect(data.catalogued_as).toBe("Chopin, Frédéric");
  });

  it("browses a category of works", async () => {
    const { data } = await client.categoryMembers({ category: "For piano", limit: 3 });

    expect(data.members.length).toBeGreaterThan(0);
  });

  it("reports a work the library does not hold as an absence", async () => {
    await expect(client.getWork({ page: "Nothing At All (Nobody, Nemo)" })).rejects.toMatchObject({
      code: "not_found",
    });
  });
});
