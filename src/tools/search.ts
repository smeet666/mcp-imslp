/**
 * What the two searches share.
 *
 * Both read the same route over a different namespace, and both answer the same
 * way about what they could not say: IMSLP publishes no count of what a search
 * matched, so neither ever states one.
 */

import { z } from "zod";
import { text } from "../imslp/html.js";
import { strictInput } from "./arguments.js";

/** Rows served when a caller names no number. */
export const ROWS_BY_DEFAULT = 10;

export const NO_COUNT_NOTE =
  "IMSLP publishes no count of what a search matched, whatever is asked of it, so 'total' is " +
  "null rather than a figure this server worked out. Read 'has_more' to know whether the library " +
  "held more rows than these.";

export function searchArguments(subject: string) {
  return strictInput({
    query: z
      .string()
      .min(1)
      .max(300)
      .describe(`What to look for ${subject}. Words are matched across the page, not only titles.`),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(ROWS_BY_DEFAULT)
      .describe("Rows to serve, from 1 to 50."),
    offset: z
      .number()
      .int()
      .min(0)
      .default(0)
      .describe("Rows to skip, using the 'next_offset' a previous answer named."),
  });
}

/** The fields every search answer carries, whatever it searched. */
export const searchEnvelopeShape = {
  query: z.string().describe("The search as it reached the library."),
  returned: z.number().int(),
  offset: z.number().int(),
  limit: z.number().int(),
  has_more: z.boolean().describe("True when the library named an offset to continue from."),
  next_offset: z
    .number()
    .int()
    .nullable()
    .describe("The offset to read on from, as the library named it. Null when it named none."),
  total: z.null().describe("Always null: IMSLP publishes no count of what a search matched."),
  source: z.literal("IMSLP"),
  license: z.literal("CC BY-SA 4.0"),
  notes: z.array(z.string()),
};

export const snippetSchema = z
  .string()
  .nullable()
  .describe(
    "Words from the page around the match, as published and free of markup. Null on a row the " +
      "search summarised with nothing. The library writes its pages in wikitext, so a snippet " +
      "sometimes shows the name of a file rather than a sentence.",
  );

/**
 * A snippet as words.
 *
 * The search wraps the matched words in markup and quotes the wikitext around
 * them, so what arrives is not a sentence until the markup is gone. A row the
 * search summarised with nothing has no snippet rather than an empty one.
 */
export function readSnippet(snippet: string): string | null {
  const words = text(snippet);
  return words === "" ? null : words;
}

/** The day an ISO timestamp opens with. */
const A_DAY = /^(\d{4}-\d{2}-\d{2})/;

/** An ISO timestamp as the day it names. */
export function lastEdited(timestamp: string): string | null {
  return A_DAY.exec(timestamp)?.[1] ?? null;
}
