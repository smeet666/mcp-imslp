/**
 * How a tool declares its arguments, and what happens to one it never declared.
 *
 * A caller branches on the code a refusal opens with, and an argument is
 * refused along two paths: the code of a tool, and the schema before that code
 * runs. Both open with the same code, so the vocabulary is the same whichever
 * path refused.
 */

import { describe, expect, it } from "vitest";
import { z } from "zod";
import { strictInput } from "../../src/tools/arguments.js";

const schema = strictInput({
  page: z.string().min(1).max(300).optional(),
  pageid: z.number().int().positive().optional(),
});

function refusalFor(input: Record<string, unknown>): string {
  const outcome = schema.safeParse(input);
  return outcome.error?.issues[0]?.message ?? "";
}

describe("an argument this server does not declare", () => {
  it("is refused rather than dropped", () => {
    // Dropping it answers on the defaults, which a caller reads as the answer
    // to the question they asked.
    expect(schema.safeParse({ page: "A work (A composer)", colour: "blue" }).success).toBe(false);
  });

  it("names it, and offers the declared name when one is close", () => {
    const message = refusalFor({ pagee: "A work (A composer)" });

    expect(message).toContain("[invalid_input]");
    expect(message).toContain("'pagee'");
    expect(message).toContain("page");
  });

  it("names them all when there are several", () => {
    expect(refusalFor({ one: 1, two: 2 })).toContain("Unknown arguments");
  });

  it("offers nothing when nothing declared is close enough", () => {
    const message = refusalFor({ zzzzzzzz: 1 });

    expect(message).toContain("'zzzzzzzz'");
    expect(message).not.toContain("did you mean");
  });
});

describe("a bound a declared argument carries", () => {
  it("refuses in the same vocabulary as everything else", () => {
    // A bound raises its issue from the check that holds it, so a map written
    // only onto the schema would let this one refuse in another vocabulary.
    expect(refusalFor({ page: "" })).toContain("[invalid_input]");
    expect(refusalFor({ pageid: -3 })).toContain("[invalid_input]");
  });

  it("refuses a value of the wrong type in that vocabulary too", () => {
    expect(refusalFor({ pageid: "twelve" })).toContain("[invalid_input]");
  });
});

describe("a declaration that is met", () => {
  it("passes the arguments through", () => {
    expect(schema.parse({ page: "A work (A composer)" })).toEqual({
      page: "A work (A composer)",
    });
  });
});
