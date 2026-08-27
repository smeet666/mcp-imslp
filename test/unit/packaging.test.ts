/**
 * What several files say about the same thing.
 *
 * A version, an author and a list of tools are each written in more than one
 * place, and two files that assert the same thing end up contradicting each
 * other with nothing to arbitrate. These tests state the agreement rather than
 * the value, so they survive the day the value changes.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { createLogger, loadConfig } from "../../src/config.js";
import { createServer } from "../../src/server.js";
import { PKG_VERSION, REPO_URL } from "../../src/version.js";

const ROOT = join(import.meta.dirname, "..", "..");

function json(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(ROOT, name), "utf8")) as Record<string, unknown>;
}

const pkg = json("package.json");
const registry = json("server.json");
const manifest = json("packaging/manifest.json");

describe("the version", () => {
  it("is the same in every file that carries it", () => {
    const npmPackage = (registry.packages as { registryType: string; version: string }[]).find(
      (each) => each.registryType === "npm",
    );

    expect(registry.version).toBe(pkg.version);
    expect(manifest.version).toBe(pkg.version);
    expect(PKG_VERSION).toBe(pkg.version);
    expect(npmPackage?.version).toBe(pkg.version);
  });

  it("is the one the bundle URL serves", () => {
    // Written by hand, the URL keeps a number across a bump and announces one
    // version while serving the file of another.
    const bundle = (registry.packages as { registryType: string; identifier: string }[]).find(
      (each) => each.registryType === "mcpb",
    );

    expect(bundle?.identifier).toContain(`/v${String(pkg.version)}/`);
    expect(bundle?.identifier).toContain(`-${String(pkg.version)}.mcpb`);
  });
});

describe("who publishes it", () => {
  it("is named the same way wherever it is named", () => {
    const author = (pkg.author as { name: string }).name;

    expect((manifest.author as { name: string }).name).toBe(author);
    expect(readFileSync(join(ROOT, "LICENSE"), "utf8")).toContain(author);
  });

  it("names one package, one repository and one registry entry", () => {
    expect(registry.name).toBe(pkg.mcpName);
    expect(manifest.name).toBe(pkg.name);
    expect(REPO_URL).toBe((registry.repository as { url: string }).url);
  });
});

describe("what a host is told before the server runs", () => {
  it("is the list of tools the server registers", async () => {
    // A host reads the manifest before installing anything, so a tool added
    // without being named there is announced to nobody.
    const server = createServer({
      config: loadConfig({}),
      logger: createLogger("silent"),
      fetchImpl: (async () => Response.json({})) as unknown as typeof fetch,
    });
    const client = new Client({ name: "test", version: "0.0.0" });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverSide), client.connect(clientSide)]);

    const { tools } = await client.listTools();
    const announced = (manifest.tools as { name: string }[]).map((tool) => tool.name);

    expect([...announced].sort()).toEqual(tools.map((tool) => tool.name).sort());
    await server.close();
  });
});

describe("what the registry accepts", () => {
  it("keeps its description within the hundred characters it allows", () => {
    expect((registry.description as string).length).toBeLessThanOrEqual(100);
  });
});

describe("what the published archive carries", () => {
  it("holds the documents a reader needs and the code they run", () => {
    expect(pkg.files).toEqual(["dist", "README.md", "LICENSE", "CHANGELOG.md", "server.json"]);
  });
});
