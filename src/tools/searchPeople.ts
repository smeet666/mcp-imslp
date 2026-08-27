/**
 * search_people: find the category a person is addressed by on IMSLP.
 */

import { z } from "zod";
import type { ImslpClient } from "../imslp/client.js";
import { text } from "../imslp/html.js";
import { wikiPageUrl } from "../imslp/urls.js";
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

/** People are catalogued as categories of the wiki. */
const PERSON_CATEGORIES = 14;

const CATEGORY_PREFIX = /^Category:/;
const REDIRECTS_TO = /#REDIRECT\s*\[\[:?([^\]]+)\]\]/i;

export const searchPeopleDescription = [
  "Find the composers, editors, arrangers and performers of IMSLP by name.",
  "The library addresses a person by a category, written 'Category:Surname, Forename', and that",
  "is what list_person_works and get_person take. A name is written the library's own way, so",
  "searching finds it where guessing at the spelling does not.",
  "Some rows stand for another category rather than for a person: the library keeps a redirect for",
  "a name spelled differently, and 'redirect_to' names the category it leads to. Follow it rather",
  "than reading works under the redirect, which holds none.",
  "IMSLP publishes no count of what a search matched, so 'total' is always null.",
  "When you show a person to a user, credit IMSLP and link the page.",
].join(" ");

export const searchPeopleInput = searchArguments("among the people of the library");

export const searchPeopleOutputShape = {
  results: z.array(
    z.object({
      category: z
        .string()
        .describe("The category the person is addressed by, which list_person_works takes."),
      name: z.string().describe("The name as the library writes it, without the category prefix."),
      page_url: z.string(),
      snippet: snippetSchema,
      redirect_to: z
        .string()
        .nullable()
        .describe(
          "The category this row stands for, when it is a redirect rather than a person. Null " +
            "for a row that is the person's own category.",
        ),
      last_edited: z.string().nullable().describe("The day the page last changed, as an ISO date."),
    }),
  ),
  ...searchEnvelopeShape,
};

export interface SearchPeopleArgs {
  query: string;
  limit?: number;
  offset?: number;
}

export async function runSearchPeople(
  client: ImslpClient,
  args: SearchPeopleArgs,
  signal?: AbortSignal,
): Promise<ToolResult> {
  try {
    const limit = args.limit ?? ROWS_BY_DEFAULT;
    const offset = args.offset ?? 0;
    const { data, cached } = await client.search(
      { query: args.query, namespace: PERSON_CATEGORIES, limit, offset },
      signal,
    );

    const results = data.rows.map((row) => ({
      category: row.title,
      name: row.title.replace(CATEGORY_PREFIX, ""),
      page_url: wikiPageUrl(row.title),
      snippet: readSnippet(row.snippet),
      // Read off the words rather than off the snippet as served: the search
      // wraps the words it matched, and a target read through that markup names
      // a category nobody could look up.
      redirect_to: REDIRECTS_TO.exec(text(row.snippet))?.[1]?.trim() ?? null,
      last_edited: lastEdited(row.timestamp),
    }));

    const notes = [NO_COUNT_NOTE];
    const redirects = results.filter((row) => row.redirect_to !== null).length;
    if (redirects > 0) {
      notes.unshift(
        `Rows here that are a redirect rather than a person: ${redirects}. Each names the ` +
          "category it stands for under 'redirect_to', and holds no works of its own.",
      );
    }
    if (results.length === 0) {
      notes.unshift(
        `The library matched no person for ${quotedNote(args.query)}. It writes a name its own ` +
          "way, surname first, so a forename alone or another spelling finds nothing.",
      );
    }
    if (cached) {
      notes.push("Served from this server's short-lived in-memory cache.");
    }

    const body = results
      .map(
        (row) =>
          `${row.name}${row.redirect_to === null ? "" : ` → ${row.redirect_to}`}\n${row.page_url}`,
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
      body === "" ? "No person matched." : body,
      notes,
    );
  } catch (error) {
    return toToolError(error);
  }
}
