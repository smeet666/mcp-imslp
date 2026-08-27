/**
 * browse_category: read the works the library files under a category.
 */

import { z } from "zod";
import type { ImslpClient } from "../imslp/client.js";
import {
  NO_COUNT_NOTE,
  ROWS_BY_DEFAULT,
  listingCursor,
  listingEnvelopeShape,
  listingLimit,
  readMembers,
  rowSchema,
  withPrefix,
} from "./category.js";
import { strictInput } from "./arguments.js";
import { noteIfTextIsCut, ok, toToolError } from "./shared.js";
import type { ToolResult } from "./shared.js";
import { quotedNote } from "./work.js";

/**
 * What the library cannot be asked.
 *
 * Its search offers no way to cross two categories, so "nocturnes for piano" is
 * a question this server can only answer half of. Saying so beats letting a
 * caller read the members of one category as the answer to both.
 */
const ONE_AT_A_TIME_NOTE =
  "The library reads one category at a time and cannot cross two, so a question like 'nocturnes " +
  "for piano' is answered by browsing one of them and reading the works of the other off each " +
  "page with get_work.";

export const browseCategoryDescription = [
  "Read the works IMSLP files under a category: a genre, a key, an instrumentation or a period.",
  "The library writes these names itself, and get_work hands them back for a work under",
  "'genre_categories': 'Nocturnes', 'For piano', 'Scores featuring the piano', 'B-flat minor'.",
  "Pass one of those rather than a name of your own, since a category the library does not hold",
  "answers exactly as an empty one does. The 'Category:' prefix may be left out.",
  "The library cannot cross two categories, so a question naming both a genre and an instrument is",
  "answered by browsing one and reading the other off each work.",
  "IMSLP publishes no count of what a category holds, so 'total' is always null; 'has_more' and",
  "'cursor' say whether more rows remain and how to read them.",
  "When you show a work to a user, credit IMSLP and link the page.",
].join(" ");

export const browseCategoryInput = strictInput({
  category: z
    .string()
    .min(1)
    .max(300)
    .describe(
      "The category to read, in the library's own wording, for example 'For piano', 'Nocturnes' " +
        "or 'Category:B-flat minor'. The prefix is added when it is left out.",
    ),
  limit: listingLimit,
  cursor: listingCursor,
});

export const browseCategoryOutputShape = {
  results: z.array(rowSchema),
  ...listingEnvelopeShape,
};

export interface BrowseCategoryArgs {
  category: string;
  limit?: number;
  cursor?: string;
}

export async function runBrowseCategory(
  client: ImslpClient,
  args: BrowseCategoryArgs,
  signal?: AbortSignal,
): Promise<ToolResult> {
  try {
    const limit = args.limit ?? ROWS_BY_DEFAULT;
    const { data, cached } = await client.categoryMembers(
      {
        category: args.category,
        limit,
        ...(args.cursor === undefined ? {} : { cursor: args.cursor }),
      },
      signal,
    );

    const results = readMembers(data.members);
    const notes = [ONE_AT_A_TIME_NOTE, NO_COUNT_NOTE];
    if (results.length === 0) {
      notes.unshift(
        `${quotedNote(withPrefix(args.category))} holds no work here. The library writes its own ` +
          "category names and answers one it does not hold exactly as it answers an empty one, so " +
          "read a work with get_work and browse a name it lists under 'genre_categories'.",
      );
    }
    if (cached) {
      notes.push("Served from this server's short-lived in-memory cache.");
    }

    const body = results
      .map(
        (row) => `${row.work}${row.composer === null ? "" : ` — ${row.composer}`}\n${row.page_url}`,
      )
      .join("\n\n");
    noteIfTextIsCut(body, notes);

    return ok(
      {
        category: withPrefix(args.category),
        results,
        returned: results.length,
        limit,
        has_more: data.cursor !== null,
        cursor: data.cursor,
        total: null,
        source: "IMSLP",
        license: "CC BY-SA 4.0",
        notes,
      },
      body === "" ? "No work under this category." : body,
      notes,
    );
  } catch (error) {
    return toToolError(error);
  }
}
