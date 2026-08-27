# Releasing

One version at a time, in this order. Each step depends on the one before it.

## The number

The number says what a version costs whoever installs it. Raising the runtime
floor removes a line of Node that was supported and breaks someone's install:
that is a major, and the changelog names the break first.

The number lives in four files that rise together, and a test reads them
together so none stays behind:

| File                      | What carries it                                    |
| ------------------------- | -------------------------------------------------- |
| `package.json`            | `version`                                          |
| `server.json`             | `version`, the npm package version, the bundle URL |
| `packaging/manifest.json` | `version`                                          |
| `src/version.ts`          | `PKG_VERSION`, which the User-Agent embeds         |

## Before anything

```
npm run build:fixtures && git diff --exit-code test/fixtures
npm run check
npm run typecheck
npm test          # three consecutive identical passes
npm run coverage
npm run build
IMSLP_LIVE=1 npm run test:live
```

The live suite is the one that says whether IMSLP still publishes its pages the
way this server reads them. Run it before a release even though CI does not.

## The order, and why it is an order

1. **npm.** By hand for the first publication of a package that does not exist
   yet, since trusted publishing cannot be configured on an unknown name.
   Everything after that goes through the workflow, under the repository's OIDC
   identity, with no token stored anywhere.
2. **The tag.** `git tag v<version> && git push --tags`. It builds the `.mcpb`
   bundle, opens the GitHub release and files the registry entry.
3. **The official registry.** Its description is capped at **100 characters**
   and it refuses anything longer. It also downloads the bundle URL to check it
   exists, which is why the registry entry follows the npm publication rather
   than preceding it. That URL is computed at publish time, never written by
   hand: written by hand it carries a number that survives a bump and announces
   one version while serving the file of another.
4. **Glama.** Indexing is automatic; the rest needs a signed-in session. Claim
   the server — `glama.json` with `maintainers: ["smeet666"]` is the proof —
   set the build spec, then run **Build alone, followed by Make Release**,
   typing the real number. The combined button picks one of its own.
5. **Third-party directories.** `punkpeye/awesome-mcp-servers` by pull request,
   `mcp-marketplace.io` through the `LAUNCHGUIDE.md` at the root.

## What needs a release, and what does not

npm serves the README frozen at publication, so a README correction reaches
nobody before the next version. What the npm archive carries is what needs one:
the built code, the README, the licence, the changelog and the descriptor.

Workflows, tests, configuration files, the image and the repository settings
take effect without a version.

**When several corrections pile up unpublished, fold them into one version and
one changelog entry** rather than shipping four releases at once.
