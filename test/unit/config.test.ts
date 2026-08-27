/**
 * What the environment can ask of this client, and what it cannot.
 *
 * A value outside what a field accepts falls back to the default rather than
 * stopping the process: a typo in a host's config file is close to unreadable
 * from inside that host, and a server that refuses to start says nothing.
 */

import process from "node:process";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULTS,
  DEFAULT_USER_AGENT,
  MIN_ALLOWED_INTERVAL_MS,
  createLogger,
  loadConfig,
  withProjectIdentity,
} from "../../src/config.js";

function warnings(): string[] {
  return (process.stderr.write as unknown as { mock: { calls: string[][] } }).mock.calls.map(
    (call) => String(call[0]),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the defaults", () => {
  it("names the project and reaches a person", () => {
    expect(loadConfig({}).userAgent).toBe(DEFAULT_USER_AGENT);
    expect(DEFAULT_USER_AGENT).toContain("github.com/smeet666/mcp-imslp");
  });

  it("paces at the default interval", () => {
    expect(loadConfig({}).minIntervalMs).toBe(DEFAULTS.minIntervalMs);
  });
});

describe("the interval floor", () => {
  it("refuses an interval under the crawl delay the site publishes", () => {
    vi.spyOn(process.stderr, "write").mockReturnValue(true);

    const config = loadConfig({ IMSLP_MIN_INTERVAL_MS: "10" });

    expect(config.minIntervalMs).toBe(DEFAULTS.minIntervalMs);
    expect(warnings().join(" ")).toContain(String(MIN_ALLOWED_INTERVAL_MS));
  });

  it("accepts an interval above the floor", () => {
    expect(loadConfig({ IMSLP_MIN_INTERVAL_MS: "4000" }).minIntervalMs).toBe(4000);
  });

  it("caps an interval nobody would wait through", () => {
    expect(loadConfig({ IMSLP_MIN_INTERVAL_MS: "999999" }).minIntervalMs).toBe(60_000);
  });

  it("ignores an interval that is not a number", () => {
    vi.spyOn(process.stderr, "write").mockReturnValue(true);

    expect(loadConfig({ IMSLP_MIN_INTERVAL_MS: "soon" }).minIntervalMs).toBe(
      DEFAULTS.minIntervalMs,
    );
    expect(warnings().join(" ")).toContain("is not a number");
  });

  it("reads an empty value as unset", () => {
    expect(loadConfig({ IMSLP_MIN_INTERVAL_MS: "  " }).minIntervalMs).toBe(DEFAULTS.minIntervalMs);
  });
});

describe("the numeric fields", () => {
  it("reads a value inside the range", () => {
    expect(loadConfig({ IMSLP_MAX_RETRIES: "1" }).maxRetries).toBe(1);
  });

  it("falls back rather than clamping a value outside the range", () => {
    // Clamping would turn "-1 retries" into "never retry", which looks like
    // working configuration and is not what was asked for.
    vi.spyOn(process.stderr, "write").mockReturnValue(true);

    expect(loadConfig({ IMSLP_MAX_RETRIES: "-1" }).maxRetries).toBe(DEFAULTS.maxRetries);
    expect(warnings().join(" ")).toContain("outside the accepted range");
  });

  it("ignores a value that is not a number", () => {
    vi.spyOn(process.stderr, "write").mockReturnValue(true);

    expect(loadConfig({ IMSLP_TIMEOUT_MS: "later" }).timeoutMs).toBe(DEFAULTS.timeoutMs);
  });

  it("reads an empty value as unset", () => {
    expect(loadConfig({ IMSLP_CACHE_TTL_MS: "" }).cacheTtlMs).toBe(DEFAULTS.cacheTtlMs);
    expect(loadConfig({ IMSLP_CACHE_MAX_ENTRIES: "3" }).cacheMaxEntries).toBe(3);
  });
});

describe("the log level", () => {
  it("reads a level it knows", () => {
    expect(loadConfig({ IMSLP_LOG_LEVEL: "DEBUG" }).logLevel).toBe("debug");
  });

  it("ignores one it does not", () => {
    vi.spyOn(process.stderr, "write").mockReturnValue(true);

    expect(loadConfig({ IMSLP_LOG_LEVEL: "loud" }).logLevel).toBe(DEFAULTS.logLevel);
    expect(warnings().join(" ")).toContain("is unknown");
  });
});

describe("the identity the site sees", () => {
  it("keeps the caller's name and appends the project's", () => {
    expect(withProjectIdentity("my-app/1.0")).toBe(`my-app/1.0 ${DEFAULT_USER_AGENT}`);
  });

  it("leaves an identity that already names the project alone", () => {
    expect(withProjectIdentity(DEFAULT_USER_AGENT)).toBe(DEFAULT_USER_AGENT);
  });

  it("falls back to the project identity when the caller names nothing", () => {
    expect(withProjectIdentity("   ")).toBe(DEFAULT_USER_AGENT);
    expect(loadConfig({ IMSLP_USER_AGENT: "  " }).userAgent).toBe(DEFAULT_USER_AGENT);
  });
});

describe("the logger", () => {
  it("writes to stderr, since stdout carries the protocol", () => {
    vi.spyOn(process.stderr, "write").mockReturnValue(true);

    createLogger("debug").debug("a line");

    expect(warnings().join(" ")).toContain("a line");
  });

  it("says nothing below the level it was given", () => {
    vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const logger = createLogger("error");

    logger.info("quiet");
    logger.debug("quieter");
    logger.error("loud");

    expect(warnings()).toHaveLength(1);
  });

  it("says nothing at all when silenced", () => {
    vi.spyOn(process.stderr, "write").mockReturnValue(true);

    createLogger("silent").error("nothing");

    expect(warnings()).toHaveLength(0);
  });

  it("reads the process environment when none is given", () => {
    expect(loadConfig().minIntervalMs).toBeGreaterThanOrEqual(MIN_ALLOWED_INTERVAL_MS);
  });
});
