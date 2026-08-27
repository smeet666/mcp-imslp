# mcp-imslp

An MCP server for [IMSLP](https://imslp.org), the Petrucci Music Library: works,
scores and recordings of classical music, catalogued by the volunteers who run
it. No API key and no account are needed.

The library publishes its pages under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), so anything
shown from this server credits IMSLP and links the page it came from.

## What it reads, and what it leaves alone

Reads go through the MediaWiki API at `/api.php` and through the listing
endpoint IMSLP documents on its own `IMSLP:API` page. The robots.txt of the site
disallows `/index.php`, `/images/`, `/imglnks/`, `/wiki/File:`, `/works` and
`/library/`, and this server builds no address under any of them: **it downloads
no score file**, and hands back the link to the work page instead.

IMSLP publishes `Crawl-delay: 2`, so requests run one at a time with at least
two seconds between them. That floor holds however the server is configured.

## Copyright status

A score on IMSLP carries a status per jurisdiction, and the library reviews
Canada, the United States and the European Union. A file can read
`Public Domain - Non-PD US`: free in one place and protected in another. This
server reports the status as published, per jurisdiction, and never flattens it
into "public domain".

## Configuration

| Variable | Default | What it does |
| --- | --- | --- |
| `IMSLP_USER_AGENT` | the project identity | Names your application; the project identity is appended so IMSLP can reach a person |
| `IMSLP_MIN_INTERVAL_MS` | 2500 | Gap between requests, never below 2000 |
| `IMSLP_TIMEOUT_MS` | 30000 | Deadline for one request |
| `IMSLP_MAX_RETRIES` | 3 | Attempts after a transient failure |
| `IMSLP_CACHE_TTL_MS` | 900000 | How long a page stays in memory |
| `IMSLP_CACHE_MAX_ENTRIES` | 100 | Pages held at once |
| `IMSLP_LOG_LEVEL` | `error` | `silent`, `error`, `info` or `debug`, on stderr |

## Licence

MIT, see [LICENSE](LICENSE). The data belongs to IMSLP and its contributors.

---

# mcp-imslp (français)

Un serveur MCP pour [IMSLP](https://imslp.org), la Petrucci Music Library :
œuvres, partitions et enregistrements de musique classique, catalogués par les
bénévoles qui la tiennent. Aucune clé d'API, aucun compte.

La bibliothèque publie ses pages sous CC BY-SA 4.0, donc tout ce que ce serveur
rend attribue à IMSLP et renvoie vers la page d'origine.

## Ce qu'il lit, et ce qu'il laisse

Les lectures passent par l'API MediaWiki `/api.php` et par le point d'entrée
qu'IMSLP documente sur sa page `IMSLP:API`. Le `robots.txt` du site interdit
`/index.php`, `/images/`, `/imglnks/`, `/wiki/File:`, `/works` et `/library/`, et
ce serveur ne construit aucune adresse sous ces chemins : **il ne télécharge
aucun fichier de partition** et rend le lien de la page de l'œuvre.

IMSLP publie `Crawl-delay: 2`, donc les requêtes partent une à une, avec au
moins deux secondes entre elles, quelle que soit la configuration.

## Le statut de droits

Une partition porte sur IMSLP un statut par juridiction, et la bibliothèque
vérifie le Canada, les États-Unis et l'Union européenne. Un fichier peut être
`Public Domain - Non-PD US` : libre ici et protégé ailleurs. Ce serveur rend le
statut tel qu'il est publié, juridiction par juridiction.
