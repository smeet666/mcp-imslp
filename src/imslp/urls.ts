/** URL construction and validation for imslp.org. */

const ALLOWED_HOSTS = new Set(["imslp.org", "www.imslp.org"]);

export const BASE_URL = "https://imslp.org";

/**
 * The two entry points this client reads.
 *
 * The robots.txt of IMSLP disallows `/index.php`, `/images/`, `/imglnks/`,
 * `/wiki/File:`, `/works` and `/library/`, so every read goes through the
 * MediaWiki API or through the listing endpoint the site documents on its own
 * `IMSLP:API` page. Nothing here builds an address under a disallowed path.
 */
export const API_PATH = "/api.php";
export const ISCR_PATH = "/imslpscripts/API.ISCR.php";

/** A page as a reader would open it, which is what an answer links to. */
export function wikiPageUrl(title: string): string {
  return `${BASE_URL}/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

/** Build a call to the MediaWiki API, always in JSON. */
export function apiUrl(params: Record<string, string | number>): string {
  const url = new URL(API_PATH, BASE_URL);
  url.searchParams.set("format", "json");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

/**
 * Build a call to the listing endpoint.
 *
 * Its arguments are written as a path of `key=value` segments separated by
 * slashes rather than as a query string, which is the form the site documents
 * and the only one it answers.
 */
export function iscrUrl(segments: Record<string, string | number>): string {
  const path = Object.entries(segments)
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join("/");
  return `${BASE_URL}${ISCR_PATH}?account=worklist/${path}`;
}

/** True only for imslp.org, so a hostile URL cannot be used as a proxy. */
export function isImslpHost(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return false;
  }
  return ALLOWED_HOSTS.has(parsed.hostname.toLowerCase());
}

/**
 * An address the site published, resolved against the site itself.
 *
 * A page publishes addresses written by people, and one of them can be no
 * address at all. Nothing is invented in its place: the caller drops the link
 * rather than receiving an error the six codes never named.
 */
export function toAbsoluteUrl(href: string): string | null {
  try {
    return new URL(href, BASE_URL).toString();
  } catch {
    return null;
  }
}

const TITLE_WITH_TRAILING_PARENTHESIS = /^(.*)\s+\(([^()]*)\)\s*$/s;

/**
 * The work and the person a page title names.
 *
 * IMSLP titles a work page `Work (Composer)`, and the composer is the last
 * parenthesis of the title rather than the first: `Sonata (No.2) (Ives,
 * Charles)` carries both. A title outside that form keeps its whole text as the
 * work and names no composer, which says the page is titled in a way this
 * reading does not cover.
 */
export function splitWorkTitle(title: string): { work: string; composer: string | null } {
  const match = TITLE_WITH_TRAILING_PARENTHESIS.exec(title);
  if (!match?.[1] || match[2] === undefined) {
    return { work: title, composer: null };
  }
  return { work: match[1].trim(), composer: match[2].trim() };
}
