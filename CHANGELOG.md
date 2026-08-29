# Changelog

## 1.0.1

- **Every tool is documented, with its arguments and what its answer carries.**
  The README is written for a person deciding whether to install and for a
  program installing on its own, and a test holds both halves to what the server
  registers.
- **The privacy policy travels in the package.** It states the hosts contacted,
  what a request carries, what is held and for how long.
- **The manifest names every tool the server registers**, which a host reads
  before installing anything.

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-08-27

### Added

- Reading layer for IMSLP: pacing on the two-second crawl delay the site
  publishes, an in-memory cache, and the six-code error taxonomy.
- `search_works` and `search_people`, the two ways into the library: one over
  the pages of works, one over the categories people are addressed by.
- `get_work`, which reads a work with its facets in the wording the page used,
  and carries its editions when there are few of them.
- `list_work_files`, which pages through the editions of a work and can be
  restricted to one section of the page.
- `list_person_works` and `browse_category`, which read what a category holds:
  what a person wrote, and what is written for a genre, a key or an instrument.
- `get_person`, which reads the page a person is catalogued on.

### What this version promises

Every answer states what IMSLP publishes and nothing beyond it. No count is
reported where the library publishes none, a facet it leaves empty comes back
absent rather than guessed, and the copyright of a score is stated per
jurisdiction because a score free in Canada can be protected in the United
States. No score file is downloaded, and no address is built under a path the
robots.txt of the library disallows.

The readings were held to six hundred work pages drawn at random across the
catalogue. The suite covers every statement, branch, function and line.
