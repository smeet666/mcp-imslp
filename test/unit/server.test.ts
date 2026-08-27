/**
 * The wiring: what the server announces to a host before anything is called.
 */

import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createLogger, loadConfig } from "../../src/config.js";
import { createServer } from "../../src/server.js";
import { PKG_VERSION } from "../../src/version.js";

async function connected() {
  const server = createServer({
    config: loadConfig({}),
    logger: createLogger("silent"),
    fetchImpl: (async () => Response.json({})) as unknown as typeof fetch,
  });
  const client = new Client({ name: "test", version: "0.0.0" });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  return { client, server };
}

describe("what a host is told", () => {
  it("announces the tools in a fixed order", async () => {
    const { client, server } = await connected();

    const { tools } = await client.listTools();

    expect(tools.map((tool) => tool.name)).toEqual(["get_work"]);
    await server.close();
  });

  it("declares an output schema for every tool", async () => {
    const { client, server } = await connected();

    const { tools } = await client.listTools();

    for (const tool of tools) {
      expect(tool.outputSchema).toBeDefined();
      expect(tool.annotations?.readOnlyHint).toBe(true);
    }
    await server.close();
  });

  it("tells the host how a work is addressed and how copyright is stated", async () => {
    const { client, server } = await connected();

    const instructions = client.getInstructions() ?? "";

    expect(instructions).toContain("Work (Composer)");
    expect(instructions).toContain("per jurisdiction");
    expect(instructions).toContain("CC BY-SA 4.0");
    await server.close();
  });

  it("builds without being handed a configuration", () => {
    expect(() => createServer()).not.toThrow();
  });

  it("carries the version the package publishes", async () => {
    const { client, server } = await connected();

    expect(client.getServerVersion()?.version).toBe(PKG_VERSION);
    await server.close();
  });
});
