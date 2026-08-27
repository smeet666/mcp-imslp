# mcp-imslp

## Tagline

Read IMSLP, the Petrucci Music Library: works, scores, editions, copyright. No API key.

## Description

IMSLP holds public domain sheet music and recordings catalogued by hand by the
volunteers who run it: a work carries its opus and catalogue numbers, the year
it was written and the year it was first published, its key, its
instrumentation, its dedication, and the editions people have scanned or
engraved of it, each with its publisher, its editor and its copyright status.

This server reads that catalogue. It searches the works and the people, reads a
work and pages through its editions, lists what the library files under a
composer, and browses a genre, a key or an instrumentation.

Two things it does deliberately. It states the copyright of a score **per
jurisdiction**, because the library reviews Canada, the United States and the
European Union separately and a score free in one can be protected in another.
And it **downloads no score file**: the robots.txt of IMSLP disallows the paths
that serve them, so the server builds no address under those paths and links the
work page instead, where the library prints its own notice.

It also never states a count IMSLP does not publish. The library publishes none,
on any route, so every answer says instead whether more rows remained and how to
read them.

Read-only, no account, no key. Requests go out one at a time with at least two
seconds between them, which is the crawl delay the site publishes.

## Setup Requirements

- `IMSLP_USER_AGENT` (optional): Your application's name. The project identity is appended to it so the library can always reach a person.
- `IMSLP_MIN_INTERVAL_MS` (optional): Milliseconds between requests. Default 2500, and never below the 2000 the site publishes.
- `IMSLP_TIMEOUT_MS` (optional): Per-request timeout. Default 30000.
- `IMSLP_MAX_RETRIES` (optional): Retries on a transient failure. Default 3.
- `IMSLP_CACHE_TTL_MS` (optional): How long a page stays in memory. Default 900000.
- `IMSLP_CACHE_MAX_ENTRIES` (optional): Pages held at once. Default 100.
- `IMSLP_LOG_LEVEL` (optional): silent, error, info or debug, on stderr. Default error.

## Category

Content & Media

## Features

- Search the works of the library by title, by composer, or by words printed on their pages
- Find the exact category a composer, editor, arranger or performer is addressed by
- Read a work: titles and translations, opus and catalogue numbers, composition and publication years, key, instrumentation, dedication, movements, first performance
- Page through the editions of a work, with the publisher, the editor and the files of each
- Read the copyright of every edition per jurisdiction, with the places it excludes named
- See when the library has suspended a file pending a copyright review, rather than reporting it as available
- List what the library files under a person, as a composer or as an editor, an arranger or a performer
- Read a person: life dates as published, other names they are filed under, and the registers holding a record of them
- Browse a genre, a key, an instrumentation or a period
- Dates come back in the wording the page used, so "ca.1830" stays "ca.1830" rather than becoming a certainty nobody stated

## Getting Started

- "What year did Ravel write the Boléro, and when was it first published?"
- "Find me the editions of Chopin's Nocturnes Op.9 and tell me which are free in the United States"
- "What has IMSLP got by Erik Satie?"
- "Show me works for piano four hands"
- Tool: search_works — Find the page of a work by title, composer, or words on the page
- Tool: get_work — One work, with its facets and the terms its scores are published under
- Tool: list_work_files — The editions of a work, with the copyright status of each
- Tool: search_people — The category a person is addressed by, which the reading tools take
- Tool: list_person_works — What the library files under a person
- Tool: get_person — Life dates, other names, and authority records
- Tool: browse_category — The works of a genre, a key, an instrumentation or a period

## Tags

imslp, petrucci, sheet music, scores, classical music, public domain, music, composers, editions, copyright, library, no api key, read only

## Documentation URL

https://github.com/smeet666/mcp-imslp#readme
