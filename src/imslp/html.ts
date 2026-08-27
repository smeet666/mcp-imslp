/**
 * Reading text out of the HTML a wiki page renders.
 *
 * The rendering expands the templates a work page is written with, so an editor
 * reads as a name here rather than as `{{LinkEd|…}}`. What remains is markup
 * around the words, and these helpers take the words out of it.
 */

const TAG = /<[^>]*>/g;
const NARROW_SPELLING = /<span class="ms555">.*?<\/span>/gs;
const EDITOR_ONLY = /<span class="noanon">.*?<\/span>/gs;
const ADMIN_NOTE = /<small>.*?<\/small>/gs;
const SCRIPT = /<script\b[^>]*>.*?<\/script>/gs;
const BREAK = /<br\s*\/?>/gi;
const SPACES = /[ \t ]+/g;

/**
 * The group of a match, as text.
 *
 * A group that took part in the match holds its text, and one that did not
 * holds nothing: an optional group of a pattern that matched around it, and a
 * pattern that matched nowhere at all, both read as the empty text.
 */
export function group(match: RegExpMatchArray | RegExpExecArray | null, at: number): string {
  return match?.[at] ?? "";
}

/**
 * The first group a pattern captures in a fragment, or nothing.
 *
 * A page states a size, a page count and a download counter on some entries and
 * not on others, and reading them all through one place keeps "the page did not
 * state it" a single answer rather than one written at every call site.
 */
export function captured(pattern: RegExp, fragment: string): string | null {
  const match = pattern.exec(fragment);
  return match === null ? null : group(match, 1);
}

/**
 * Where a match begins in the fragment it was found in.
 *
 * A match produced by a search over a document states where it starts, and one
 * built by hand states nothing: reading it through one place keeps the callers
 * that walk a page from each carrying their own answer to that.
 */
export function startOf(match: RegExpMatchArray): number {
  return match.index ?? 0;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** Decode the entities a MediaWiki rendering uses, numeric ones included. */
export function decodeEntities(raw: string): string {
  return raw.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, body: string) => {
    const named = ENTITIES[body.toLowerCase()];
    if (named !== undefined) {
      return named;
    }
    if (body.startsWith("#")) {
      const code = body.startsWith("#x")
        ? Number.parseInt(body.slice(2), 16)
        : Number(body.slice(1));
      if (Number.isInteger(code) && code > 0 && code <= 0x10ffff) {
        return String.fromCodePoint(code);
      }
    }
    return whole;
  });
}

/** The words of a fragment, with the markup and the editor-only controls gone. */
export function text(fragment: string): string {
  const words = fragment
    .replace(SCRIPT, " ")
    .replace(EDITOR_ONLY, " ")
    .replace(BREAK, "\n")
    .replace(TAG, "");
  return decodeEntities(words)
    .replace(SPACES, " ")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

/**
 * The name of a field, read from the cell that labels it.
 *
 * A page prints each label twice, once spelled out and once abbreviated for a
 * narrow screen, and the two run together in the markup: "Opus/Catalogue
 * NumberOp./Cat. No." is one label written for two widths. The abbreviated
 * spelling is dropped, and the trailing full stop some labels carry goes with
 * it, so "Publisher. Info." and "Publisher Info." name the same field.
 */
export function fieldName(cell: string): string {
  return text(cell.replace(NARROW_SPELLING, "")).replace(/\./g, "").replace(SPACES, " ").trim();
}

/** The value of a cell, with the editor-only notes the page prints in it gone. */
export function fieldValue(cell: string): string | null {
  const value = text(cell.replace(ADMIN_NOTE, " "));
  return value === "" ? null : value;
}

export interface TableRow {
  name: string;
  /** The cell as rendered, for a reading that needs its links. */
  html: string;
  value: string | null;
}

const ROW = /<tr\b[^>]*>\s*<th\b[^>]*>(.*?)<\/th>\s*<td\b[^>]*>(.*?)<\/td>/gs;

/** Every label-and-value row of a region, in the order the page lists them. */
export function tableRows(region: string): TableRow[] {
  const rows: TableRow[] = [];
  for (const match of region.matchAll(ROW)) {
    const name = fieldName(group(match, 1));
    if (name !== "") {
      rows.push({ name, html: group(match, 2), value: fieldValue(group(match, 2)) });
    }
  }
  return rows;
}

const LINK = /<a\b[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gs;

/** The links a cell holds, with the text each was printed as. */
export function links(fragment: string): { href: string; label: string }[] {
  return [...fragment.matchAll(LINK)].map((match) => ({
    href: decodeEntities(group(match, 1)),
    label: text(group(match, 2)),
  }));
}
