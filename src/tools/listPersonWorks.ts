/**
 * list_person_works: read the works the library files under a person.
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

export const listPersonWorksDescription = [
  "Read the works IMSLP files under a person: what a composer wrote, and also what an editor,",
  "an arranger or a performer is credited on.",
  "The person is named by the category the library addresses them by, written",
  "'Category:Surname, Forename', which search_people finds. The prefix may be left out.",
  "IMSLP publishes no count of what a category holds, so 'total' is always null; 'has_more' and",
  "'cursor' say whether the library held more rows and how to read them.",
  "A category the library does not hold answers exactly as an empty one does, so an answer with no",
  "rows means one of the two rather than a person without works.",
  "When you show a work to a user, credit IMSLP and link the page.",
].join(" ");

export const listPersonWorksInput = strictInput({
  category: z
    .string()
    .min(1)
    .max(300)
    .describe(
      "The person's category, written 'Category:Surname, Forename', for example " +
        "'Category:Chopin, Frédéric'. The prefix is added when it is left out.",
    ),
  limit: listingLimit,
  cursor: listingCursor,
});

export const listPersonWorksOutputShape = {
  results: z.array(rowSchema),
  ...listingEnvelopeShape,
};

export interface ListPersonWorksArgs {
  category: string;
  limit?: number;
  cursor?: string;
}

export async function runListPersonWorks(
  client: ImslpClient,
  args: ListPersonWorksArgs,
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
    const notes = [NO_COUNT_NOTE];
    if (results.length === 0) {
      notes.unshift(
        `${quotedNote(withPrefix(args.category))} holds no work here. The library writes a name ` +
          "surname first, and answers a category it does not hold exactly as it answers an empty " +
          "one, so check the spelling with search_people before reading this as a person without " +
          "works.",
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
