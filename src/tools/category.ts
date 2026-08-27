/**
 * What the two listings of a category share.
 *
 * Both read the same route, and both answer the same way about what they cannot
 * say: IMSLP publishes no count of the members a category holds, and it
 * continues a listing with an opaque cursor rather than with an offset.
 */

import { z } from "zod";
import { splitWorkTitle, wikiPageUrl } from "../imslp/urls.js";
import type { CategoryMember } from "../types.js";

/** Rows served when a caller names no number. */
export const ROWS_BY_DEFAULT = 25;

export const NO_COUNT_NOTE =
  "IMSLP publishes no count of what a category holds, so 'total' is null rather than a figure " +
  "this server worked out. Read 'has_more' to know whether the library held more rows, and pass " +
  "'cursor' back to read them.";

export const listingLimit = z
  .number()
  .int()
  .min(1)
  .max(100)
  .default(ROWS_BY_DEFAULT)
  .describe("Rows to serve, from 1 to 100.");

export const listingCursor = z
  .string()
  .min(1)
  .max(500)
  .optional()
  .describe(
    "The 'cursor' a previous answer named, to read on from where it stopped. The library writes " +
      "it itself, so it is passed back as it was given rather than built.",
  );

export const rowSchema = z.object({
  page: z.string().describe("The page title, which get_work takes as 'page'."),
  work: z.string().describe("The work, read off the title."),
  composer: z
    .string()
    .nullable()
    .describe("The person the title names, or null for a title written outside that form."),
  pageid: z.number().int().describe("The page id, which get_work also takes."),
  page_url: z.string(),
});

/** The fields every listing carries, whatever it listed. */
export const listingEnvelopeShape = {
  category: z.string().describe("The category as it reached the library, prefix included."),
  returned: z.number().int(),
  limit: z.number().int(),
  has_more: z.boolean().describe("True when the library named a cursor to continue from."),
  cursor: z
    .string()
    .nullable()
    .describe("The cursor to read on from, as the library named it. Null when it named none."),
  total: z.null().describe("Always null: IMSLP publishes no count of what a category holds."),
  source: z.literal("IMSLP"),
  license: z.literal("CC BY-SA 4.0"),
  notes: z.array(z.string()),
};

export function readMembers(members: CategoryMember[]) {
  return members.map((member) => {
    const { work, composer } = splitWorkTitle(member.title);
    return {
      page: member.title,
      work,
      composer,
      pageid: member.pageid,
      page_url: wikiPageUrl(member.title),
    };
  });
}

/** The category as the library addresses it, prefix included. */
export function withPrefix(category: string): string {
  const named = category.trim();
  return named.startsWith("Category:") ? named : `Category:${named}`;
}
