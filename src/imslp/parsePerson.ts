/**
 * Reading the page a person is catalogued on.
 *
 * A person's page carries no table of fields. The name and the life dates open
 * it, and what follows is a set of lines each introduced by a symbol: the other
 * names the library files them under, the registers holding a record of them,
 * and the addresses it points to off the site.
 */

import { parseFailure } from "../errors.js";
import type { Authority, Link, Person } from "../types.js";
import { readAuthorities } from "./authorities.js";
import { group, links, text } from "./html.js";
import { wikiPageUrl } from "./urls.js";

const HEADING = /<div class="cp_firsth">(.*?)<\/div>/s;
const NAME = /<span class="mw-headline"[^>]*>(.*?)<\/span>/s;
const AFTER_THE_NAME = /<\/h2>(.*)$/s;
const LIFE_DATES = /^\((.*)\)$/s;
/**
 * One line of the block below the name.
 *
 * A line opens with a symbol and ends at the break that closes it, and what
 * sits between carries markup of its own: the names of a person are wrapped in
 * spans naming the language each is written in. Reading a line to its break
 * rather than to the first closing tag is what keeps those inside it.
 */
const A_LINE = /<div class="cp_symbol">.*?<\/div>(.*?)<br\s*\/?>/gs;
const OTHER_LINKS = /<div class="cp_links">/;
const A_SCRIPT = /<script\b/;
const OFF_SITE = /^https?:/i;
const COMMAS = /,/;
const CATEGORY_PREFIX = /^Category:/;

/** The label a line opens with, and what it states after it. */
const LABELLED = /^([^:]{1,60}?)\s*[:-]\s*(.*)$/s;

export interface PersonPageContext {
  /** The category as the site served it, which is how the person is addressed. */
  category: string;
  /** The address the rendering was read from, for an error that names it. */
  url: string;
}

/** Read the rendered page of a person. */
export function parsePersonPage(html: string, context: PersonPageContext): Person {
  const heading = HEADING.exec(html);
  const name = heading === null ? null : text(group(NAME.exec(group(heading, 1)), 1));
  if (heading === null || name === null || name === "") {
    throw parseFailure(context.url, `no person on "${context.category}"`);
  }

  const lines = readLines(html);

  return {
    category: context.category,
    catalogued_as: context.category.replace(CATEGORY_PREFIX, ""),
    name,
    life_dates: readLifeDates(group(heading, 1)),
    alternative_names: statedOn(lines, "Alternative Names/Transliterations"),
    aliases: statedOn(lines, "Aliases"),
    authorities: readRegisters(lines),
    external_links: readExternalLinks(html),
    page_url: wikiPageUrl(context.category),
    source: "IMSLP",
    license: "CC BY-SA 4.0",
  };
}

/** The dates the page prints beside the name, as it wrote them. */
function readLifeDates(heading: string): string | null {
  const after = text(group(AFTER_THE_NAME.exec(heading), 1));
  const dates = text(group(LIFE_DATES.exec(after), 1));
  return dates === "" ? null : dates;
}

/** The lines of the block below the name, each with the label it opens with. */
function readLines(html: string): { label: string; html: string }[] {
  return [...html.matchAll(A_LINE)]
    .map((line) => ({ label: group(LABELLED.exec(text(group(line, 1))), 1), html: group(line, 1) }))
    .filter((line) => line.label !== "");
}

/**
 * What one labelled line states, as it was published.
 *
 * The line separates its names with commas, and a name written surname first
 * carries one of its own, so cutting on commas would turn one person into two.
 */
function statedOn(lines: { label: string; html: string }[], label: string): string | null {
  const line = lines.find((each) => each.label === label);
  if (line === undefined) {
    return null;
  }
  const stated = group(LABELLED.exec(text(line.html)), 2).trim();
  return stated === "" ? null : stated;
}

function readRegisters(lines: { label: string; html: string }[]): Authority[] {
  const line = lines.find((each) => each.label === "Authorities");
  return line === undefined ? [] : readAuthorities(line.html, COMMAS);
}

/**
 * The addresses the page points to off the site.
 *
 * A person's page links to biographies, work lists and recordings elsewhere,
 * and to pages of this wiki alongside them. Only the first are addresses off
 * the site, and the labels are the words the page printed them under.
 */
function readExternalLinks(html: string): Link[] {
  const opens = html.search(OTHER_LINKS);
  if (opens === -1) {
    return [];
  }
  // The block runs to the end of the rendering, and a page ends with a script
  // carrying addresses of its own that nobody printed as a link.
  const tail = html.slice(opens);
  const ends = tail.search(A_SCRIPT);
  const block = ends === -1 ? tail : tail.slice(0, ends);

  return links(block)
    .filter((link) => OFF_SITE.test(link.href) && link.label !== "")
    .map((link) => ({ label: link.label, url: link.href }));
}
