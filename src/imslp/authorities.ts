/**
 * Reading the registers a page names.
 *
 * A page writes the name of a register as a link to the article explaining it,
 * then the identifier as a link to the register itself. Kept apart, half of an
 * authority list points at encyclopedia pages, so the two are read as one entry
 * wherever they appear: on a work and on a person alike.
 */

import type { Authority } from "../types.js";
import { links } from "./html.js";

/** One entry of an authorities line, or nothing when it links nowhere. */
export function readAuthority(entry: string): Authority | null {
  const [named, identifier] = links(entry);
  if (!named) {
    return null;
  }
  if (identifier) {
    return { authority: named.label, id: identifier.label, url: identifier.href };
  }
  return { authority: named.label, id: null, url: named.href };
}

/** Every entry of a cell or a line listing registers, in the order it lists them. */
export function readAuthorities(cell: string, separator: RegExp): Authority[] {
  return cell
    .split(separator)
    .map((entry) => readAuthority(entry))
    .filter((entry): entry is Authority => entry !== null);
}
