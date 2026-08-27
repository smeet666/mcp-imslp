/**
 * get_work: read one work of the Petrucci Music Library.
 */

import { z } from "zod";
import type { ImslpClient, PageTarget } from "../imslp/client.js";
import { invalidInput } from "../errors.js";
import type { Copyright, Edition, Work } from "../types.js";
import { strictInput } from "./arguments.js";
import { noteIfTextIsCut, ok, quotedBlock, toToolError } from "./shared.js";
import type { ToolResult } from "./shared.js";

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

const copyrightSchema = z.object({
  statement: z.string().describe("The statement as IMSLP publishes it."),
  headline: z.string().describe("What the statement leads with, for example 'Public Domain'."),
  restrictions: z
    .array(z.string())
    .describe(
      "The jurisdictions the statement excludes, for example 'Non-PD US'. Empty when it excludes " +
        "none, which is not a claim about countries IMSLP does not review.",
    ),
  reviewed_in: z
    .array(z.string())
    .describe("Where IMSLP checks copyright: Canada, the United States and the European Union."),
});

const fileSchema = z.object({
  imslp_id: z.number().int(),
  description: z.string().describe("What the entry is called, for example 'Complete Score'."),
  format: z.string().nullable(),
  size_bytes: z.number().int().nullable(),
  pages: z.number().int().nullable(),
  downloads: z
    .number()
    .int()
    .nullable()
    .describe("Null when the entry prints no counter, which is not a count of zero."),
  rating: z
    .object({ score: z.number(), votes: z.number().int() })
    .nullable()
    .describe("Null when nobody has voted, since the page then prints 0.0 out of 10."),
  uploader: z.string().nullable(),
  uploaded_on: z.string().nullable().describe("An ISO date."),
  scanned_by_code: z
    .string()
    .nullable()
    .describe("The RISM sigla of the library, for example 'US-R'."),
  scanned_by_name: z.string().nullable(),
  page_url: z.string().describe("The work page. The file itself is never linked."),
});

const editionSchema = z.object({
  section: z.string().describe("The section of the page it sits in, for example 'Scores'."),
  copyright: copyrightSchema.nullable(),
  publisher_info: z.string().nullable(),
  editor: z.string().nullable(),
  arranger: z.string().nullable(),
  performers: z.string().nullable(),
  misc_notes: z.string().nullable().describe("A note an editor typed, quoted as published."),
  files: z.array(fileSchema),
});

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
  authorities: z.array(linkSchema).describe("Authority records: VIAF, LCCN, WorldCat, Wikipedia."),
  sections: z
    .array(z.object({ name: z.string(), files: z.number().int() }))
    .describe("The sections of the page, with the number of entries the site counts in each."),
  editions: z
    .array(editionSchema)
    .nullable()
    .describe("Null when the work holds more editions than one answer carries."),
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

/**
 * The page a caller named, refusing a call that names none or names two.
 *
 * A call carrying both a title and an id asks two questions, and answering one
 * of them would report the answer to a question the caller may not have asked.
 */
function target(args: GetWorkArgs): PageTarget {
  const page = args.page?.trim();
  if (page && args.pageid !== undefined) {
    throw invalidInput(
      "This tool takes 'page' or 'pageid', and this call passes both.",
      "Pass the title, or the page id a search returned.",
    );
  }
  if (page) {
    return { page };
  }
  if (args.pageid !== undefined) {
    return { pageid: args.pageid };
  }
  throw invalidInput(
    "This tool needs the work's page title or its page id, and this call passes neither.",
    "A title is written 'Work (Composer)', for example 'Nocturnes, Op.9 (Chopin, Frédéric)'.",
  );
}

/** What a caller has to know about an answer, beyond the answer itself. */
function noteworthy(work: Work, cached: boolean): string[] {
  const notes: string[] = [];

  if (work.redirected_from !== null) {
    notes.push(
      `"${work.redirected_from}" is a redirect on IMSLP, and this is the page it stands for.`,
    );
  }

  if (work.editions_truncated) {
    const entries = work.sections.reduce((total, section) => total + section.files, 0);
    notes.push(
      `This work holds more editions than one answer carries, so 'editions' is null here. The ` +
        `page counts ${entries} entries across its sections; call list_work_files with the same ` +
        "page to read them.",
    );
  }

  const restricted = new Set(
    (work.editions ?? []).flatMap((each) => each.copyright?.restrictions ?? []),
  );
  if (restricted.size > 0) {
    notes.push(
      `Some editions here are not free everywhere: ${[...restricted].join(", ")}. IMSLP reviews ` +
        "Canada, the United States and the European Union, and says nothing about anywhere else.",
    );
  }

  if (work.editions?.length === 0 && work.sections.every((section) => section.files === 0)) {
    notes.push("This work page holds no score and no recording, which is what the page says.");
  }

  if (cached) {
    notes.push("Served from this server's short-lived in-memory cache.");
  }
  return notes;
}

/** The answer as a block of text, for a client that renders nothing else. */
function asText(work: Work): string {
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

  for (const each of work.editions ?? []) {
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
      `  #${file.imslp_id} ${file.description}` +
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
    const { data, cached } = await client.getWork(target(args), signal);

    const notes = noteworthy(data, cached);
    const text = asText(data);
    noteIfTextIsCut(text, notes);

    return ok({ ...data, notes }, text, notes);
  } catch (error) {
    return toToolError(error);
  }
}
