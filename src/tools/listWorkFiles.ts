/**
 * list_work_files: page through the editions a work page holds.
 */

import { z } from "zod";
import { invalidInput } from "../errors.js";
import type { ImslpClient } from "../imslp/client.js";
import type { Copyright, Edition, Work } from "../types.js";
import { strictInput } from "./arguments.js";
import { editionSchema, pageTarget, quotedNote } from "./work.js";
import { noteIfTextIsCut, ok, quotedBlock, toToolError } from "./shared.js";
import type { ToolResult } from "./shared.js";

/** Editions served when a caller names no number. */
const EDITIONS_BY_DEFAULT = 10;

export const listWorkFilesDescription = [
  "Read the scores and recordings a work on IMSLP holds, edition by edition.",
  "An edition is a set of files published under one set of terms: the publisher, the editor and",
  "the copyright statement belong to the edition, and its files are the entries under it. A block",
  "of recordings carries performers instead, and no copyright statement at all.",
  "Address the work by its page title, written 'Work (Composer)', or by its page id, and read it a",
  "page at a time with 'limit' and 'offset'. 'editions_on_page' counts the editions the page",
  "holds, so it says how far a reading can go.",
  "Restrict to one part of the page with 'section', using the names the page itself prints:",
  "'Scores', 'Parts', 'Arrangements and Transcriptions', 'Recordings', 'Full Scores' and others.",
  "A restriction matching nothing comes back with the sections the page does hold rather than as a",
  "work without scores.",
  "The copyright of a score is stated per jurisdiction: 'Public Domain - Non-PD US' is free in",
  "Canada and the European Union and protected in the United States, so never report a score as",
  "public domain without saying where.",
  "No score file is downloaded or linked; the work page is what an answer links to.",
  "When you show an edition to a user, credit IMSLP and link that page.",
].join(" ");

export const listWorkFilesInput = strictInput({
  page: z
    .string()
    .min(1)
    .max(300)
    .optional()
    .describe(
      "The title of the work's page, written 'Work (Composer)', for example " +
        "'Nocturnes, Op.9 (Chopin, Frédéric)'. Pass this or 'pageid', not both.",
    ),
  pageid: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("The page id a search returns. Pass this or 'page', not both."),
  section: z
    .string()
    .min(1)
    .max(80)
    .optional()
    .describe(
      "One section of the page, in the wording the page prints: 'Scores', 'Parts', 'Recordings', " +
        "'Arrangements and Transcriptions', 'Full Scores', 'Synthesized/MIDI'. Matched without " +
        "regard to case. Left out, every section is read.",
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(EDITIONS_BY_DEFAULT)
    .describe("Editions to serve, from 1 to 100."),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Editions to skip, for reading a work whose page holds many."),
});

export const listWorkFilesOutputShape = {
  page_title: z.string(),
  page_url: z.string(),
  pageid: z.number().int().nullable(),
  title: z.string().describe("The work these editions belong to."),
  composer: z.string().nullable(),
  section: z.string().nullable().describe("The restriction this answer was read under."),
  sections: z
    .array(z.object({ name: z.string(), files: z.number().int() }))
    .describe("The sections of the page, with the number of entries the site counts in each."),
  editions: z.array(editionSchema),
  editions_on_page: z
    .number()
    .int()
    .describe("Editions the page holds, counted here rather than published by IMSLP."),
  editions_in_section: z
    .number()
    .int()
    .describe("Editions left after the restriction, equal to 'editions_on_page' without one."),
  offset: z.number().int(),
  limit: z.number().int(),
  returned: z.number().int(),
  has_more: z.boolean(),
  redirected_from: z.string().nullable(),
  source: z.literal("IMSLP"),
  license: z.literal("CC BY-SA 4.0"),
  notes: z.array(z.string()),
};

export interface ListWorkFilesArgs {
  page?: string;
  pageid?: number;
  section?: string;
  limit?: number;
  offset?: number;
}

/**
 * The editions of one section, matched on the wording the page prints.
 *
 * The library names its sections freely, and a page carries "Full Scores" where
 * another carries "Scores", so a restriction is matched against what this page
 * says rather than against a list this server keeps.
 */
function inSection(editions: Edition[], section: string | undefined): Edition[] {
  if (section === undefined) {
    return editions;
  }
  const wanted = section.trim().toLowerCase();
  return editions.filter((edition) => edition.section.toLowerCase() === wanted);
}

function noteworthy(
  work: Work,
  served: Edition[],
  asked: { section: string | undefined; offset: number; inSection: number },
  cached: boolean,
): string[] {
  const notes: string[] = [];

  if (work.redirected_from !== null) {
    notes.push(
      `"${work.redirected_from}" is a redirect on IMSLP, and these are the editions of the page ` +
        "it stands for.",
    );
  }

  if (work.editions.length === 0) {
    notes.push("This work page holds no score and no recording, which is what the page says.");
  } else if (asked.section !== undefined && asked.inSection === 0) {
    // Read off the editions rather than off the tab bar: these are the sections
    // a restriction can actually match, and the page holds at least one of them
    // wherever it holds an edition at all.
    const held = [...new Set(work.editions.map((edition) => edition.section))].join(", ");
    notes.push(
      `No edition of this page sits in a section named ${quotedNote(asked.section)}. ` +
        `The page holds: ${held}.`,
    );
  } else if (served.length === 0 && asked.offset > 0) {
    notes.push(
      `The reading started past the last edition: ${asked.inSection} were available and ` +
        `${asked.offset} were skipped.`,
    );
  }

  const restricted = new Set(served.flatMap((edition) => edition.copyright?.restrictions ?? []));
  if (restricted.size > 0) {
    notes.push(
      `Some editions here are not free everywhere: ${[...restricted].join(", ")}. IMSLP reviews ` +
        "Canada, the United States and the European Union, and says nothing about anywhere else.",
    );
  }

  const remarked = served.filter((edition) => edition.copyright?.remark != null).length;
  if (remarked > 0) {
    notes.push(
      `Editions here qualifying their terms with a remark of the library's own: ${remarked}. ` +
        "Each remark is carried on 'copyright.remark'.",
    );
  }

  if (cached) {
    notes.push("Served from this server's short-lived in-memory cache.");
  }
  return notes;
}

function asText(work: Work, served: Edition[], span: { offset: number; total: number }): string {
  const lines = [
    work.composer === null ? work.title : `${work.title} — ${work.composer}`,
    work.page_url,
    served.length === 0
      ? "No edition served."
      : `Editions ${span.offset + 1}-${span.offset + served.length} of ${span.total}`,
  ];

  for (const edition of served) {
    lines.push("", editionAsText(edition));
  }
  return lines.join("\n");
}

function editionAsText(edition: Edition): string {
  const head = [
    edition.publisher_info,
    edition.editor === null ? null : `ed. ${edition.editor}`,
    edition.performers === null ? null : `perf. ${edition.performers}`,
    edition.copyright === null ? null : copyrightAsText(edition.copyright),
  ]
    .filter((part): part is string => part !== null)
    .join(" — ");

  const files = edition.files.map(
    (file) =>
      `  #${file.imslp_id} ${file.description}` +
      `${file.format === null ? "" : ` [${file.format}]`}` +
      `${file.pages === null ? "" : `, ${file.pages} pp.`}` +
      `${file.downloads === null ? "" : `, ${file.downloads} downloads`}`,
  );

  const body = [`${edition.section}${head === "" ? "" : `: ${head}`}`, ...files].join("\n");
  return edition.misc_notes === null
    ? body
    : `${body}\n${quotedBlock("  Note from the edition:", edition.misc_notes)}`;
}

function copyrightAsText(copyright: Copyright): string {
  const place =
    copyright.restrictions.length === 0
      ? copyright.headline
      : `${copyright.headline} (not in ${copyright.restrictions.join(", ")})`;
  return copyright.remark === null ? place : `${place} [${copyright.remark}]`;
}

export async function runListWorkFiles(
  client: ImslpClient,
  args: ListWorkFilesArgs,
  signal?: AbortSignal,
): Promise<ToolResult> {
  try {
    const limit = args.limit ?? EDITIONS_BY_DEFAULT;
    const offset = args.offset ?? 0;
    const { data, cached } = await client.getWork(pageTarget(args, invalidInput), signal);

    const matching = inSection(data.editions, args.section);
    const served = matching.slice(offset, offset + limit);

    const notes = noteworthy(
      data,
      served,
      { section: args.section, offset, inSection: matching.length },
      cached,
    );
    const text = asText(data, served, { offset, total: matching.length });
    noteIfTextIsCut(text, notes);

    return ok(
      {
        page_title: data.page_title,
        page_url: data.page_url,
        pageid: data.pageid,
        title: data.title,
        composer: data.composer,
        section: args.section ?? null,
        sections: data.sections,
        editions: served,
        editions_on_page: data.editions.length,
        editions_in_section: matching.length,
        offset,
        limit,
        returned: served.length,
        has_more: offset + served.length < matching.length,
        redirected_from: data.redirected_from,
        source: data.source,
        license: data.license,
        notes,
      },
      text,
      notes,
    );
  } catch (error) {
    return toToolError(error);
  }
}
