# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
