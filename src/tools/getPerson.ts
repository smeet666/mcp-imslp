/**
 * get_person: read the page a person is catalogued on.
 */

import { z } from "zod";
import type { ImslpClient } from "../imslp/client.js";
import type { Person } from "../types.js";
import { strictInput } from "./arguments.js";
import { withPrefix } from "./category.js";
import { noteIfTextIsCut, ok, toToolError } from "./shared.js";
import type { ToolResult } from "./shared.js";

export const getPersonDescription = [
  "Read what IMSLP holds about a person: the name as its page prints it, the life dates it states,",
  "the other names it files them under, the registers holding a record of them, and the addresses",
  "it points to off the site.",
  "The person is named by the category the library addresses them by, written",
  "'Category:Surname, Forename', which search_people finds. The prefix may be left out.",
  "Life dates come back in the wording the page used, since the library writes '1861-1934' on one",
  "page and '4 March 1861 — 2 November 1934' on another, and a page holding none says so.",
  "This reads the person; list_person_works reads what they wrote.",
  "When you show a person to a user, credit IMSLP and link the page.",
].join(" ");

export const getPersonInput = strictInput({
  category: z
    .string()
    .min(1)
    .max(300)
    .describe(
      "The person's category, written 'Category:Surname, Forename', for example " +
        "'Category:Satie, Erik'. The prefix is added when it is left out.",
    ),
});

export const getPersonOutputShape = {
  category: z.string().describe("The category the library addresses them by."),
  catalogued_as: z.string().describe("The name without the prefix, surname first."),
  name: z.string().describe("The name as the page prints it, which reads forename first."),
  life_dates: z
    .string()
    .nullable()
    .describe("The dates beside the name, exactly as published. Null when the page prints none."),
  alternative_names: z
    .string()
    .nullable()
    .describe(
      "The other names and transliterations the library files them under, as the line was " +
        "published. It separates names with commas and a name written surname first carries one " +
        "of its own, so the line is not cut into a list.",
    ),
  aliases: z.string().nullable().describe("The aliases line as published, separated the same way."),
  authorities: z.array(
    z.object({
      authority: z.string().describe("The register, for example 'VIAF' or 'BNF'."),
      id: z.string().nullable().describe("The identifier in that register, when it names one."),
      url: z.string(),
    }),
  ),
  external_links: z.array(z.object({ label: z.string(), url: z.string() })),
  page_url: z.string(),
  source: z.literal("IMSLP"),
  license: z.literal("CC BY-SA 4.0"),
  notes: z.array(z.string()),
};

export interface GetPersonArgs {
  category: string;
}

function asText(person: Person): string {
  const lines = [
    person.life_dates === null ? person.name : `${person.name} (${person.life_dates})`,
    person.page_url,
  ];
  if (person.alternative_names !== null) {
    lines.push(`Also written: ${person.alternative_names}`);
  }
  if (person.authorities.length > 0) {
    lines.push(
      `Authorities: ${person.authorities
        .map((entry) => (entry.id === null ? entry.authority : `${entry.authority} ${entry.id}`))
        .join(", ")}`,
    );
  }
  return lines.join("\n");
}

export async function runGetPerson(
  client: ImslpClient,
  args: GetPersonArgs,
  signal?: AbortSignal,
): Promise<ToolResult> {
  try {
    const { data, cached } = await client.getPerson(args.category, signal);

    const notes = [
      `This is the person. Call list_person_works with '${data.category}' for the works the ` +
        "library files under them.",
    ];
    if (data.life_dates === null) {
      notes.push("This page states no life dates, so none are reported rather than guessed.");
    }
    if (cached) {
      notes.push("Served from this server's short-lived in-memory cache.");
    }

    const body = asText(data);
    noteIfTextIsCut(body, notes);

    return ok({ ...data, category: withPrefix(data.category), notes }, body, notes);
  } catch (error) {
    return toToolError(error);
  }
}
