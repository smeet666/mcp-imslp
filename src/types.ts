/** Domain types shared by the reading layer and the MCP tools. */

/** An address off the page, with the label the page gave it. */
export interface Link {
  label: string;
  url: string;
}

/**
 * A record of the work in a library's own catalogue.
 *
 * A page writes the name of a register as a link to the article explaining it,
 * then the identifier as a link to the register itself. The two belong to one
 * entry: kept apart, half of an authority list points at encyclopedia pages.
 */
export interface Authority {
  authority: string;
  /** Null for a register the page links to without naming an identifier. */
  id: string | null;
  url: string;
}

/**
 * The copyright of an edition, as IMSLP states it.
 *
 * A statement reads "Public Domain - Non-PD US": free in one place and
 * protected in another. `headline` is what it leads with and `restrictions` are
 * the jurisdictions it excludes, so neither can be read as the whole answer.
 * `reviewed_in` names what the library checks, which is what makes a statement
 * silent about everywhere else.
 */
export interface Copyright {
  statement: string;
  headline: string;
  restrictions: string[];
  /**
   * A remark the library wrote after the same separator the jurisdictions use.
   *
   * "Public Domain - See notes on copyright status for urtext editions" ends in
   * a sentence rather than in a country, and counting it among the
   * jurisdictions would name a place the score is protected in that does not
   * exist.
   */
  remark: string | null;
  reviewed_in: string[];
}

/**
 * One copyright statement, and how many editions of the page carry it.
 *
 * The count is of edition blocks rendered on the page, which is what this
 * server counted itself, rather than a figure IMSLP published.
 */
export interface CopyrightSummary extends Copyright {
  editions: number;
}

/** One downloadable entry of an edition. */
export interface WorkFile {
  imslp_id: number;
  description: string;
  /**
   * True when IMSLP has suspended access to the file.
   *
   * The library marks a file it is reviewing on the link itself rather than in
   * a field of its own. Served as an ordinary entry, such a file would be
   * reported as available while the library has stopped serving it.
   */
  blocked: boolean;
  /** What the library says about the suspension, as published. */
  blocked_reason: string | null;
  /** The format as the page writes it: "PDF" on a score, "MP3 file" on a recording. */
  format: string | null;
  /**
   * The same format without the noun the library appends to a recording.
   *
   * "MP3 file" and "PDF" are one field written two ways, so a caller filtering
   * on what the page printed finds the scores and misses the recordings.
   */
  format_code: string | null;
  size_bytes: number | null;
  pages: number | null;
  /** Null when the entry prints no counter, which is not a count of zero. */
  downloads: number | null;
  /** Null when nobody has voted, since the page then prints 0.0 out of 10. */
  rating: { score: number; votes: number } | null;
  uploader: string | null;
  /** ISO date, converted from the YYYY/M/D the page prints. */
  uploaded_on: string | null;
  /** The RISM sigla of the library that scanned it, when a library did. */
  scanned_by_code: string | null;
  scanned_by_name: string | null;
  /**
   * The work page this entry sits on.
   *
   * The address of the file itself is never published here: the robots.txt of
   * IMSLP disallows the paths that serve it, and the work page is where a
   * reader finds it along with the notice the library prints beside it.
   */
  page_url: string;
}

/**
 * One edition of a work: the files that share a set of metadata.
 *
 * A block of scores carries a publisher, an editor and a copyright statement.
 * A recording carries performers instead, and no copyright row at all, so every
 * field below the section is absent more often than not.
 */
export interface Edition {
  section: string;
  copyright: Copyright | null;
  publisher_info: string | null;
  editor: string | null;
  arranger: string | null;
  performers: string | null;
  misc_notes: string | null;
  files: WorkFile[];
}

/** A section of the page, with the number of entries the site counts in it. */
export interface WorkSection {
  name: string;
  files: number;
}

/** A person, as the page catalogueing them holds it. */
export interface Person {
  /** The category they are addressed by, which list_person_works takes. */
  category: string;
  /** The name without the category prefix, as the library files them. */
  catalogued_as: string;
  /** The name as the page prints it, which reads forename first. */
  name: string;
  /** The dates beside the name, exactly as published. */
  life_dates: string | null;
  /**
   * The other names the library files them under, as the line was published.
   *
   * The line separates its names with commas, and a name written surname first
   * carries one of its own: "Aubertin, Mireille Jeanne" is one person written
   * two ways at once. Nothing on the page tells the two apart, so the line is
   * kept whole rather than cut where a comma happens to fall.
   */
  alternative_names: string | null;
  aliases: string | null;
  authorities: Authority[];
  external_links: Link[];
  page_url: string;
  source: "IMSLP";
  license: "CC BY-SA 4.0";
}

/** One member of a category: a work page the library filed under it. */
export interface CategoryMember {
  pageid: number;
  title: string;
}

/** A work, as its page holds it. */
export interface Work {
  title: string;
  page_title: string;
  page_url: string;
  /**
   * The number IMSLP gives the page, when it is known.
   *
   * A rendered page states its title and its rendering and nothing else, so
   * this is known when a caller addressed the work by its id and unknown when
   * they addressed it by its title.
   */
  pageid: number | null;
  alternative_title: string | null;
  composer: string | null;
  composer_page_url: string | null;
  opus_catalogue_number: string | null;
  internal_catalogue_number: string | null;
  composition_year: string | null;
  first_publication: string | null;
  dedication: string | null;
  average_duration: string | null;
  key: string | null;
  language: string | null;
  librettist: string | null;
  composer_period: string | null;
  piece_style: string | null;
  instrumentation: string | null;
  movements: string | null;
  first_performance: string | null;
  extra_information: string | null;
  genre_categories: string[];
  external_links: Link[];
  authorities: Authority[];
  /**
   * The terms its scores are published under, one entry per distinct statement.
   *
   * Stated whether or not the editions themselves fit in an answer: the
   * copyright of a score lives on its edition, and a work whose editions were
   * left to another tool would otherwise say nothing at all about where it is
   * free.
   */
  copyright_summary: CopyrightSummary[];
  sections: WorkSection[];
  /** Every edition the page holds, in the order it lists them. */
  editions: Edition[];
  /** The title asked for, when it redirected here. */
  redirected_from: string | null;
  source: "IMSLP";
  license: "CC BY-SA 4.0";
}
