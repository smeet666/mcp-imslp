# Security policy

## Reporting a vulnerability

Report privately through
[GitHub security advisories](https://github.com/smeet666/mcp-imslp/security/advisories/new)
rather than in a public issue. You will get an acknowledgement within a few
days.

## What this server can and cannot do

It reads public pages of IMSLP over HTTPS and answers with what it read. It
holds no credentials, writes nothing anywhere, and takes no input beyond the
arguments a tool declares.

Two consequences worth stating plainly:

- **Text from the library reaches a model through this server.** Anyone can edit
  a page of a wiki, so a note on an edition is text written by a stranger.
  Published text is indented under a line introducing it and every line the
  server writes for itself is kept out of reach of what it quotes, so nothing
  from a page can pass as a line of the answer. Treat a quoted note as data.
- **No file is ever downloaded.** The robots.txt of IMSLP disallows the paths
  that serve score files, and this server builds no address under them. What it
  hands back is the address of the work page.

## Supported versions

The latest published version is the supported one.
