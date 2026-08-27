/**
 * Reading a work page.
 *
 * The page is one document holding three things: a header of facets, a set of
 * tabs each counting its own entries, and blocks of files grouped under the
 * metadata they share. The three are read separately, because a work with no
 * file still has facets and a recording carries no edition metadata at all.
 */

import { parseFailure } from "../errors.js";
import { captured, fieldValue, group, links, startOf, tableRows, text } from "./html.js";
import type { Copyright, Edition, Link, Work, WorkFile, WorkSection } from "../types.js";
import { toAbsoluteUrl, wikiPageUrl } from "./urls.js";

/** What IMSLP checks when it states a copyright, and what it leaves unsaid. */
const REVIEWED_IN = ["Canada", "United States", "European Union"];

/** Stands in for a pattern that matched nothing, so a reading has one shape. */
const EMPTY_MATCH = [""] as unknown as RegExpExecArray;

/** The most editions a work page can hold and still be answered in one piece. */
export const EDITIONS_IN_A_WORK = 5;

const REDIRECT = /<li>\s*REDIRECT\s*<a\b[^>]*title="([^"]+)"/i;
const TAB_COUNT = /<a href="#(tab\w+)">([^<(]+)\(<span id="tab\w+_ct">(\d+)<\/span>/g;
const TAB_REGION = /<div class="jq-ui-tabs[^"]*" id="(tab\w+)">/g;
const GENERAL_INFORMATION = /<h2[^>]*>\s*<span class="mw-headline" id="General_Information">/;
const FILE_ENTRY = /<div id="IMSLP(\d+)" class="([^"]*we_file[^"]*)">/g;
const BLOCK_NUMBER = /we_fileblock_(\d+)/;
const EDITION_TABLE = /<table class="we_edition_info/;

const DESCRIPTION = /<span title="Download this file">(.*?)<\/span>\s*<\/a>/s;
const MEASURES = /#\d+<\/a>([^<]*)/;
const SIZE = /([\d.]+)\s*(KB|MB|GB)/i;
const PAGE_COUNT = /(\d+)\s*pp\./;
const DOWNLOADS = /Total number of downloads:\s*(\d+)/;
const RATING = /current-rating-\d+'[^>]*>([\d.]+)\/10/;
const VOTES = /num-of-ratings-\d+'>([^<]*)</;
const UPLOADER = /\/wiki\/User:([^"]+)"/;
const UPLOADED_ON = /\((\d{4})\/(\d{1,2})\/(\d{1,2})\)/;
const FORMAT = /IMSLP:File formats">([^<]+)<\/a>/;
const SCANNED_BY = /scanned by.*?title="([^"]*)"[^>]*>([^<]*)</s;

/** An address that leaves the site, which is what an external link is. */
const OFF_SITE = /^https?:/i;

const UNIT_BYTES = { KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 } as const;

/** The units the size pattern matches, and the only ones it can match. */
type SizeUnit = keyof typeof UNIT_BYTES;

/** A facet of the header, by the name the page labels it with. */
const FACETS: Record<string, keyof Work> = {
  "Work Title": "title",
  "Alternative Title": "alternative_title",
  "Opus/Catalogue Number": "opus_catalogue_number",
  "Internal Reference Number": "internal_catalogue_number",
  "Year/Date of Composition": "composition_year",
  "Composition Year": "composition_year",
  "First Publication": "first_publication",
  Dedication: "dedication",
  "Average Duration": "average_duration",
  Key: "key",
  Language: "language",
  Librettist: "librettist",
  "Composer Time Period": "composer_period",
  "Piece Style": "piece_style",
  Instrumentation: "instrumentation",
  "Movements/Sections": "movements",
  "First Performance": "first_performance",
  "Extra Information": "extra_information",
};

/** The fields of an edition that hold a line of text. */
type EditionTextField = "publisher_info" | "editor" | "arranger" | "performers" | "misc_notes";

/** A field of an edition, by the name its table labels it with. */
const EDITION_FIELDS: Record<string, EditionTextField> = {
  "Publisher Info": "publisher_info",
  Editor: "editor",
  Arranger: "arranger",
  Performers: "performers",
  "Misc Notes": "misc_notes",
};

export interface WorkPageContext {
  /** The title of the page as the site served it. */
  pageTitle: string;
  /** The number of the page, when the caller addressed the work by it. */
  pageid: number | null;
  /** The address the rendering was read from, for an error that names it. */
  url: string;
  /** The title asked for, when this page answered for it. */
  redirectedFrom?: string;
}

export type WorkPage = { kind: "work"; work: Work } | { kind: "redirect"; target: string };

/** Read a rendered work page, or say that it stands for another one. */
export function parseWorkPage(html: string, context: WorkPageContext): WorkPage {
  const redirect = REDIRECT.exec(html);
  if (redirect?.[1]) {
    return { kind: "redirect", target: redirect[1] };
  }

  const sections = readSections(html);
  const facets = readFacets(html);
  if (facets.title === undefined && sections.length === 0) {
    throw parseFailure(context.url, `nothing this parser recognises on "${context.pageTitle}"`);
  }

  const editions = readEditions(html, wikiPageUrl(context.pageTitle));
  const composer = readComposer(html);

  return {
    kind: "work",
    work: {
      title: facets.title ?? context.pageTitle,
      page_title: context.pageTitle,
      page_url: wikiPageUrl(context.pageTitle),
      pageid: context.pageid,
      alternative_title: facets.alternative_title ?? null,
      composer: composer?.name ?? null,
      composer_page_url: composer?.url ?? null,
      opus_catalogue_number: facets.opus_catalogue_number ?? null,
      internal_catalogue_number: catalogueNumber(facets.internal_catalogue_number),
      composition_year: facets.composition_year ?? null,
      first_publication: facets.first_publication ?? null,
      dedication: facets.dedication ?? null,
      average_duration: facets.average_duration ?? null,
      key: facets.key ?? null,
      language: facets.language ?? null,
      librettist: facets.librettist ?? null,
      composer_period: facets.composer_period ?? null,
      piece_style: facets.piece_style ?? null,
      instrumentation: facets.instrumentation ?? null,
      movements: facets.movements ?? null,
      first_performance: facets.first_performance ?? null,
      extra_information: facets.extra_information ?? null,
      genre_categories: readGenres(html),
      external_links: readLinkField(html, "External Links"),
      authorities: readLinkField(html, "Authorities"),
      sections,
      editions: editions.length > EDITIONS_IN_A_WORK ? null : editions,
      editions_truncated: editions.length > EDITIONS_IN_A_WORK,
      redirected_from: context.redirectedFrom ?? null,
      source: "IMSLP",
      license: "CC BY-SA 4.0",
    },
  };
}

/** The facets, read wherever the page prints them as a labelled row. */
function readFacets(html: string): Partial<Record<keyof Work, string>> {
  const facets: Partial<Record<keyof Work, string>> = {};
  // A page carrying no General Information section states its facets in the
  // header above the tabs, and it is then the whole of what there is to read.
  const at = html.search(GENERAL_INFORMATION);
  const header = at === -1 ? html : html.slice(0, at);
  const general = at === -1 ? "" : html.slice(at);

  for (const row of tableRows(general)) {
    const field = FACETS[row.name];
    if (field && row.value !== null && facets[field] === undefined) {
      facets[field] = row.value;
    }
  }
  // The header above the tabs carries a few of the same fields, and it is read
  // second so that the General Information section governs where both state one.
  for (const row of tableRows(header)) {
    const field = FACETS[row.name];
    if (field && row.value !== null && facets[field] === undefined) {
      facets[field] = row.value;
    }
  }
  return facets;
}

/**
 * A catalogue number the library has not assigned.
 *
 * The row then prints "None" beside an editor-only assignment control, which
 * says there is no number rather than that the number is the word "None".
 */
function catalogueNumber(raw: string | undefined): string | null {
  if (raw === undefined || raw === "None") {
    return null;
  }
  return raw;
}

function readComposer(html: string): { name: string; url: string } | null {
  for (const row of tableRows(html)) {
    if (row.name !== "Composer") {
      continue;
    }
    const link = links(row.html)[0];
    const url = link ? toAbsoluteUrl(link.href) : null;
    if (link && url) {
      return { name: link.label, url };
    }
    return row.value === null
      ? null
      : { name: row.value, url: wikiPageUrl(`Category:${row.value}`) };
  }
  return null;
}

function readGenres(html: string): string[] {
  for (const row of tableRows(html)) {
    if (row.name === "Genre Categories") {
      return links(row.html)
        .map((link) => link.label)
        .filter((label) => label !== "");
    }
  }
  return [];
}

function readLinkField(html: string, name: string): Link[] {
  for (const row of tableRows(html)) {
    if (row.name !== name) {
      continue;
    }
    return links(row.html)
      .map((link) => ({ label: link.label, url: link.href }))
      .filter((link) => link.label !== "" && OFF_SITE.test(link.url));
  }
  return [];
}

/** The sections, with the count each tab publishes for itself. */
function readSections(html: string): WorkSection[] {
  const sections: WorkSection[] = [];
  for (const match of html.matchAll(TAB_COUNT)) {
    const name = text(group(match, 2));
    if (name !== "") {
      sections.push({ name, files: Number(group(match, 3)) });
    }
  }
  return sections;
}

/** The name each tab region belongs to, keyed by the identifier it carries. */
function tabNames(html: string): Map<string, string> {
  const names = new Map<string, string>();
  for (const match of html.matchAll(TAB_COUNT)) {
    names.set(group(match, 1), text(group(match, 2)));
  }
  return names;
}

/**
 * The editions, in the order the page lists them.
 *
 * Files sitting under one block number share one edition, and the metadata
 * table that follows them belongs to that edition. A block of recordings has no
 * such table, so its edition carries its files and nothing else.
 */
function readEditions(html: string, pageUrl: string): Edition[] {
  const names = tabNames(html);
  const editions: Edition[] = [];

  const regions = [...html.matchAll(TAB_REGION)];
  for (const [at, region] of regions.entries()) {
    const next = regions[at + 1];
    const start = startOf(region) + region[0].length;
    const end = next === undefined ? html.length : startOf(next);
    const section = names.get(group(region, 1)) ?? group(region, 1);
    editions.push(...readRegion(html.slice(start, end), section, pageUrl));
  }
  return editions;
}

function readRegion(region: string, section: string, pageUrl: string): Edition[] {
  const entries = [...region.matchAll(FILE_ENTRY)];
  const editions: Edition[] = [];
  let block: string | null = null;

  for (const [at, entry] of entries.entries()) {
    const next = entries[at + 1];
    const start = startOf(entry) + entry[0].length;
    const end = next === undefined ? region.length : startOf(next);
    const body = region.slice(start, end);
    const number = BLOCK_NUMBER.exec(group(entry, 2))?.[1] ?? null;

    if (number !== block || editions.length === 0) {
      editions.push(emptyEdition(section));
      block = number;
    }
    const edition = editions.at(-1);
    edition?.files.push(readFile(Number(group(entry, 1)), body, pageUrl));
    if (edition && EDITION_TABLE.test(body)) {
      fillEdition(edition, body);
    }
  }
  return editions;
}

function emptyEdition(section: string): Edition {
  return {
    section,
    copyright: null,
    publisher_info: null,
    editor: null,
    arranger: null,
    performers: null,
    misc_notes: null,
    files: [],
  };
}

/** Read the metadata table of an edition into it. */
function fillEdition(edition: Edition, body: string): void {
  for (const row of tableRows(body.slice(body.search(EDITION_TABLE)))) {
    if (row.name === "Copyright") {
      edition.copyright = readCopyright(row.html);
      continue;
    }
    const field = EDITION_FIELDS[row.name];
    if (field) {
      edition[field] = row.value;
    }
  }
}

/**
 * A copyright statement, and the jurisdictions it excludes.
 *
 * The statement is kept as published, because "Public Domain - Non-PD US" says
 * something none of its halves says on its own.
 */
function readCopyright(cell: string): Copyright {
  // The statement separates its parts with a spaced hyphen, and the parts
  // themselves hold hyphens of their own: "Non-PD US" is one jurisdiction.
  const statement = (fieldValue(cell) ?? "").trim();
  const at = statement.indexOf(" - ");
  const headline = at === -1 ? statement : statement.slice(0, at);
  const restrictions =
    at === -1
      ? []
      : statement
          .slice(at + " - ".length)
          .split(",")
          .map((part) => part.trim())
          .filter((part) => part !== "");

  return { statement, headline: headline.trim(), restrictions, reviewed_in: REVIEWED_IN };
}

/** One file entry, read from what its own lines publish. */
function readFile(id: number, body: string, pageUrl: string): WorkFile {
  const measures = captured(MEASURES, body) ?? "";
  const size = SIZE.exec(measures);
  const scanned = SCANNED_BY.exec(body);
  const uploadedOn = UPLOADED_ON.exec(body);

  return {
    imslp_id: id,
    description: text(captured(DESCRIPTION, body) ?? ""),
    format: captured(FORMAT, body)?.trim() ?? null,
    size_bytes: size === null ? null : bytes(size),
    pages: numberOrNull(captured(PAGE_COUNT, measures)),
    downloads: numberOrNull(captured(DOWNLOADS, body)),
    rating: readRating(body),
    uploader: captured(UPLOADER, body),
    uploaded_on: uploadedOn === null ? null : isoDate(uploadedOn),
    scanned_by_code: emptyToNull(group(scanned ?? EMPTY_MATCH, 2)),
    scanned_by_name: emptyToNull(group(scanned ?? EMPTY_MATCH, 1)),
    page_url: pageUrl,
  };
}

/** A size as the entry writes it, in bytes. */
function bytes(size: RegExpExecArray): number {
  // The pattern matches these three units and no others, which is what makes
  // the lookup total.
  const unit = group(size, 2).toUpperCase() as SizeUnit;
  return Math.round(Number(group(size, 1)) * UNIT_BYTES[unit]);
}

function emptyToNull(value: string): string | null {
  return value.trim() === "" ? null : value.trim();
}

/**
 * The rating of a file, when anyone has voted on it.
 *
 * An entry nobody has rated prints 0.0 out of 10 next to a dash, and reporting
 * that score would place the file at the bottom of a scale it was never put on.
 */
function readRating(body: string): { score: number; votes: number } | null {
  const votes = numberOrNull(captured(VOTES, body));
  const score = captured(RATING, body);
  if (votes === null || votes === 0 || score === null) {
    return null;
  }
  return { score: Number(score), votes };
}

function numberOrNull(raw: string | null): number | null {
  if (raw === null) {
    return null;
  }
  const value = Number(raw.trim());
  return Number.isFinite(value) ? value : null;
}

function isoDate(match: RegExpExecArray): string {
  const [, year, month, day] = match;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
