/**
 * Write the corpus the unit tests read.
 *
 * The pages below are invented: composers, works and files that exist nowhere.
 * They reproduce the markup IMSLP publishes, which is what the parser has to
 * cope with, without storing anyone else's catalogue in this repository.
 *
 * Every shape here was observed on the site and each is a case the parser is
 * asked about: a label split between a wide and a narrow spelling, a value cell
 * left empty, a copyright statement carrying its editor-only links, a work whose
 * files share one edition, a recording that carries no edition table at all, and
 * a page that redirects somewhere else.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "test", "fixtures");

/** A label as the site writes it: the wide spelling, then the narrow one. */
function label(wide, narrow) {
  return narrow === undefined
    ? wide
    : `<span class="mh555">${wide}</span><span class="ms555">${narrow}</span>`;
}

function row(th, td) {
  return `<tr>\n<th>${th}\n</th>\n<td>${td}\n</td></tr>`;
}

function generalInformation(rows) {
  return [
    '<h2> <span class="mw-headline" id="General_Information">General Information</span></h2>',
    '<div class="wi_body" style="width:100%">',
    '<table border="0">',
    "",
    rows.join("\n"),
    "</table>",
    "</div>",
  ].join("\n");
}

/** One downloadable file, as an entry of a block. */
function fileEntry({
  id,
  description,
  blocked,
  first,
  block,
  audio,
  size,
  pages,
  downloads,
  rating,
  votes,
  uploader,
  date,
  format,
  scannerCode,
  scannerName,
}) {
  const classes = [first ? "we_file_first" : "we_file", `we_fileblock_${block}`];
  if (audio) {
    classes.push("we_audio_top");
  }
  const measures = [size ? ` - ${size}` : "", pages ? `, ${pages} pp.` : ""].join("");
  const stars =
    rating === null
      ? ""
      : `<span class="mobilehide625">-&#160;<span class='inline-rating star-rating small-star'>
<span class='current-rating' id='current-rating-${id}' style='width:0%;'>${rating}/10</span>
</span> (<span id='num-of-ratings-${id}'>${votes === null ? "-" : votes}</span>)&#160;</span>`;
  const counter =
    downloads === null
      ? ""
      : `- <span title="Total number of downloads: ${downloads}"><a href="/wiki/Special:GetFCtrStats/@${id}" title="Special:GetFCtrStats/@${id}">${downloads}</a>×<big>⇩</big></span>`;
  const scanner = scannerCode
    ? ` scanned by <span class="plainlinks"><a rel="nofollow" class="external text" href="http://example.invalid/${scannerCode}"><span style="border-bottom:1px dotted black" title="${scannerName}">${scannerCode}</span></a></span>`
    : "";
  const credit = uploader
    ? `<a href="/wiki/User:${uploader}" title="User:${uploader}">${uploader}</a>${date ? ` (${date})` : ""}`
    : "";

  return `<div id="IMSLP${id}" class="${classes.join(" ")}">
<div class="we_file_download plainlinks">
<p><b><a rel="nofollow" class="external text" href="https://imslp.org/wiki/Special:ImagefromIndex/${id}"><span title="${blocked ? "This file is currently blocked pending copyright review" : "Download this file"}"><span class="we_file_dlarrwrap"><span class="${blocked ? "we_file_dlarrow_blocked" : "we_file_dlarrow"}">&#160;</span></span>${description}</span></a></b>${blocked ? '<font size="1"><b> [B]</b></font>' : ""}<br />
<span class="we_file_info2"><span class="hidden"><a href="/images/0/00/PMLP000000-invented.pdf" class="internal" title="PMLP000000-invented.pdf">*</a></span><a href="/wiki/File:PMLP000000-invented-${id}.pdf" title="File:PMLP000000-invented-${id}.pdf">#${id}</a>${measures} ${stars}${counter}<span class="ms555"> - ${credit}</span></span>
</p>
</div>
<div class="we_file_info mhs">
<p><span class="mh555">${format ? `<a href="/wiki/IMSLP:File_formats" title="IMSLP:File formats">${format}</a>` : ""}${scanner}<br />
${credit}</span>
</p>
</div>
<div class="we_clear"></div>
</div>`;
}

/** The metadata table a block of scores carries, thumbnail included. */
function editionTable(rows) {
  return `<table class="we_edition_info gainlayout"><tr><td class="we_edition_info_i gainlayout">
<table border="0" style="border-collapse:collapse">

${rows.join("\n")}</table>
</td><td style="padding:0"><div class="we_thumb"><a href="/wiki/File:PMLP000000-invented.pdf" class="image"><img alt="unveil" src="//cdn.example.invalid/thumb.png" width="600" height="auto" /></a></div></td></tr></table>`;
}

/** A copyright cell, with the editor-only links the site prints beside it. */
function copyrightCell(statement) {
  return `<div class="plainlinks"><a href="/wiki/IMSLP:Public_Domain" title="IMSLP:Public Domain" class="mw-redirect">${statement}</a><span class="noanon">&#160;<small>[<a rel="nofollow" class="external text" href="http://example.invalid/tag">tag</a>/<a rel="nofollow" class="external text" href="http://example.invalid/del">del</a>]</small></span></div>`;
}

const PURCHASE_ROW = row(
  label("Purchase"),
  '<div class="imslpd_purchase mh555" title="1">Javascript is required for this feature.</div><script>JGINITsearchbars[\'1\']={};</script>',
);

/** One tab, named by the marker the site closes it with. */
function tab({ id, name, type, body }) {
  return `<div class="jq-ui-tabs" id="${id}">
${body}
<span class="na-marker" id="na-${id}" data-type="${type}" data-name="${name}" data-tabid="${id}"></span>
</div>`;
}

function tabHeader(entries) {
  const items = entries
    .map(
      ({ id, name, count }) =>
        `<li id="${id}_tab"><b><a href="#${id}">${name} (<span id="${id}_ct">${count}</span>)</a></b></li>`,
    )
    .join("");
  return `<div id="wpscore_tabs" class="tabs"><ul class="jsonly" style="display:none">${items}</ul>`;
}

/**
 * A work with everything filled in: several facets, one edition of two files,
 * and a recording that carries no edition table.
 */
const FULL = `<div class="wp_header">
<table>
<table>
<tr>
<th>${label("Movements/Sections", "Mov'ts/Sec's")}
</th>
<td>3
</td></tr>
<tr>
<th>Genre Categories<span class="addpagetag mh555"></span>
</th>
<td><span class="plainlinks"><a rel="nofollow" class="external text" href="https://imslp.org/index.php?title=Category:Nocturnes&amp;transclude=Template:Catintro">Nocturnes</a></span>; <a href="/wiki/Category:For_piano" title="Category:For piano">For piano</a>
</td></tr>
</table>
</table>
</div>
<script>JGINITadjhead={"type":1,"worktitle":"Three Inventions","composer":"Aubertin, Mireille","comphref":"\\/wiki\\/Category:Aubertin,_Mireille"};</script>
${tabHeader([
  { id: "tabAudio1", name: "Recordings", count: 1 },
  { id: "tabScore1", name: "Scores", count: 2 },
  { id: "tabScore2", name: "Parts", count: 0 },
])}
${tab({
  id: "tabAudio1",
  name: "Recordings",
  type: "audio",
  body: `${fileEntry({
    id: 900_001,
    description: "Complete Recording",
    first: true,
    block: 1,
    audio: true,
    size: "8.21MB",
    pages: null,
    downloads: 42,
    rating: "0.0",
    votes: null,
    uploader: "Inventaire",
    date: "2019/3/4",
    format: "MP3 file",
    scannerCode: null,
    scannerName: null,
  })}${editionTable([
    row("Performers", "Ensemble inventé"),
    row(
      "Performer Pages",
      '<a href="/wiki/Category:Ensemble_invent%C3%A9" title="Category:Ensemble inventé">Ensemble inventé</a>',
    ),
  ])}`,
})}
${tab({
  id: "tabScore1",
  name: "Scores",
  type: "score",
  body: `${fileEntry({
    id: 900_002,
    description: "Complete Score",
    first: true,
    block: 2,
    audio: false,
    size: "1.54MB",
    pages: 24,
    downloads: 1280,
    rating: "7.5",
    votes: 4,
    uploader: "Inventaire",
    date: "2014/8/15",
    format: "PDF",
    scannerCode: "ZZ-Q",
    scannerName: "Bibliothèque inventée",
  })}${fileEntry({
    id: 900_003,
    description: "Preview",
    first: false,
    block: 2,
    audio: false,
    size: "0.12MB",
    pages: 2,
    downloads: null,
    rating: null,
    votes: null,
    uploader: "Inventaire",
    date: "2014/8/15",
    format: "PDF",
    scannerCode: null,
    scannerName: null,
  })}${editionTable([
    row(`Pub${label("lisher", ".")} Info.`, "Ville-Inventée: Éditions Nulle Part, n.d. (1902)."),
    row(
      "Editor",
      '<a href="/wiki/Category:Aubertin,_Mireille/Editor" title="Category:Aubertin, Mireille/Editor">Aubertin, Mireille</a> (1861-1934)',
    ),
    row("Copyright", copyrightCell("Public Domain&#160;- Non-PD US")),
    row("Misc. Notes", "Scanned at 600dpi."),
    PURCHASE_ROW,
  ])}`,
})}
${generalInformation([
  row('<span class="wi_head">Work Title</span>', '<span class="wi_head">Three Inventions</span>'),
  row(`Alt${label("ernative", ".")} Title`, "Trois inventions"),
  row(
    "Composer",
    '<a href="/wiki/Category:Aubertin,_Mireille" title="Category:Aubertin, Mireille">Aubertin, Mireille</a>',
  ),
  row(label("Opus/Catalogue Number", "Op./Cat. No."), "Op.12"),
  row(label("Internal Reference Number", "Internal Ref. No."), "MAI 12"),
  row(label("Year/Date of Composition", "Y/D of Comp."), "ca.1899"),
  row("First Publication.", "1902"),
  row("Dedication", "à ma sœur"),
  row(label("Average Duration", "Avg. Duration"), "12 minutes"),
  row("Language", "French"),
  row(
    label("Composer Time Period", "Comp. Period"),
    '<a href="/wiki/Category:Romantic" title="Category:Romantic">Romantic</a>',
  ),
  row(
    "Piece Style",
    '<a href="/wiki/Category:Romantic_style" title="Category:Romantic style">Romantic</a>',
  ),
  row("Instrumentation", "piano"),
  row(
    "External Links",
    '<span class="plainlinks"><a rel="nofollow" class="external text" href="https://example.invalid/aubertin">Composer page</a></span>',
  ),
  row(
    "Authorities",
    '<a rel="nofollow" class="external text" href="https://example.invalid/worldcat/1">WorldCat</a>; ' +
      '<a href="http://en.wikipedia.org/wiki/Virtual_International_Authority_File" class="extiw" title="wikipedia:Virtual International Authority File">VIAF</a>: ' +
      '<a rel="nofollow" class="external text" href="https://example.invalid/viaf/900000">900000</a>; ' +
      '<a href="http://en.wikipedia.org/wiki/Biblioth%C3%A8que_nationale_de_France" class="extiw" title="wikipedia:Bibliothèque nationale de France">BNF</a>: ' +
      '<a rel="nofollow" class="external text" href="https://example.invalid/bnf/12345678x">12345678x</a>; ' +
      "see also the composer category",
  ),
])}
`;

/** A work whose facets are mostly absent, which is the ordinary state. */
const SPARSE = `<div class="wp_header">
<table>
<table>
</table>
</table>
</div>
${tabHeader([{ id: "tabScore1", name: "Scores", count: 1 }])}
${tab({
  id: "tabScore1",
  name: "Scores",
  type: "score",
  body: `${fileEntry({
    id: 900_010,
    description: "Complete Score",
    first: true,
    block: 1,
    audio: false,
    size: null,
    pages: null,
    downloads: null,
    rating: null,
    votes: null,
    uploader: null,
    date: null,
    format: null,
    scannerCode: null,
    scannerName: null,
  })}${editionTable([row("Copyright", copyrightCell("Creative Commons Attribution 4.0"))])}`,
})}
${generalInformation([
  row('<span class="wi_head">Work Title</span>', '<span class="wi_head">Petite pièce</span>'),
  row(`Alt${label("ernative", ".")} Title`, ""),
  row(
    "Composer",
    '<a href="/wiki/Category:Nadaud,_Camille" title="Category:Nadaud, Camille">Nadaud, Camille</a>',
  ),
  row(
    label("Internal Reference Number", "Internal Ref. No."),
    'None <small>[<span class="icatassign">force assignment</span>]</small>',
  ),
  row("Piece Style", "Modern"),
])}
`;

/**
 * A work carrying more editions than one answer holds.
 *
 * Six blocks of one file each, which is what a heavily edited work looks like
 * in miniature: the tool that answers a work has to hand these over to the tool
 * that pages through them.
 */
const MANY_EDITIONS = `<div class="wp_header">
<table>
<table>
</table>
</table>
</div>
${tabHeader([{ id: "tabScore1", name: "Scores", count: 6 }])}
${tab({
  id: "tabScore1",
  name: "Scores",
  type: "score",
  body: Array.from(
    { length: 6 },
    (_unused, at) =>
      `${fileEntry({
        id: 900_100 + at,
        description: `Complete Score, edition ${at + 1}`,
        first: true,
        block: at + 1,
        audio: false,
        size: "1.00MB",
        pages: 10,
        downloads: 7,
        rating: null,
        votes: null,
        uploader: "Inventaire",
        date: "2020/1/1",
        format: "PDF",
        scannerCode: null,
        scannerName: null,
      })}${editionTable([row("Copyright", copyrightCell("Public Domain"))])}`,
  ).join("\n"),
})}
${generalInformation([
  row('<span class="wi_head">Work Title</span>', '<span class="wi_head">Six éditions</span>'),
  row(
    "Composer",
    '<a href="/wiki/Category:Nadaud,_Camille" title="Category:Nadaud, Camille">Nadaud, Camille</a>',
  ),
])}
`;

/**
 * A work page holding no score and no recording.
 *
 * Its composer is written as plain text rather than as a link to a category,
 * which is how a page names someone the library has no category for.
 */
const NO_FILES = `${tabHeader([{ id: "tabScore1", name: "Scores", count: 0 }])}
${tab({ id: "tabScore1", name: "Scores", type: "score", body: "<p>Nothing yet.</p>" })}
${generalInformation([
  row('<span class="wi_head">Work Title</span>', '<span class="wi_head">Œuvre sans fichier</span>'),
  row("Composer", "Nadaud, Camille"),
])}
`;

/** A work page naming no composer at all. */
const NO_COMPOSER = `${tabHeader([{ id: "tabScore1", name: "Scores", count: 0 }])}
${tab({ id: "tabScore1", name: "Scores", type: "score", body: "<p>Nothing yet.</p>" })}
${generalInformation([
  row('<span class="wi_head">Work Title</span>', '<span class="wi_head">Œuvre anonyme</span>'),
  row("Composer", ""),
  row(
    "External Links",
    '<a href="/wiki/Category:Anonymous" title="Category:Anonymous">Anonymous</a>',
  ),
])}
`;

/** A work page whose General Information names no composer at all. */
const NO_COMPOSER_ROW = `${tabHeader([{ id: "tabScore1", name: "Scores", count: 0 }])}
${tab({ id: "tabScore1", name: "Scores", type: "score", body: "<p>Nothing yet.</p>" })}
${generalInformation([
  row(
    '<span class="wi_head">Work Title</span>',
    '<span class="wi_head">Œuvre sans auteur nommé</span>',
  ),
  row("Piece Style", "Baroque"),
])}
`;

/**
 * Entries written in ways the ordinary pages do not show.
 *
 * One entry sits in no numbered block, one publishes neither its size nor a
 * name for what it is, and the edition they belong to leaves its copyright cell
 * empty. Each is a shape the markup allows, and each has to read as an absence
 * rather than as a failure.
 */
const ODD_ENTRIES = `<div class="wp_header">
<table>
<table>
${row("Composer", '<a href="/wiki/Category:Nadaud,_Camille" title="Category:Nadaud, Camille">Nadaud, Camille</a>')}
${row("Piece Style", "Baroque")}
</table>
</table>
</div>
${tabHeader([
  { id: "tabScore1", name: "Scores", count: 2 },
  { id: "tabScore5", name: " ", count: 0 },
])}
${tab({
  id: "tabScore1",
  name: "Scores",
  type: "score",
  body: `<div id="IMSLP900200" class="we_file_first">
<div class="we_file_download plainlinks">
<p><b><a rel="nofollow" class="external text" href="https://imslp.org/wiki/Special:ImagefromIndex/900200">Complete Score</a></b><br />
<span class="we_file_info2">no measures published</span>
</p>
</div>
<div class="we_clear"></div>
</div>${fileEntry({
    id: 900_201,
    description: "Complete Score",
    first: false,
    block: 1,
    audio: false,
    size: null,
    pages: null,
    downloads: null,
    rating: null,
    votes: null,
    uploader: null,
    date: null,
    format: null,
    scannerCode: null,
    scannerName: null,
  })}${editionTable([row("Copyright", "")])}`,
})}
${tab({ id: "tabScore9", name: "Unlisted", type: "score", body: "<p>Nothing here.</p>" })}
`;

/**
 * An edition whose copyright statement ends in a remark rather than a country.
 *
 * The library writes both after the same separator, so the two are told apart
 * by what they look like rather than by where they sit.
 */
const REMARKED_COPYRIGHT = `${tabHeader([{ id: "tabScore1", name: "Scores", count: 1 }])}
${tab({
  id: "tabScore1",
  name: "Scores",
  type: "score",
  body: `${fileEntry({
    id: 900_300,
    description: "Complete Score",
    first: true,
    block: 1,
    audio: false,
    size: "2.00MB",
    pages: 30,
    downloads: 12,
    rating: null,
    votes: null,
    uploader: "Inventaire",
    date: "2021/5/6",
    format: "PDF",
    scannerCode: null,
    scannerName: null,
  })}${editionTable([
    row(
      "Copyright",
      copyrightCell("Public Domain&#160;- See notes on copyright status for urtext editions"),
    ),
  ])}`,
})}
${generalInformation([
  row('<span class="wi_head">Work Title</span>', '<span class="wi_head">Édition urtext</span>'),
  row(
    "Composer",
    '<a href="/wiki/Category:Nadaud,_Camille" title="Category:Nadaud, Camille">Nadaud, Camille</a>',
  ),
])}
`;

/**
 * The page of a person, as the library writes it.
 *
 * A person's page carries no table: the name and the life dates open it, and
 * the lines below are introduced by a symbol rather than by a label cell.
 */
const PERSON = `<div class="cp_outer"><div class="cp_inner"><div class="cp_img">
<div class="floatnone"><a href="/wiki/File:Invented.jpg" class="image" title="Mireille Aubertin (1861–1934)"><img alt="Mireille Aubertin" src="/images/thumb/0/00/Invented.jpg/180px-Invented.jpg" width="180" height="300" /></a></div>
</div>
<div class="cp_firsth">
<h2> <span class="mw-headline" id="Mireille_Aubertin">Mireille Aubertin </span></h2>(4 March 1861 — 2 November 1934)
</div>
<div class="plainlinks cp_mainlinks">
<div class="cp_symbol">＝</div> <span style="font-weight:normal">Alternative Names/Transliterations: Mireille Aubertin-Nadaud, M. Aubertin</span><br />
<div class="cp_symbol">＝</div> <span style="font-weight:normal">Name in Other Languages: <span title="de">Mireille Aubertin</span>, <span title="ru">Мирей Обертен</span></span><br />
<div class="cp_symbol">＝</div> <span style="font-weight:normal">Aliases: <span title="fr">Aubertin, Mireille Jeanne</span></span><br />
<div class="cp_symbol">＝</div> <span style="font-weight:normal">Authorities - <a rel="nofollow" class="external text" href="https://example.invalid/worldcat/2">WorldCat</a>, <a href="http://en.wikipedia.org/wiki/Virtual_International_Authority_File" class="extiw" title="wikipedia:Virtual International Authority File">VIAF</a>: <a rel="nofollow" class="external text" href="https://example.invalid/viaf/900001">900001</a>, <a href="http://en.wikipedia.org/wiki/Biblioth%C3%A8que_nationale_de_France" class="extiw" title="wikipedia:Bibliothèque nationale de France">BNF</a>: <a rel="nofollow" class="external text" href="https://example.invalid/bnf/900001x">900001x</a></span><br />
<div class="cp_symbol">✕</div> <a href="/wiki/Special:CategoryWalker/Aubertin,_Mireille/" title="Special:CategoryWalker/Aubertin, Mireille/">Show works by type/instrument</a><br />
</div>
<h2 class="cp_h"> <span class="mw-headline" id="External_links">External links</span></h2>
<div class="cp_links">
<ul><li>Detailed biography: <a rel="nofollow" class="external text" href="https://example.invalid/biography">A biography</a></li>
<li>Recordings: <a rel="nofollow" class="external text" href="https://example.invalid/recordings">Somewhere</a></li>
<li>Her category: <a href="/wiki/Category:Aubertin,_Mireille" title="Category:Aubertin, Mireille">on this site</a></li></ul>
</div>
</div></div>
<script>JGINITadjhead={"type":2,"composer":"Aubertin, Mireille","link":"https://app0.example.invalid/x"};</script>
`;

/**
 * A person the library states nothing about beyond a name.
 *
 * Its block of lines carries an aliases line with nothing after the label,
 * which the page writes for someone it holds no other name for.
 */
const PERSON_BARE = `<div class="cp_outer"><div class="cp_inner">
<div class="cp_firsth">
<h2> <span class="mw-headline" id="Camille_Nadaud">Camille Nadaud </span></h2>
</div>
<div class="plainlinks cp_mainlinks">
<div class="cp_symbol">＝</div> <span style="font-weight:normal">Aliases: </span><br />
</div>
</div></div>
`;

/** A person whose page ends on its links, with no script after them. */
const PERSON_LINKS_ONLY = `<div class="cp_outer"><div class="cp_inner">
<div class="cp_firsth">
<h2> <span class="mw-headline" id="Jeanne_Roux">Jeanne Roux </span></h2>(1899—1975)
</div>
<div class="cp_links">
<ul><li>Detailed biography: <a rel="nofollow" class="external text" href="https://example.invalid/roux">A biography</a></li></ul>
</div>
</div></div>
`;

/**
 * A work whose only score the library has blocked pending a copyright review.
 *
 * The page names the file as it names any other, and marks the state on the
 * link itself rather than in a field of its own.
 */
const BLOCKED_FILE = `${tabHeader([{ id: "tabScore1", name: "Scores", count: 1 }])}
${tab({
  id: "tabScore1",
  name: "Scores",
  type: "score",
  body: `${fileEntry({
    id: 900_400,
    description: "Complete Score",
    blocked: true,
    first: true,
    block: 1,
    audio: false,
    size: "0.11MB",
    pages: 9,
    downloads: null,
    rating: null,
    votes: null,
    uploader: "Inventaire",
    date: "2025/2/3",
    format: "PDF",
    scannerCode: null,
    scannerName: null,
  })}${editionTable([row("Copyright", copyrightCell("Public Domain"))])}`,
})}
${generalInformation([
  row('<span class="wi_head">Work Title</span>', '<span class="wi_head">Pièce bloquée</span>'),
  row(
    "Composer",
    '<a href="/wiki/Category:Nadaud,_Camille" title="Category:Nadaud, Camille">Nadaud, Camille</a>',
  ),
])}
`;

/** A page that stands for another one. */
const REDIRECT = `<ol><li>REDIRECT <a href="/wiki/Trois_inventions,_Op.12_(Aubertin,_Mireille)" title="Trois inventions, Op.12 (Aubertin, Mireille)">Trois inventions, Op.12 (Aubertin, Mireille)</a>
</li></ol>
`;

/** A page holding nothing this parser recognises. */
const EMPTY = "<p>Javascript is required to submit files.</p>\n";

/**
 * What a search answers with.
 *
 * The API states the rows and, when more remain, the offset to continue from.
 * It publishes no total, whatever is asked of it, so nothing here carries one.
 * A snippet arrives as wikitext with the matched words wrapped, and some rows
 * carry none at all.
 */
const SEARCH_WORKS = {
  query: {
    search: [
      {
        ns: 0,
        title: "Three Inventions (Aubertin, Mireille)",
        snippet:
          "|File Name 1=PMLP000000-aubertin-<span class='searchmatch'>inventions</span>.pdf\n" +
          "|File Name 2=PMLP000000-aubertin-<span class='searchmatch'>inventions</span>-parts.pdf\n",
        size: 9637,
        wordcount: 1175,
        timestamp: "2025-05-28T12:16:47Z",
      },
      {
        ns: 0,
        title: "Petite pièce (Nadaud, Camille)",
        snippet: "",
        size: 50,
        wordcount: 5,
        timestamp: "2009-03-08T14:07:21Z",
      },
      {
        ns: 0,
        title: "Requiem",
        snippet: "a work whose title names no composer",
        size: 120,
        wordcount: 20,
        timestamp: "2018-01-02T03:04:05Z",
      },
    ],
  },
  "query-continue": { search: { sroffset: 3 } },
};

const SEARCH_PEOPLE = {
  query: {
    search: [
      {
        ns: 14,
        title: "Category:Nadaud, Camille",
        snippet: "<span class='searchmatch'>Nadaud</span>, Camille (1861-1934)",
        size: 420,
        wordcount: 60,
        timestamp: "2024-02-03T04:05:06Z",
      },
      {
        ns: 14,
        title: "Category:Nadaud, C.",
        snippet: "#REDIRECT [[:Category:<span class='searchmatch'>Nadaud</span>, Camille]]",
        size: 42,
        wordcount: 6,
        timestamp: "2010-08-21T02:58:18Z",
      },
    ],
  },
};

/** A search the library answers with nothing. */
const SEARCH_EMPTY = { query: { search: [] } };

/**
 * A row the search states without the fields the others carry.
 *
 * The timestamp of a page is written by the wiki, and a row whose stamp is not
 * a date leaves the day unknown rather than making one up.
 */
const SEARCH_ODD = {
  query: {
    search: [
      {
        ns: 0,
        title: "Sans date (Nadaud, Camille)",
        snippet: "",
        size: 10,
        wordcount: 2,
        timestamp: "",
      },
    ],
  },
};

/** What the API answers when it refuses the search itself. */
const SEARCH_REFUSED = { error: { code: "srsearch-error", info: "Search failed" } };

/** An answer carrying no results block at all. */
const SEARCH_SHAPELESS = { query: {} };

/**
 * What a listing of a category answers with.
 *
 * The API states the members and, when more remain, an opaque cursor to
 * continue from. It publishes no count of the members a category holds.
 */
const CATEGORY_MEMBERS = {
  query: {
    categorymembers: [
      { pageid: 900_000, ns: 0, title: "Three Inventions (Aubertin, Mireille)" },
      { pageid: 900_010, ns: 0, title: "Petite pièce (Nadaud, Camille)" },
      { pageid: 900_020, ns: 0, title: "Requiem" },
    ],
  },
  "query-continue": { categorymembers: { cmcontinue: "page|54485245457e7e4155424552544954" } },
};

/** The last page of a listing, which names no cursor to continue from. */
const CATEGORY_LAST_PAGE = {
  query: {
    categorymembers: [{ pageid: 900_030, ns: 0, title: "Dernière pièce (Nadaud, Camille)" }],
  },
};

/** A category the library holds nothing in, or does not hold at all. */
const CATEGORY_EMPTY = { query: { categorymembers: [] } };

const PAYLOADS = {
  "search-works.json": SEARCH_WORKS,
  "search-people.json": SEARCH_PEOPLE,
  "search-empty.json": SEARCH_EMPTY,
  "search-odd.json": SEARCH_ODD,
  "search-refused.json": SEARCH_REFUSED,
  "search-shapeless.json": SEARCH_SHAPELESS,
  "category-members.json": CATEGORY_MEMBERS,
  "category-last-page.json": CATEGORY_LAST_PAGE,
  "category-empty.json": CATEGORY_EMPTY,
};

const PAGES = {
  "work-full.html": FULL,
  "work-sparse.html": SPARSE,
  "work-many-editions.html": MANY_EDITIONS,
  "work-no-files.html": NO_FILES,
  "work-no-composer.html": NO_COMPOSER,
  "work-no-composer-row.html": NO_COMPOSER_ROW,
  "work-odd-entries.html": ODD_ENTRIES,
  "work-remarked-copyright.html": REMARKED_COPYRIGHT,
  "work-blocked-file.html": BLOCKED_FILE,
  "person.html": PERSON,
  "person-bare.html": PERSON_BARE,
  "person-links-only.html": PERSON_LINKS_ONLY,
  "work-redirect.html": REDIRECT,
  "work-empty.html": EMPTY,
};

mkdirSync(OUT, { recursive: true });
for (const [name, body] of Object.entries(PAGES)) {
  writeFileSync(join(OUT, name), body, "utf8");
}
for (const [name, payload] of Object.entries(PAYLOADS)) {
  writeFileSync(join(OUT, name), `${JSON.stringify(payload, null, 1)}\n`, "utf8");
}
const written = Object.keys(PAGES).length + Object.keys(PAYLOADS).length;
process.stdout.write(`wrote ${written} fixtures to ${OUT}\n`);
