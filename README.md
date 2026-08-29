<img src="assets/icon-128.png" alt="" width="96" align="right">

# mcp-imslp

[![npm](https://img.shields.io/npm/v/mcp-imslp.svg)](https://www.npmjs.com/package/mcp-imslp)
[![CI](https://github.com/smeet666/mcp-imslp/actions/workflows/ci.yml/badge.svg)](https://github.com/smeet666/mcp-imslp/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/mcp-imslp.svg)](./LICENSE)
[![MCP Registry](https://img.shields.io/badge/MCP_Registry-listed-6E56CF)](https://registry.modelcontextprotocol.io/v0/servers?search=io.github.smeet666/mcp-imslp)
[![Glama](https://glama.ai/mcp/servers/smeet666/mcp-imslp/badges/score.svg)](https://glama.ai/mcp/servers/smeet666/mcp-imslp)
[![M8ven](https://m8ven.ai/badge/mcp/smeet666-mcp-imslp-7cehun?variant=verified)](https://m8ven.ai/mcp/smeet666-mcp-imslp-7cehun)
[![Install in Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=imslp&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIm1jcC1pbXNscCJdfQ%3D%3D)
[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install-0098FF?style=flat&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=imslp&config=%7B%22name%22%3A%22imslp%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22mcp-imslp%22%5D%7D)

[IMSLP](https://imslp.org), the International Music Score Library Project, is
also called the Petrucci Music Library. It is a free library of classical music
run by volunteers, holding the sheet music, the parts, the arrangements and the
recordings of works whose copyright has lapsed, together with what its pages say
about each composer. It reviews the copyright of every score for Canada, the
United States and the European Union separately, and publishes its pages under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

This server connects a chat client to that library. You can search the works and
the people it catalogues, read a work with its opus number, its key, its
instrumentation and the year it was written, page through the editions a work
holds with their publishers, editors and copyright terms, read what the library
says about a composer, and browse a genre, a key or an instrumentation. It reads
the library and links to it, and it needs no API key and no account.

_[Version française](#mcp-imslp-français)_

---

## Install

**One-click install**

[![Install in Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=imslp&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIm1jcC1pbXNscCJdfQ%3D%3D)
[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install-0098FF?style=flat&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=imslp&config=%7B%22name%22%3A%22imslp%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22mcp-imslp%22%5D%7D)

**Claude Code**

```bash
claude mcp add imslp -- npx -y mcp-imslp
```

**Claude Desktop, Cursor, and any client using the standard config format**

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

Node 24 or later is required, and no environment variable has to be set.

### With Docker

```json
{
  "mcpServers": {
    "imslp": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "ghcr.io/smeet666/mcp-imslp:1.0.1"]
    }
  }
}
```

`-i` keeps stdin open, which is where the protocol travels, and `-t` is left out
because a TTY rewrites the stream. The container needs outbound HTTPS to
`imslp.org`, and nothing else: no volume, no port, no credential.

### Bundle, without npm

Download `mcp-imslp-1.0.1.mcpb` from
[the latest release](https://github.com/smeet666/mcp-imslp/releases/latest) and
open it. A client that supports MCP bundles installs it on its own, with no npm
and no configuration file to edit. The bundle carries its dependencies, so
nothing is fetched at install time.

## What you can ask

- "What does IMSLP hold of Chopin's nocturnes?"
- "Read me the page of Erik Satie and tell me when he lived."
- "List the editions of Debussy's Clair de lune, with who published each one."
- "Is the Henle edition of that piece free to use in the United States?"
- "Show me works for solo cello in the library."

The ordinary path runs from a search to a work: `search_works` names the page of
a work, and `get_work` reads that page. The same holds for a person, from
`search_people` to `get_person` or `list_person_works`.

## Tools

| Tool                | What it does                                                                 |
| ------------------- | ---------------------------------------------------------------------------- |
| `search_works`      | Finds the page of a work by title, composer or words on the page.            |
| `search_people`     | Finds the category a composer, editor, arranger or performer is filed under. |
| `get_work`          | Reads one work: its facets, its sections and its copyright terms.            |
| `list_work_files`   | Pages through the editions a work holds, with their files.                   |
| `list_person_works` | Reads the works the library files under one person.                          |
| `get_person`        | Reads what the library holds about one person.                               |
| `browse_category`   | Reads the works filed under a genre, a key or an instrumentation.            |

A work is addressed by the title of its page, written `Work (Composer)`, as in
`Nocturnes, Op.9 (Chopin, Frédéric)`. A person is addressed by a category,
written `Category:Surname, Forename`. Both come back from a search, and the
`Category:` prefix may be left out.

The library titles a work in the language its composer used, so `Die Zauberflöte`
finds the opera where `The Magic Flute` finds the pages written about it. A thin
answer for a famous work is a sign the title is in another language.

### `search_works`

Searches the pages of the works for words appearing anywhere on them, so a title,
a composer or a dedication all find the works carrying them.

| Argument | Type                            | Required | What it does                                             |
| -------- | ------------------------------- | -------- | -------------------------------------------------------- |
| `query`  | string, 1 to 300 characters     | yes      | What to look for across the pages of the works.          |
| `limit`  | integer, 1 to 50, default `10`  | no       | Rows to serve.                                           |
| `offset` | integer, 0 or more, default `0` | no       | Rows to skip, using the `next_offset` of a prior answer. |

**In return:** rows carrying `page`, which `get_work` takes; `work` and
`composer`, read off that title; `page_url`; `snippet`, the words around the
match; `size_bytes`, `words` and `last_edited` as the library states them. The
envelope carries `returned`, `has_more` and `next_offset`, which is the offset to
read on from. `total` is always `null`: the library publishes no count of what a
search matched. `composer` is `null` on a title written outside the
`Work (Composer)` form, and `snippet` is `null` on a row the search summarised
with nothing.

### `search_people`

Finds the composers, editors, arrangers and performers by name. The library
writes a name its own way, surname first, so searching finds a person where
guessing at the spelling reaches nothing.

| Argument | Type                            | Required | What it does                                             |
| -------- | ------------------------------- | -------- | -------------------------------------------------------- |
| `query`  | string, 1 to 300 characters     | yes      | The name to look for among the people of the library.    |
| `limit`  | integer, 1 to 50, default `10`  | no       | Rows to serve.                                           |
| `offset` | integer, 0 or more, default `0` | no       | Rows to skip, using the `next_offset` of a prior answer. |

**In return:** rows carrying `category`, which `get_person` and
`list_person_works` take; `name` without the prefix; `page_url`; `snippet`; and
`redirect_to`. A row with a `redirect_to` stands for another category and holds
no works of its own, so follow the category it names. The envelope is the one
`search_works` returns, and `total` is `null` here for the same reason.

### `get_work`

Reads one work: its title and alternative titles, the composer, the opus and
catalogue numbers, the year of composition and of first publication, the
dedication, the key, the language, the librettist, the instrumentation, the
movements, the first performance, the style and the period.

| Argument | Type                        | Required   | What it does                                                |
| -------- | --------------------------- | ---------- | ----------------------------------------------------------- |
| `page`   | string, 1 to 300 characters | one of two | The page title, written `Work (Composer)`.                  |
| `pageid` | integer, positive           | one of two | The page id a search returned, as an alternative to `page`. |

**In return:** every facet above, each `null` when the page leaves it empty, and
each in the wording the page used, so `ca.1830` stays `ca.1830`. Beside them come
`genre_categories`, which `browse_category` takes; `external_links` and
`authorities`, the records of the work at VIAF, LCCN, WorldCat, BNF and GND;
`sections`, with the number of entries the site counts in each; and
`copyright_summary`, one entry per distinct statement, with the number of
editions carrying it. `editions` holds every edition with its files, and turns
`null` with `editions_truncated` true when the work holds more than five, which
`list_work_files` then pages through. `redirected_from` names the title asked
for when it led here, and `pageid` is `null` for a work addressed by title.

### `list_work_files`

Reads the scores and the recordings of a work, edition by edition. An edition is
a set of files published under one set of terms: the publisher, the editor and
the copyright statement belong to the edition, and the files sit under it. A
block of recordings carries performers and no copyright statement.

| Argument  | Type                            | Required   | What it does                                                                                                                                     |
| --------- | ------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `page`    | string, 1 to 300 characters     | one of two | The page title, written `Work (Composer)`.                                                                                                       |
| `pageid`  | integer, positive               | one of two | The page id a search returned, as an alternative to `page`.                                                                                      |
| `section` | string, 1 to 80 characters      | no         | One section of the page, in its own wording: `Scores`, `Parts`, `Recordings`, `Arrangements and Transcriptions`. Matched without regard to case. |
| `limit`   | integer, 1 to 100, default `10` | no         | Editions to serve.                                                                                                                               |
| `offset`  | integer, 0 or more, default `0` | no         | Editions to skip.                                                                                                                                |

**In return:** `editions`, each with its `section`, `publisher_info`, `editor`,
`copyright` and `files`. A file carries `imslp_id`, `description`, `format` and
`format_code`, `pages`, `size_bytes`, `downloads`, `rating`, `uploader`,
`uploaded_on`, the sigla and name of the library that scanned it, and `blocked`,
which is true while IMSLP reviews the copyright of that file. `downloads` is
`null` on an entry printing no counter, and `rating` is `null` when nobody has
voted. Alongside come `editions_on_page`, `editions_in_section`, `returned`,
`has_more` and `sections`. A `section` matching nothing comes back with the
sections the page does hold, so a restriction never reads as a work without
scores.

### `list_person_works`

Reads the works the library files under one person: what a composer wrote, and
also what an editor, an arranger or a performer is credited on.

| Argument   | Type                            | Required | What it does                                                    |
| ---------- | ------------------------------- | -------- | --------------------------------------------------------------- |
| `category` | string, 1 to 300 characters     | yes      | The person's category, written `Category:Surname, Forename`.    |
| `limit`    | integer, 1 to 100, default `25` | no       | Rows to serve.                                                  |
| `cursor`   | string, 1 to 500 characters     | no       | The `cursor` a prior answer named, passed back as it was given. |

**In return:** rows carrying `page`, `work`, `composer`, `pageid` and `page_url`,
with `has_more` and `cursor` to read on. `total` is always `null`: the library
publishes no count of what a category holds. A category the library does not hold
answers the way an empty one does, so an answer with no rows is a reason to check
the spelling with `search_people`.

### `get_person`

Reads what the library holds about one person: the name as its page prints it,
the life dates it states, the other names it files them under, the registers
holding a record of them, and the addresses it points to off the site.

| Argument   | Type                        | Required | What it does                                                 |
| ---------- | --------------------------- | -------- | ------------------------------------------------------------ |
| `category` | string, 1 to 300 characters | yes      | The person's category, written `Category:Surname, Forename`. |

**In return:** `category`, `catalogued_as` with the surname first, `name` as the
page prints it, `life_dates` in the wording the page used, `alternative_names`
and `aliases` as published lines, `authorities` with the register and the
identifier at VIAF, LCCN, WorldCat, BNF and GND, `external_links`, and
`page_url`. `life_dates` is `null` on a page stating none. This reads the person;
`list_person_works` reads the works.

### `browse_category`

Reads the works filed under one category: a genre, a key, an instrumentation or a
period. `get_work` hands these names back for a work under `genre_categories`,
and passing one of those reaches a category the library holds.

| Argument   | Type                            | Required | What it does                                                                              |
| ---------- | ------------------------------- | -------- | ----------------------------------------------------------------------------------------- |
| `category` | string, 1 to 300 characters     | yes      | The category to read, in the library's wording: `For piano`, `Nocturnes`, `B-flat minor`. |
| `limit`    | integer, 1 to 100, default `25` | no       | Rows to serve.                                                                            |
| `cursor`   | string, 1 to 500 characters     | no       | The `cursor` a prior answer named, passed back as it was given.                           |

**In return:** the rows `list_person_works` returns, with the same `has_more` and
`cursor`, and `total` at `null`. The library reads one category at a time, so a
question naming both a genre and an instrument is answered by browsing one of
them and reading the other off each work with `get_work`.

## Copyright status

A score on IMSLP carries a status per jurisdiction, and the library reviews
Canada, the United States and the European Union. A file reading
`Public Domain - Non-PD US` is free in Canada and the European Union and
protected in the United States. This server reports the status as published, per
jurisdiction, under `copyright_summary` on a work and under `copyright` on an
edition, with `restrictions` naming the places a statement excludes. An empty
`restrictions` says nothing about the countries IMSLP leaves out of its review.

## Configuration

Every variable is optional. Set them in the `env` block of your client config.

| Variable                  | Default              | What it does                                                                                         |
| ------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------- |
| `IMSLP_USER_AGENT`        | the project identity | Names your application. The project identity is appended so IMSLP can reach a person.                |
| `IMSLP_MIN_INTERVAL_MS`   | `2500`               | Gap between two requests, from 2000 to 60000. A figure under the floor is refused and this one used. |
| `IMSLP_TIMEOUT_MS`        | `30000`              | Deadline for one request, from 1000 to 120000.                                                       |
| `IMSLP_MAX_RETRIES`       | `3`                  | Attempts after a transient failure, from 0 to 10.                                                    |
| `IMSLP_CACHE_TTL_MS`      | `900000`             | How long a page stays in memory, from 0 to 86400000.                                                 |
| `IMSLP_CACHE_MAX_ENTRIES` | `100`                | Pages held in memory at once, from 0 to 10000.                                                       |
| `IMSLP_LOG_LEVEL`         | `error`              | `silent`, `error`, `info` or `debug`, written to stderr.                                             |

A value outside its range falls back to the default, and the reason is written to
stderr.

## Errors

Every failure carries one of six codes, a message, and where it helps a hint
naming the next move.

| Code            | What happened                                           | What to do                                                                                                          |
| --------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `not_found`     | IMSLP answered, and the page asked for is absent.       | Check the title with `search_works`.                                                                                |
| `invalid_input` | The arguments were refused before any request went out. | Read the message, which names the argument.                                                                         |
| `rate_limited`  | IMSLP asked this client to slow down.                   | Wait the number of seconds the hint names and call again with the same arguments. The work is still in the library. |
| `parse_failure` | The page loaded and the expected content was absent.    | Report it at [the issue tracker](https://github.com/smeet666/mcp-imslp/issues).                                     |
| `network_error` | The request did not complete.                           | Try again shortly.                                                                                                  |
| `timeout`       | The request passed its deadline.                        | Raise `IMSLP_TIMEOUT_MS`, or ask for fewer rows.                                                                    |

## As a library

The layer reading IMSLP is published on its own, with its pacing, its cache and
its errors, and with no protocol attached.

```ts
import { ImslpClient } from "mcp-imslp/client";

const client = new ImslpClient();
const { data, cached } = await client.getWork({ page: "Nocturnes, Op.9 (Chopin, Frédéric)" });
console.log(data.title, data.copyright_summary, cached);
```

`renderPage`, `getWork`, `search`, `categoryMembers` and `getPerson` each answer
`{ data, cached }`, and throw an `ImslpError` carrying one of the six codes. The
two-second floor between requests holds here as well.

## Pacing and attribution

IMSLP publishes `Crawl-delay: 2` in its robots.txt, so requests go out one at a
time with at least two seconds between them, and that floor holds however the
server is configured. The `User-Agent` always ends with the project identity and
an address where a person can be reached.

Reads go through the MediaWiki API at `/api.php` and through the listing endpoint
IMSLP documents on its own `IMSLP:API` page. The robots.txt disallows
`/index.php`, `/images/`, `/imglnks/`, `/wiki/File:`, `/works` and `/library/`,
and this server builds no address under any of them: it hands back the link to
the work page, which is what an answer credits.

The library publishes its pages under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), so anything
shown from this server credits IMSLP and links the page it came from.

## Privacy

This server collects nothing about you and sends nothing to its author. It runs
on your machine, contacts `imslp.org` and nothing else, holds its answers in memory
while it runs, and writes nothing to disk.
[PRIVACY.md](PRIVACY.md) states what a request carries and which settings change
any of it.

## Development

```bash
npm install
npm run build:fixtures
npm test
npm run check
```

Tests run against generated fixtures and make no network request. The live suite,
`npm run test:live`, makes one request per route and runs nightly against the
site itself.

## Contributing

Issues and pull requests are welcome at
[the repository](https://github.com/smeet666/mcp-imslp). See
[CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT, see [LICENSE](LICENSE). The catalogue and the pages belong to IMSLP and its
contributors, published under CC BY-SA 4.0.

---

<a name="mcp-imslp-français"></a>

# mcp-imslp (français)

_[English version](#mcp-imslp)_

[IMSLP](https://imslp.org), l'International Music Score Library Project, s'appelle
aussi la Petrucci Music Library. C'est une bibliothèque libre de musique classique
tenue par des bénévoles, qui rassemble les partitions, les parties séparées, les
arrangements et les enregistrements des œuvres tombées dans le domaine public,
avec ce que ses pages disent de chaque compositeur. Elle vérifie les droits de
chaque partition pour le Canada, les États-Unis et l'Union européenne séparément,
et publie ses pages sous
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

Ce serveur relie un client de conversation à cette bibliothèque. On peut y
chercher les œuvres et les personnes qu'elle catalogue, lire une œuvre avec son
numéro d'opus, sa tonalité, son instrumentation et son année de composition,
parcourir les éditions d'une œuvre avec leurs éditeurs et leurs conditions de
droits, lire ce que la bibliothèque dit d'un compositeur, et explorer un genre,
une tonalité ou une instrumentation. Il lit la bibliothèque et renvoie vers elle,
sans clé d'API ni compte.

## Installation

**Installation en un clic**

[![Install in Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=imslp&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIm1jcC1pbXNscCJdfQ%3D%3D)
[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install-0098FF?style=flat&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=imslp&config=%7B%22name%22%3A%22imslp%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22mcp-imslp%22%5D%7D)

**Claude Code**

```bash
claude mcp add imslp -- npx -y mcp-imslp
```

**Claude Desktop, Cursor, et tout client au format de configuration standard**

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

Node 24 ou plus récent est nécessaire, et aucune variable d'environnement n'est à
renseigner.

### Avec Docker

```json
{
  "mcpServers": {
    "imslp": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "ghcr.io/smeet666/mcp-imslp:1.0.1"]
    }
  }
}
```

`-i` garde l'entrée standard ouverte, qui est le canal du protocole, et `-t` est
omis parce qu'un TTY réécrit le flux. Le conteneur a besoin d'un accès HTTPS
sortant vers `imslp.org`, et de rien d'autre : aucun volume, aucun port, aucun
identifiant.

### Bundle, sans npm

Téléchargez `mcp-imslp-1.0.1.mcpb` depuis
[la dernière publication](https://github.com/smeet666/mcp-imslp/releases/latest)
et ouvrez-le. Un client qui gère les bundles MCP l'installe seul, sans npm et
sans fichier de configuration à modifier. Le bundle emporte ses dépendances, donc
rien n'est téléchargé à l'installation.

## Ce qu'on peut demander

- « Qu'est-ce qu'IMSLP a des nocturnes de Chopin ? »
- « Lis-moi la page d'Erik Satie et dis-moi quand il a vécu. »
- « Liste les éditions du Clair de lune de Debussy, avec qui a publié chacune. »
- « Est-ce que l'édition Henle de cette pièce est libre aux États-Unis ? »
- « Montre-moi des œuvres pour violoncelle seul dans la bibliothèque. »

Le chemin ordinaire va d'une recherche à une œuvre : `search_works` nomme la page
d'une œuvre, et `get_work` lit cette page. Il en va de même pour une personne, de
`search_people` vers `get_person` ou `list_person_works`.

## Les outils

| Outil               | Ce qu'il fait                                                          |
| ------------------- | ---------------------------------------------------------------------- |
| `search_works`      | Trouve la page d'une œuvre par son titre, son compositeur ou ses mots. |
| `search_people`     | Trouve la catégorie sous laquelle une personne est classée.            |
| `get_work`          | Lit une œuvre : ses caractéristiques, ses sections et ses droits.      |
| `list_work_files`   | Parcourt les éditions d'une œuvre, avec leurs fichiers.                |
| `list_person_works` | Lit les œuvres que la bibliothèque classe sous une personne.           |
| `get_person`        | Lit ce que la bibliothèque contient sur une personne.                  |
| `browse_category`   | Lit les œuvres classées sous un genre, une tonalité, une formation.    |

Une œuvre s'adresse par le titre de sa page, écrit `Œuvre (Compositeur)`, comme
`Nocturnes, Op.9 (Chopin, Frédéric)`. Une personne s'adresse par une catégorie,
écrite `Category:Nom, Prénom`. Les deux viennent d'une recherche, et le préfixe
`Category:` peut être omis.

La bibliothèque titre une œuvre dans la langue de son compositeur, donc
`Die Zauberflöte` trouve l'opéra là où `La Flûte enchantée` trouve les pages
écrites à son sujet. Une réponse maigre sur une œuvre célèbre est le signe d'un
titre dans une autre langue.

### `search_works`

Cherche dans les pages des œuvres les mots qui y figurent, où qu'ils soient :
un titre, un compositeur ou une dédicace trouvent les œuvres qui les portent.

| Argument | Type                          | Requis | Ce qu'il fait                                                    |
| -------- | ----------------------------- | ------ | ---------------------------------------------------------------- |
| `query`  | chaîne, 1 à 300 caractères    | oui    | Ce qu'on cherche dans les pages des œuvres.                      |
| `limit`  | entier, 1 à 50, défaut `10`   | non    | Lignes à servir.                                                 |
| `offset` | entier, 0 ou plus, défaut `0` | non    | Lignes à sauter, avec le `next_offset` d'une réponse précédente. |

**En retour :** des lignes portant `page`, que `get_work` reprend ; `work` et
`composer`, lus sur ce titre ; `page_url` ; `snippet`, les mots autour de la
correspondance ; `size_bytes`, `words` et `last_edited` tels que la bibliothèque
les publie. L'enveloppe porte `returned`, `has_more` et `next_offset`, l'offset
d'où reprendre. `total` vaut toujours `null` : la bibliothèque ne publie aucun
compte de ce qu'une recherche a trouvé. `composer` vaut `null` sur un titre écrit
hors de la forme `Œuvre (Compositeur)`, et `snippet` vaut `null` sur une ligne
que la recherche n'a résumée par rien.

### `search_people`

Trouve les compositeurs, éditeurs, arrangeurs et interprètes par leur nom. La
bibliothèque écrit un nom à sa façon, patronyme d'abord, donc la recherche trouve
une personne là où une orthographe devinée n'atteint rien.

| Argument | Type                          | Requis | Ce qu'il fait                                                    |
| -------- | ----------------------------- | ------ | ---------------------------------------------------------------- |
| `query`  | chaîne, 1 à 300 caractères    | oui    | Le nom cherché parmi les personnes de la bibliothèque.           |
| `limit`  | entier, 1 à 50, défaut `10`   | non    | Lignes à servir.                                                 |
| `offset` | entier, 0 ou plus, défaut `0` | non    | Lignes à sauter, avec le `next_offset` d'une réponse précédente. |

**En retour :** des lignes portant `category`, que `get_person` et
`list_person_works` reprennent ; `name` sans le préfixe ; `page_url` ; `snippet` ;
et `redirect_to`. Une ligne portant un `redirect_to` tient lieu d'une autre
catégorie et ne contient aucune œuvre, donc suivez la catégorie qu'elle nomme.
L'enveloppe est celle de `search_works`, et `total` y vaut `null` pour la même
raison.

### `get_work`

Lit une œuvre : son titre et ses titres alternatifs, le compositeur, les numéros
d'opus et de catalogue, l'année de composition et celle de première publication,
la dédicace, la tonalité, la langue, le librettiste, l'instrumentation, les
mouvements, la création, le style et la période.

| Argument | Type                       | Requis        | Ce qu'il fait                                     |
| -------- | -------------------------- | ------------- | ------------------------------------------------- |
| `page`   | chaîne, 1 à 300 caractères | l'un des deux | Le titre de la page, écrit `Œuvre (Compositeur)`. |
| `pageid` | entier, positif            | l'un des deux | L'identifiant de page rendu par une recherche.    |

**En retour :** chacune des caractéristiques ci-dessus, `null` quand la page la
laisse vide, et dans les termes de la page, donc `ca.1830` reste `ca.1830`.
À côté viennent `genre_categories`, que `browse_category` reprend ;
`external_links` et `authorities`, les notices de l'œuvre au VIAF, à la LCCN, à
WorldCat, à la BNF et à la GND ; `sections`, avec le nombre d'entrées que le site
compte dans chacune ; et `copyright_summary`, une entrée par mention distincte,
avec le nombre d'éditions qui la portent. `editions` contient chaque édition et
ses fichiers, et passe à `null` avec `editions_truncated` à vrai au-delà de cinq
éditions, que `list_work_files` parcourt alors. `redirected_from` nomme le titre
demandé quand il a mené ici, et `pageid` vaut `null` pour une œuvre adressée par
son titre.

### `list_work_files`

Lit les partitions et les enregistrements d'une œuvre, édition par édition. Une
édition est un ensemble de fichiers publiés sous les mêmes conditions :
l'éditeur, le réviseur et la mention de droits appartiennent à l'édition, et les
fichiers se rangent dessous. Un bloc d'enregistrements porte des interprètes et
aucune mention de droits.

| Argument  | Type                          | Requis        | Ce qu'il fait                                                                                                                               |
| --------- | ----------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `page`    | chaîne, 1 à 300 caractères    | l'un des deux | Le titre de la page, écrit `Œuvre (Compositeur)`.                                                                                           |
| `pageid`  | entier, positif               | l'un des deux | L'identifiant de page rendu par une recherche.                                                                                              |
| `section` | chaîne, 1 à 80 caractères     | non           | Une section de la page, dans ses propres termes : `Scores`, `Parts`, `Recordings`, `Arrangements and Transcriptions`. La casse est ignorée. |
| `limit`   | entier, 1 à 100, défaut `10`  | non           | Éditions à servir.                                                                                                                          |
| `offset`  | entier, 0 ou plus, défaut `0` | non           | Éditions à sauter.                                                                                                                          |

**En retour :** `editions`, chacune avec sa `section`, son `publisher_info`, son
`editor`, son `copyright` et ses `files`. Un fichier porte `imslp_id`,
`description`, `format` et `format_code`, `pages`, `size_bytes`, `downloads`,
`rating`, `uploader`, `uploaded_on`, le sigle et le nom de la bibliothèque qui l'a
numérisé, et `blocked`, vrai tant qu'IMSLP vérifie les droits de ce fichier.
`downloads` vaut `null` sur une entrée sans compteur, et `rating` vaut `null`
quand personne n'a voté. Viennent aussi `editions_on_page`,
`editions_in_section`, `returned`, `has_more` et `sections`. Une `section` qui ne
correspond à rien revient avec les sections que la page contient, donc une
restriction ne se lit jamais comme une œuvre sans partition.

### `list_person_works`

Lit les œuvres que la bibliothèque classe sous une personne : ce qu'un
compositeur a écrit, et aussi ce sur quoi un réviseur, un arrangeur ou un
interprète est crédité.

| Argument   | Type                         | Requis | Ce qu'il fait                                                   |
| ---------- | ---------------------------- | ------ | --------------------------------------------------------------- |
| `category` | chaîne, 1 à 300 caractères   | oui    | La catégorie de la personne, écrite `Category:Nom, Prénom`.     |
| `limit`    | entier, 1 à 100, défaut `25` | non    | Lignes à servir.                                                |
| `cursor`   | chaîne, 1 à 500 caractères   | non    | Le `cursor` nommé par une réponse précédente, redonné tel quel. |

**En retour :** des lignes portant `page`, `work`, `composer`, `pageid` et
`page_url`, avec `has_more` et `cursor` pour poursuivre. `total` vaut toujours
`null` : la bibliothèque ne publie aucun compte de ce que contient une catégorie.
Une catégorie qu'elle ne contient pas répond comme une catégorie vide, donc une
réponse sans ligne invite à vérifier l'orthographe avec `search_people`.

### `get_person`

Lit ce que la bibliothèque contient sur une personne : le nom tel que sa page
l'imprime, les dates de vie qu'elle indique, les autres noms sous lesquels elle
la classe, les registres qui en tiennent une notice, et les adresses vers
lesquelles elle renvoie hors du site.

| Argument   | Type                       | Requis | Ce qu'il fait                                               |
| ---------- | -------------------------- | ------ | ----------------------------------------------------------- |
| `category` | chaîne, 1 à 300 caractères | oui    | La catégorie de la personne, écrite `Category:Nom, Prénom`. |

**En retour :** `category`, `catalogued_as` avec le patronyme d'abord, `name` tel
que la page l'imprime, `life_dates` dans les termes de la page,
`alternative_names` et `aliases` comme lignes publiées, `authorities` avec le
registre et l'identifiant au VIAF, à la LCCN, à WorldCat, à la BNF et à la GND,
`external_links`, et `page_url`. `life_dates` vaut `null` sur une page qui n'en
indique aucune. Cet outil lit la personne ; `list_person_works` lit les œuvres.

### `browse_category`

Lit les œuvres classées sous une catégorie : un genre, une tonalité, une
instrumentation ou une période. `get_work` rend ces noms pour une œuvre sous
`genre_categories`, et en redonner un atteint une catégorie que la bibliothèque
contient.

| Argument   | Type                         | Requis | Ce qu'il fait                                                                                       |
| ---------- | ---------------------------- | ------ | --------------------------------------------------------------------------------------------------- |
| `category` | chaîne, 1 à 300 caractères   | oui    | La catégorie à lire, dans les termes de la bibliothèque : `For piano`, `Nocturnes`, `B-flat minor`. |
| `limit`    | entier, 1 à 100, défaut `25` | non    | Lignes à servir.                                                                                    |
| `cursor`   | chaîne, 1 à 500 caractères   | non    | Le `cursor` nommé par une réponse précédente, redonné tel quel.                                     |

**En retour :** les lignes que rend `list_person_works`, avec les mêmes
`has_more` et `cursor`, et `total` à `null`. La bibliothèque lit une catégorie à
la fois, donc une question nommant un genre et un instrument se répond en
parcourant l'un et en lisant l'autre sur chaque œuvre avec `get_work`.

## Le statut de droits

Une partition porte sur IMSLP un statut par juridiction, et la bibliothèque
vérifie le Canada, les États-Unis et l'Union européenne. Un fichier marqué
`Public Domain - Non-PD US` est libre au Canada et dans l'Union européenne, et
protégé aux États-Unis. Ce serveur rend le statut tel qu'il est publié,
juridiction par juridiction, sous `copyright_summary` pour une œuvre et sous
`copyright` pour une édition, avec `restrictions` qui nomme les endroits qu'une
mention exclut. Un `restrictions` vide n'affirme rien sur les pays qu'IMSLP
laisse hors de sa vérification.

## Configuration

Chaque variable est facultative. Elles se posent dans le bloc `env` de la
configuration du client.

| Variable                  | Défaut               | Ce qu'elle fait                                                                                            |
| ------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------- |
| `IMSLP_USER_AGENT`        | l'identité du projet | Nomme votre application. L'identité du projet est ajoutée pour qu'IMSLP puisse joindre une personne.       |
| `IMSLP_MIN_INTERVAL_MS`   | `2500`               | Écart entre deux requêtes, de 2000 à 60000. Une valeur sous le plancher est refusée au profit de celle-ci. |
| `IMSLP_TIMEOUT_MS`        | `30000`              | Délai d'une requête, de 1000 à 120000.                                                                     |
| `IMSLP_MAX_RETRIES`       | `3`                  | Tentatives après un échec passager, de 0 à 10.                                                             |
| `IMSLP_CACHE_TTL_MS`      | `900000`             | Durée pendant laquelle une page reste en mémoire, de 0 à 86400000.                                         |
| `IMSLP_CACHE_MAX_ENTRIES` | `100`                | Pages gardées en mémoire à la fois, de 0 à 10000.                                                          |
| `IMSLP_LOG_LEVEL`         | `error`              | `silent`, `error`, `info` ou `debug`, écrit sur la sortie d'erreur.                                        |

Une valeur hors de sa plage retombe sur le défaut, et la raison est écrite sur la
sortie d'erreur.

## Erreurs

Chaque échec porte un des six codes, un message, et quand cela aide une
indication du geste suivant.

| Code            | Ce qui s'est passé                                 | Que faire                                                                                                        |
| --------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `not_found`     | IMSLP a répondu, et la page demandée est absente.  | Vérifiez le titre avec `search_works`.                                                                           |
| `invalid_input` | Les arguments ont été refusés avant toute requête. | Lisez le message, qui nomme l'argument.                                                                          |
| `rate_limited`  | IMSLP demande à ce client de ralentir.             | Attendez les secondes indiquées et rappelez avec les mêmes arguments. L'œuvre est toujours dans la bibliothèque. |
| `parse_failure` | La page a chargé et le contenu attendu est absent. | Signalez-le sur [le suivi d'incidents](https://github.com/smeet666/mcp-imslp/issues).                            |
| `network_error` | La requête n'a pas abouti.                         | Réessayez sous peu.                                                                                              |
| `timeout`       | La requête a dépassé son délai.                    | Augmentez `IMSLP_TIMEOUT_MS`, ou demandez moins de lignes.                                                       |

## Comme bibliothèque

La couche qui lit IMSLP est publiée seule, avec son rythme, son cache et ses
erreurs, sans protocole attaché.

```ts
import { ImslpClient } from "mcp-imslp/client";

const client = new ImslpClient();
const { data, cached } = await client.getWork({ page: "Nocturnes, Op.9 (Chopin, Frédéric)" });
console.log(data.title, data.copyright_summary, cached);
```

`renderPage`, `getWork`, `search`, `categoryMembers` et `getPerson` répondent
chacun `{ data, cached }`, et lèvent une `ImslpError` portant un des six codes.
Le plancher de deux secondes entre deux requêtes tient également ici.

## Rythme et attribution

IMSLP publie `Crawl-delay: 2` dans son robots.txt, donc les requêtes partent une
à une avec au moins deux secondes entre elles, et ce plancher tient quelle que
soit la configuration. Le `User-Agent` se termine toujours par l'identité du
projet et une adresse où joindre une personne.

Les lectures passent par l'API MediaWiki `/api.php` et par le point d'entrée
qu'IMSLP documente sur sa page `IMSLP:API`. Le robots.txt interdit `/index.php`,
`/images/`, `/imglnks/`, `/wiki/File:`, `/works` et `/library/`, et ce serveur ne
construit aucune adresse sous ces chemins : il rend le lien de la page de
l'œuvre, qui est ce qu'une réponse crédite.

La bibliothèque publie ses pages sous
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), donc tout ce que
ce serveur rend attribue à IMSLP et renvoie vers la page d'origine.

## Confidentialité

Ce serveur ne collecte rien sur vous et n'envoie rien à son auteur. Il tourne sur
votre machine, ne joint que `imslp.org`, garde ses réponses en mémoire le temps qu'il
tourne, et n'écrit rien sur le disque. [PRIVACY.md](PRIVACY.md) dit ce qu'une
requête emporte et quels réglages changent cela.

## Développement

```bash
npm install
npm run build:fixtures
npm test
npm run check
```

Les tests s'exécutent sur des fixtures engendrées et n'émettent aucune requête.
La suite en direct, `npm run test:live`, émet une requête par route et tourne
chaque nuit contre le site lui-même.

## Contribuer

Les tickets et les propositions de modification sont bienvenus sur
[le dépôt](https://github.com/smeet666/mcp-imslp). Voir
[CONTRIBUTING.md](CONTRIBUTING.md).

## Licence

MIT, voir [LICENSE](LICENSE). Le catalogue et les pages appartiennent à IMSLP et
à ses contributeurs, publiés sous CC BY-SA 4.0.
