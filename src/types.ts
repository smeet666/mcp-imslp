/** Domain types shared by the reading layer and the MCP tools. */

/** An address off the page, with the label the page gave it. */
export interface Link {
  label: string;
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
  reviewed_in: string[];
}

/** One downloadable entry of an edition. */
export interface WorkFile {
  imslp_id: number;
  description: string;
  format: string | null;
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
  authorities: Link[];
  sections: WorkSection[];
  /**
   * The editions of the work, when the page holds few enough of them.
   *
   * A work whose page runs to dozens of editions is left to the tool that
   * pages through them, and `editions_truncated` says which of the two
   * happened. Null here never means a work without scores.
   */
  editions: Edition[] | null;
  editions_truncated: boolean;
  /** The title asked for, when it redirected here. */
  redirected_from: string | null;
  source: "IMSLP";
  license: "CC BY-SA 4.0";
}
