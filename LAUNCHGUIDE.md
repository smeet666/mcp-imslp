# mcp-imslp

An MCP server for IMSLP, the Petrucci Music Library: works, scores and
recordings of classical music, catalogued by the volunteers who run it.

- **Package:** `mcp-imslp` on npm
- **Repository:** https://github.com/smeet666/mcp-imslp
- **Licence:** MIT. The data belongs to IMSLP and its contributors, published
  under CC BY-SA 4.0.
- **API key:** none. No account either.
- **Transport:** stdio.

## Install

```json
{
  "mcpServers": {
    "imslp": {
      "command": "npx",
      "args": ["-y", "mcp-imslp"]
    }
  }
}
```

## What it does

| Tool                | What it answers                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------- |
| `search_works`      | Find the page of a work by title, composer, or words on the page                                               |
| `search_people`     | Find the category a composer, editor, arranger or performer is addressed by                                    |
| `get_work`          | One work: titles, catalogue numbers, dates, key, instrumentation, and the terms its scores are published under |
| `list_work_files`   | The editions of a work, with their publishers, editors and copyright status                                    |
| `list_person_works` | What the library files under a person                                                                          |
| `get_person`        | Life dates, other names, and the registers holding a record of them                                            |
| `browse_category`   | The works of a genre, a key, an instrumentation or a period                                                    |

## What it will not do

It downloads no score file. The robots.txt of IMSLP disallows the paths that
serve them, and this server builds no address under those paths: it hands back
the address of the work page, where the library prints its own notice.

It states no count the library does not publish, and it reports the copyright of
a score per jurisdiction rather than as a single word, because a score free in
Canada can be protected in the United States.

## Pacing

IMSLP publishes `Crawl-delay: 2`. Requests go out one at a time with at least
two seconds between them, and that floor holds however the server is configured.
