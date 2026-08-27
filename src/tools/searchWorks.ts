/**
 * search_works: find the page of a work on IMSLP.
 */

import { z } from "zod";
import type { ImslpClient } from "../imslp/client.js";
import { splitWorkTitle, wikiPageUrl } from "../imslp/urls.js";
import {
  NO_COUNT_NOTE,
  ROWS_BY_DEFAULT,
  lastEdited,
  readSnippet,
  searchArguments,
  searchEnvelopeShape,
  snippetSchema,
} from "./search.js";
import { noteIfTextIsCut, ok, toToolError } from "./shared.js";
import type { ToolResult } from "./shared.js";
import { quotedNote } from "./work.js";

/** Works are catalogued in the main namespace of the wiki. */
const WORK_PAGES = 0;

export const searchWorksDescription = [
  "Search the works of IMSLP by title, by composer, or by words printed on their pages.",
  "Each row names the page of a work, which is how get_work and list_work_files address it: a",
  "title is written 'Work (Composer)', and the row splits it into the work and the person it",
  "names.",
  "IMSLP publishes no count of what a search matched, so 'total' is always null; 'has_more' and",
  "'next_offset' say whether the library held more rows and where to read on from.",
  "A snippet is words taken from the page around the match. The library writes its pages in",
  "wikitext, so a snippet sometimes shows the name of a file rather than a sentence, and some rows",
  "carry none at all.",
  "Searching for a person by name finds the works naming them; search_people finds the person.",
  "When you show a result to a user, credit IMSLP and link the page.",
].join(" ");

export const searchWorksInput = searchArguments("in the works of the library");

export const searchWorksOutputShape = {
  results: z.array(
    z.object({
      page: z.string().describe("The page title, which get_work takes as 'page'."),
      work: z.string().describe("The work, read off the title."),
      composer: z
        .string()
        .nullable()
        .describe("The person the title names, or null for a title written outside that form."),
      page_url: z.string(),
      snippet: snippetSchema,
      size_bytes: z.number().int().describe("The size of the page, as the library states it."),
      words: z.number().int().describe("Words on the page, as the library counts them."),
      last_edited: z.string().nullable().describe("The day the page last changed, as an ISO date."),
    }),
  ),
  ...searchEnvelopeShape,
};

export interface SearchWorksArgs {
  query: string;
  limit?: number;
  offset?: number;
}

export async function runSearchWorks(
  client: ImslpClient,
  args: SearchWorksArgs,
  signal?: AbortSignal,
): Promise<ToolResult> {
  try {
    const limit = args.limit ?? ROWS_BY_DEFAULT;
    const offset = args.offset ?? 0;
    const { data, cached } = await client.search(
      { query: args.query, namespace: WORK_PAGES, limit, offset },
      signal,
    );

    const results = data.rows.map((row) => {
      const { work, composer } = splitWorkTitle(row.title);
      return {
        page: row.title,
        work,
        composer,
        page_url: wikiPageUrl(row.title),
        snippet: readSnippet(row.snippet),
        size_bytes: row.size,
        words: row.wordcount,
        last_edited: lastEdited(row.timestamp),
      };
    });

    const notes = [NO_COUNT_NOTE];
    if (results.length === 0) {
      notes.unshift(
        `The library matched nothing for ${quotedNote(args.query)}. A search reads the pages ` +
          "themselves, so a composer written differently, or a title in another language, finds " +
          "nothing rather than something close.",
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
        query: args.query,
        results,
        returned: results.length,
        offset,
        limit,
        has_more: data.nextOffset !== null,
        next_offset: data.nextOffset,
        total: null,
        source: "IMSLP",
        license: "CC BY-SA 4.0",
        notes,
      },
      body === "" ? "No work matched." : body,
      notes,
    );
  } catch (error) {
    return toToolError(error);
  }
}
