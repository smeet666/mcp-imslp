/**
 * The six codes, and what each one tells a caller to do next.
 *
 * A failure reported as an empty result is the defect these guard against: a
 * model reading "no work found" says the library does not hold the score.
 */

import { describe, expect, it } from "vitest";
import {
  ImslpError,
  invalidInput,
  notFound,
  parseFailure,
  rateLimited,
  upstreamError,
} from "../../src/errors.js";

const URL_UNDER_TEST = "https://imslp.org/api.php";

describe("an absence", () => {
  it("says the address holds nothing, and how a title is written", () => {
    const error = notFound(URL_UNDER_TEST, "that address");

    expect(error.code).toBe("not_found");
    expect(error.details.status).toBe(404);
    expect(error.details.hint).toContain("Work (Composer)");
  });
});

describe("a refusal", () => {
  it("carries the hint when it was given one, and none when it was not", () => {
    expect(invalidInput("no", "try this").details.hint).toBe("try this");
    expect(invalidInput("no").details).toEqual({});
  });
});

describe("pushback from the site", () => {
  it("never reads as an absence, and says how long to wait", () => {
    const error = rateLimited(URL_UNDER_TEST, 4000);

    expect(error.code).toBe("rate_limited");
    expect(error.message).toContain("does NOT mean the work is absent");
    expect(error.details.hint).toContain("4 seconds");
  });
});

describe("an answer this client could not read", () => {
  it("names what was expected and where to report it", () => {
    const error = parseFailure(URL_UNDER_TEST, "no rendered text");

    expect(error.code).toBe("parse_failure");
    expect(error.details.hint).toContain("issues");
  });
});

describe("an error from the site", () => {
  it("says a 5xx is theirs to fix, and leaves a 4xx unqualified", () => {
    expect(upstreamError(URL_UNDER_TEST, 500).details.hint).toContain("IMSLP side");
    expect(upstreamError(URL_UNDER_TEST, 400).details.hint).toBeUndefined();
  });
});

describe("the error type itself", () => {
  it("names itself, so a caller catching it can tell what it is", () => {
    expect(new ImslpError("timeout", "gone").name).toBe("ImslpError");
  });
});
