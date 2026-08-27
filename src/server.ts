/**
 * MCP server wiring.
 *
 * One client, one rate limiter and one cache are shared by all tools, so pacing
 * applies to the server as a whole rather than per tool, and a work page read
 * for its facets and read again for its files costs one request.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Config, Logger } from "./config.js";
import { createLogger, loadConfig } from "./config.js";
import { ImslpClient } from "./imslp/client.js";
import type { GetWorkArgs } from "./tools/getWork.js";
import {
  getWorkDescription,
  getWorkInput,
  getWorkOutputShape,
  runGetWork,
} from "./tools/getWork.js";
import type { ListWorkFilesArgs } from "./tools/listWorkFiles.js";
import {
  listWorkFilesDescription,
  listWorkFilesInput,
  listWorkFilesOutputShape,
  runListWorkFiles,
} from "./tools/listWorkFiles.js";
import type { BrowseCategoryArgs } from "./tools/browseCategory.js";
import {
  browseCategoryDescription,
  browseCategoryInput,
  browseCategoryOutputShape,
  runBrowseCategory,
} from "./tools/browseCategory.js";
import type { GetPersonArgs } from "./tools/getPerson.js";
import {
  getPersonDescription,
  getPersonInput,
  getPersonOutputShape,
  runGetPerson,
} from "./tools/getPerson.js";
import type { ListPersonWorksArgs } from "./tools/listPersonWorks.js";
import {
  listPersonWorksDescription,
  listPersonWorksInput,
  listPersonWorksOutputShape,
  runListPersonWorks,
} from "./tools/listPersonWorks.js";
import type { SearchPeopleArgs } from "./tools/searchPeople.js";
import {
  runSearchPeople,
  searchPeopleDescription,
  searchPeopleInput,
  searchPeopleOutputShape,
} from "./tools/searchPeople.js";
import type { SearchWorksArgs } from "./tools/searchWorks.js";
import {
  runSearchWorks,
  searchWorksDescription,
  searchWorksInput,
  searchWorksOutputShape,
} from "./tools/searchWorks.js";
import { PKG_VERSION } from "./version.js";

export interface CreateServerOptions {
  config?: Config;
  logger?: Logger;
  fetchImpl?: typeof fetch;
}

/** This server only reads, so every tool is read-only. */
export const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

export function createServer(options: CreateServerOptions = {}): McpServer {
  const config = options.config ?? loadConfig();
  const logger = options.logger ?? createLogger(config.logLevel);
  const client = new ImslpClient({
    config,
    logger,
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
  });

  const server = new McpServer(
    { name: "mcp-imslp", version: PKG_VERSION },
    {
      instructions:
        "Tools for the Petrucci Music Library at IMSLP: scores and recordings of classical works, " +
        "catalogued by the volunteers who run it. No API key and no account are needed. " +
        "Start at search_works to find the page of a work, or at search_people to find the " +
        "category a person is addressed by. A work is addressed by the title of its page, which " +
        "is written 'Work (Composer)', for example 'Nocturnes, Op.9 (Chopin, Frédéric)'. " +
        "The library publishes no count of what a search matched or of what a category holds, so " +
        "no answer states one; each says instead whether more rows remained and how to read them. " +
        "list_person_works reads what a person wrote, get_person reads the person, and " +
        "browse_category reads a genre, a key or an instrumentation, one category at a time. The copyright status of a score is stated " +
        "per jurisdiction, and IMSLP reviews Canada, the United States and the European Union: a " +
        "score can be free in one and protected in another, so never report it as public domain " +
        "without saying where. This server reads the library and links to it; it downloads no " +
        "score file. get_work answers the work itself and carries its editions when there are few " +
        "of them; list_work_files pages through them when there are many, and can be restricted " +
        "to one section of the page in the wording that page prints. Credit IMSLP and link the " +
        "work page when you show a result, and name the CC BY-SA 4.0 licence the library " +
        "publishes its pages under.",
    },
  );

  // Tools are registered in a deterministic order, which is what a client
  // caches a tool list against. They share one client, so the pacing and the
  // cache belong to the server rather than to a tool.
  server.registerTool(
    "search_works",
    {
      title: "Search the works",
      description: searchWorksDescription,
      inputSchema: searchWorksInput,
      outputSchema: z.object(searchWorksOutputShape),
      annotations: READ_ONLY,
    },
    async (args, extra) => runSearchWorks(client, args as SearchWorksArgs, extra?.signal),
  );

  server.registerTool(
    "search_people",
    {
      title: "Search the people",
      description: searchPeopleDescription,
      inputSchema: searchPeopleInput,
      outputSchema: z.object(searchPeopleOutputShape),
      annotations: READ_ONLY,
    },
    async (args, extra) => runSearchPeople(client, args as SearchPeopleArgs, extra?.signal),
  );

  server.registerTool(
    "get_work",
    {
      title: "Read a work",
      description: getWorkDescription,
      inputSchema: getWorkInput,
      outputSchema: z.object(getWorkOutputShape),
      annotations: READ_ONLY,
    },
    async (args, extra) => runGetWork(client, args as GetWorkArgs, extra?.signal),
  );

  server.registerTool(
    "list_work_files",
    {
      title: "Read the editions of a work",
      description: listWorkFilesDescription,
      inputSchema: listWorkFilesInput,
      outputSchema: z.object(listWorkFilesOutputShape),
      annotations: READ_ONLY,
    },
    async (args, extra) => runListWorkFiles(client, args as ListWorkFilesArgs, extra?.signal),
  );

  server.registerTool(
    "list_person_works",
    {
      title: "Read the works of a person",
      description: listPersonWorksDescription,
      inputSchema: listPersonWorksInput,
      outputSchema: z.object(listPersonWorksOutputShape),
      annotations: READ_ONLY,
    },
    async (args, extra) => runListPersonWorks(client, args as ListPersonWorksArgs, extra?.signal),
  );

  server.registerTool(
    "get_person",
    {
      title: "Read a person",
      description: getPersonDescription,
      inputSchema: getPersonInput,
      outputSchema: z.object(getPersonOutputShape),
      annotations: READ_ONLY,
    },
    async (args, extra) => runGetPerson(client, args as GetPersonArgs, extra?.signal),
  );

  server.registerTool(
    "browse_category",
    {
      title: "Browse a category",
      description: browseCategoryDescription,
      inputSchema: browseCategoryInput,
      outputSchema: z.object(browseCategoryOutputShape),
      annotations: READ_ONLY,
    },
    async (args, extra) => runBrowseCategory(client, args as BrowseCategoryArgs, extra?.signal),
  );

  logger.info(
    `ready: user-agent="${config.userAgent}", min interval ${config.minIntervalMs}ms, cache ${config.cacheTtlMs}ms`,
  );

  return server;
}
