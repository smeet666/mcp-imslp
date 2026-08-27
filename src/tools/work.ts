/**
 * What the tools reading a work page share: the shape of an edition, the way a
 * page is named, and the quoting of what a caller asked for.
 *
 * Two tools read the same page, and a caller compares their answers: an edition
 * has to have one shape, or one of the two is describing something else.
 */

import { z } from "zod";
import type { PageTarget } from "../imslp/client.js";

export const copyrightSchema = z.object({
  statement: z.string().describe("The statement as IMSLP publishes it."),
  headline: z.string().describe("What the statement leads with, for example 'Public Domain'."),
  restrictions: z
    .array(z.string())
    .describe(
      "The jurisdictions the statement excludes, for example 'Non-PD US'. Empty when it excludes " +
        "none, which is not a claim about countries IMSLP does not review.",
    ),
  remark: z
    .string()
    .nullable()
    .describe(
      "A remark the library wrote beside the statement, for example 'See notes on copyright " +
        "status for urtext editions'. It qualifies the terms without naming a place.",
    ),
  reviewed_in: z
    .array(z.string())
    .describe("Where IMSLP checks copyright: Canada, the United States and the European Union."),
});

export const fileSchema = z.object({
  imslp_id: z.number().int(),
  description: z.string().describe("What the entry is called, for example 'Complete Score'."),
  blocked: z
    .boolean()
    .describe(
      "True when IMSLP has suspended access to this file, which it does while reviewing the " +
        "copyright of one. Never report such a file as available.",
    ),
  blocked_reason: z
    .string()
    .nullable()
    .describe("What the library says about the suspension, as published. Null when none applies."),
  format: z
    .string()
    .nullable()
    .describe("The format as the page writes it: 'PDF' on a score, 'MP3 file' on a recording."),
  format_code: z
    .string()
    .nullable()
    .describe(
      "The same format without the noun the library appends to a recording: 'PDF', 'MP3', 'MID', " +
        "'ZIP', 'FLAC', 'MP4'. Filter on this rather than on the published wording.",
    ),
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
    .describe("The RISM sigla of the library that scanned it, for example 'US-R'."),
  scanned_by_name: z.string().nullable(),
  page_url: z.string().describe("The work page. The file itself is never linked."),
});

export const editionSchema = z.object({
  section: z.string().describe("The section of the page it sits in, for example 'Scores'."),
  copyright: copyrightSchema.nullable(),
  publisher_info: z.string().nullable(),
  editor: z.string().nullable(),
  arranger: z.string().nullable(),
  performers: z.string().nullable(),
  misc_notes: z.string().nullable().describe("A note an editor typed, quoted as published."),
  files: z.array(fileSchema),
});

export interface PageArguments {
  page?: string;
  pageid?: number;
}

/**
 * The page a caller named, refusing a call that names none or names two.
 *
 * A call carrying both a title and an id asks two questions, and answering one
 * of them would report the answer to a question the caller may not have asked.
 *
 * The refusal is built by the caller's own module, so a tool refuses in the
 * vocabulary it publishes rather than in one this module chose for it.
 */
export function pageTarget(
  args: PageArguments,
  refuse: (message: string, hint?: string) => Error,
): PageTarget {
  const page = args.page?.trim();
  if (page && args.pageid !== undefined) {
    throw refuse(
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
  throw refuse(
    "This tool needs the work's page title or its page id, and this call passes neither.",
    "A title is written 'Work (Composer)', for example 'Nocturnes, Op.9 (Chopin, Frédéric)'.",
  );
}

/**
 * Text a caller passed, quoted inside a line this server writes.
 *
 * A note names what was asked for, and an argument holding a line break would
 * otherwise start a line of the answer that reads as one of this server's own.
 */
export function quotedNote(value: string): string {
  return `"${value.replace(/\s+/g, " ").trim()}"`;
}
