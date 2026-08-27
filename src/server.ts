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
        "A work is addressed by the title of its page, which is written 'Work (Composer)', for " +
        "example 'Nocturnes, Op.9 (Chopin, Frédéric)'. The copyright status of a score is stated " +
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

  logger.info(
    `ready: user-agent="${config.userAgent}", min interval ${config.minIntervalMs}ms, cache ${config.cacheTtlMs}ms`,
  );

  return server;
}
