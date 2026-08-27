/**
 * get_work: read one work of the Petrucci Music Library.
 */

import { z } from "zod";
import type { ImslpClient } from "../imslp/client.js";
import { invalidInput } from "../errors.js";
import type { Copyright, Edition, Work } from "../types.js";
import { strictInput } from "./arguments.js";
import { copyrightSchema, editionSchema, pageTarget } from "./work.js";
import { noteIfTextIsCut, ok, quotedBlock, toToolError } from "./shared.js";
import type { ToolResult } from "./shared.js";

/**
 * The most editions one answer carries.
 *
 * A work of the library runs from one file to a few hundred, and the median
 * work holds one: including the editions answers the ordinary question in a
 * single call, and a heavily edited work is handed to the tool that pages
 * through them rather than being cut without saying so.
 */
export const EDITIONS_IN_AN_ANSWER = 5;

export const getWorkDescription = [
  "Read one work on IMSLP: its title and alternative titles, the composer, the opus and catalogue",
  "numbers, the year it was written and the year it was first published, the dedication, the key,",
  "the instrumentation, the style and period, and how many scores and recordings the page holds.",
  "Address a work by its page title, written 'Work (Composer)', for example",
  "'Nocturnes, Op.9 (Chopin, Frédéric)', or by the page id.",
  "Dates and durations come back in the wording the page used: 'ca.1830' stays 'ca.1830', because",
  "a bare year would state a certainty the library declined to state. A facet the page leaves empty",
  "comes back null rather than guessed.",
  "A work holding a few editions comes back with them, files included. One holding many comes back",
  "with 'editions' null and 'editions_truncated' true, and list_work_files pages through them.",
  "The copyright of a score is stated per jurisdiction: 'Public Domain - Non-PD US' is free in",
  "Canada and the European Union and protected in the United States, so never report a score as",
  "public domain without saying where.",
  "No score file is downloaded or linked; the work page is what an answer links to.",
  "When you show a work to a user, credit IMSLP and link that page.",
].join(" ");

export const getWorkInput = strictInput({
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
});

const linkSchema = z.object({ label: z.string(), url: z.string() });

export const getWorkOutputShape = {
  title: z.string(),
  page_title: z.string(),
  page_url: z.string(),
  pageid: z
    .number()
    .int()
    .nullable()
    .describe(
      "The number IMSLP gives the page. Known when the work was addressed by it, and null when " +
        "it was addressed by title: a rendered page states its title and nothing else.",
    ),
  alternative_title: z.string().nullable(),
  composer: z.string().nullable(),
  composer_page_url: z.string().nullable(),
  opus_catalogue_number: z.string().nullable(),
  internal_catalogue_number: z.string().nullable(),
  composition_year: z.string().nullable().describe("As published, for example 'ca.1830'."),
  first_publication: z.string().nullable(),
  dedication: z.string().nullable(),
  average_duration: z.string().nullable(),
  key: z.string().nullable(),
  language: z.string().nullable(),
  librettist: z.string().nullable(),
  composer_period: z.string().nullable(),
  piece_style: z.string().nullable(),
  instrumentation: z.string().nullable(),
  movements: z.string().nullable(),
  first_performance: z.string().nullable(),
  extra_information: z.string().nullable(),
  genre_categories: z.array(z.string()),
  external_links: z.array(linkSchema),
  authorities: z
    .array(
      z.object({
        authority: z.string().describe("The register, for example 'VIAF' or 'BNF'."),
        id: z.string().nullable().describe("The identifier in that register, when it names one."),
        url: z.string(),
      }),
    )
    .describe("Records of the work in library catalogues: VIAF, LCCN, WorldCat, BNF, GND."),
  copyright_summary: z
    .array(copyrightSchema.extend({ editions: z.number().int() }))
    .describe(
      "The terms the scores of this work are published under, one entry per distinct statement, " +
        "with the number of editions on the page carrying it. Stated whether or not the editions " +
        "themselves fit in this answer.",
    ),
  sections: z
    .array(z.object({ name: z.string(), files: z.number().int() }))
    .describe("The sections of the page, with the number of entries the site counts in each."),
  editions: z
    .array(editionSchema)
    .nullable()
    .describe(
      "Every edition the page holds, files included. Null when the work holds more of them than " +
        "one answer carries, and list_work_files then pages through them.",
    ),
  editions_truncated: z.boolean(),
  redirected_from: z.string().nullable().describe("The title asked for, when it redirected here."),
  source: z.literal("IMSLP"),
  license: z.literal("CC BY-SA 4.0"),
  notes: z.array(z.string()),
};

export interface GetWorkArgs {
  page?: string;
  pageid?: number;
}

/** What a caller has to know about an answer, beyond the answer itself. */
function noteworthy(work: Work, truncated: boolean, cached: boolean): string[] {
  const notes: string[] = [];

  if (work.redirected_from !== null) {
    notes.push(
      `"${work.redirected_from}" is a redirect on IMSLP, and this is the page it stands for.`,
    );
  }

  if (truncated) {
    const entries = work.sections.reduce((total, section) => total + section.files, 0);
    notes.push(
      `This work holds ${work.editions.length} editions, more than one answer carries, so ` +
        `'editions' is null here. The page counts ${entries} entries across its sections; call ` +
        "list_work_files with the same page to read them.",
    );
  }

  const suspended = work.editions
    .flatMap((edition) => edition.files)
    .filter((file) => file.blocked).length;
  if (suspended > 0) {
    notes.push(
      `Files of this work the library has suspended access to: ${suspended}. IMSLP blocks a file ` +
        "while it reviews its copyright, so it is catalogued and not available.",
    );
  }

  const restricted = new Set(work.copyright_summary.flatMap((terms) => terms.restrictions));
  if (restricted.size > 0) {
    notes.push(
      `Some editions here are not free everywhere: ${[...restricted].join(", ")}. IMSLP reviews ` +
        "Canada, the United States and the European Union, and says nothing about anywhere else.",
    );
  }

  if (work.editions.length === 0 && work.sections.every((section) => section.files === 0)) {
    notes.push("This work page holds no score and no recording, which is what the page says.");
  }

  if (cached) {
    notes.push("Served from this server's short-lived in-memory cache.");
  }
  return notes;
}

/**
 * The answer as a block of text, for a client that renders nothing else.
 *
 * The work is read for its facets and the answer for its editions, so a
 * truncated answer prints the facets of the work and none of the editions it
 * did not carry.
 */
function asText(answered: { editions: Edition[] | null }, work: Work): string {
  const lines = [
    work.composer === null ? work.title : `${work.title} — ${work.composer}`,
    work.page_url,
  ];

  const facets: [string, string | null][] = [
    ["Opus", work.opus_catalogue_number],
    ["Composed", work.composition_year],
    ["First published", work.first_publication],
    ["Key", work.key],
    ["Instrumentation", work.instrumentation],
    ["Style", work.piece_style],
    ["Duration", work.average_duration],
    ["Dedication", work.dedication],
  ];
  for (const [label, value] of facets) {
    if (value !== null) {
      lines.push(`${label}: ${value}`);
    }
  }

  const sections = work.sections
    .filter((section) => section.files > 0)
    .map((section) => `${section.name}: ${section.files}`)
    .join(", ");
  lines.push(sections === "" ? "No score or recording on this page." : sections);

  // The terms are printed whether or not the editions themselves are here, so a
  // reader of the text block never sees a work whose scores say nothing about
  // where they are free.
  for (const terms of work.copyright_summary) {
    lines.push(
      `Terms (${terms.editions} edition${terms.editions === 1 ? "" : "s"}): ` +
        copyrightAsText(terms),
    );
  }

  for (const each of answered.editions ?? []) {
    lines.push("", editionAsText(each));
  }
  return lines.join("\n");
}

function editionAsText(edition: Edition): string {
  const head = [
    edition.publisher_info,
    edition.editor === null ? null : `ed. ${edition.editor}`,
    edition.copyright === null ? null : copyrightAsText(edition.copyright),
  ]
    .filter((part): part is string => part !== null)
    .join(" — ");

  const files = edition.files.map(
    (file) =>
      `  #${file.imslp_id} ${file.description}${file.blocked ? " [blocked]" : ""}` +
      `${file.pages === null ? "" : `, ${file.pages} pp.`}`,
  );

  const body = [`${edition.section}${head === "" ? "" : `: ${head}`}`, ...files].join("\n");
  return edition.misc_notes === null
    ? body
    : `${body}\n${quotedBlock("  Note from the edition:", edition.misc_notes)}`;
}

function copyrightAsText(copyright: Copyright): string {
  return copyright.restrictions.length === 0
    ? copyright.headline
    : `${copyright.headline} (not in ${copyright.restrictions.join(", ")})`;
}

export async function runGetWork(
  client: ImslpClient,
  args: GetWorkArgs,
  signal?: AbortSignal,
): Promise<ToolResult> {
  try {
    const { data, cached } = await client.getWork(pageTarget(args, invalidInput), signal);

    const truncated = data.editions.length > EDITIONS_IN_AN_ANSWER;
    const answered = { ...data, editions: truncated ? null : data.editions };
    const notes = noteworthy(data, truncated, cached);
    const text = asText(answered, data);
    noteIfTextIsCut(text, notes);

    return ok({ ...answered, editions_truncated: truncated, notes }, text, notes);
  } catch (error) {
    return toToolError(error);
  }
}
