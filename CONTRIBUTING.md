# Contributing

Thank you for reading this before opening a pull request.

## What this server is

A read-only client for IMSLP, the Petrucci Music Library. It reads public pages,
writes nothing back, and needs no key and no account. A change that would make
it write, upload, or contribute anything to the library is out of scope.

## The rule that governs the rest

**The server never states anything the data does not carry.** Most of the
defects fixed so far were variants of that single fault:

- a failure reported as an empty result, which reads as an absence;
- a `null` reported as a value, so a rating nobody voted on becomes a score;
- a counter that lies about what it counts;
- a restriction that manufactures an absence rather than saying what it set
  aside.

An honest negative answer is a good answer. The library does not hold every
work, and saying so is the right result.

## How a change is made

**Tests first, without exception.** A defect is fixed by writing the test that
states the right answer, then correcting the code. A test written afterwards
proves only what the code already does.

**Tests are deterministic or they do not exist.** Anything touching time goes
through fake timers with a fixed epoch. No tolerance constants, no measurement
of a real clock. The gate is three consecutive identical passes.

**Fixtures are generated, never captured.** `scripts/build-fixtures.mjs` writes
an invented corpus, so the tests are reproducible and no page of the library is
stored in this repository. Run `npm run build:fixtures` after editing the
generator, and commit what it writes.

**Coverage has a floor and it does not go down.** The suite covers every
statement, branch, function and line.

```
npm run build:fixtures   # the corpus the tests read
npm test                 # unit tests
npm run coverage         # with the floor enforced
npm run check            # formatting and lint, as CI runs them
npm run typecheck
```

The live suite reads the library itself and is opt-in for that reason:

```
IMSLP_LIVE=1 npm run test:live
```

## What the server owes the library

IMSLP publishes `Crawl-delay: 2` and is run by a small organisation living on
donations. Requests go out one at a time with at least two seconds between them,
and that floor holds however the client is configured, including through the
published `./client` entry point. The User-Agent always carries the project
identity and an address where a person can be reached.

The robots.txt disallows `/index.php`, `/images/`, `/imglnks/`, `/wiki/File:`,
`/works` and `/library/`. No address is built under any of them.

## Writing

Everything written here is read by someone who has never seen a previous
version: comments, README lines, tool descriptions. Never write "as before",
"now", "unlike", or "previously". Describe what the code does and why. A comment
explains an invariant or a reason, never the obvious.
