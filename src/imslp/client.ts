/**
 * High-level IMSLP client.
 *
 * This module knows nothing about MCP, which keeps it testable against plain
 * objects and usable as a library through the `./client` export.
 */

import type { Config, Logger } from "../config.js";
import {
  MIN_ALLOWED_INTERVAL_MS,
  createLogger,
  loadConfig,
  withProjectIdentity,
} from "../config.js";
import { parseFailure } from "../errors.js";
import type { Work } from "../types.js";
import { TtlLruCache } from "./cache.js";
import { fetchJson, givenUp } from "./http.js";
import { parseWorkPage } from "./parseWork.js";
import { RateLimiter } from "./rateLimiter.js";
import { apiUrl } from "./urls.js";

export interface ImslpClientOptions {
  config?: Config;
  logger?: Logger;
  fetchImpl?: typeof fetch;
}

/** What a read returns: the data, and whether the site was asked for it. */
export interface Read<T> {
  data: T;
  /** True when served from the in-memory cache rather than the network. */
  cached: boolean;
  /** Rows that came back unreadable and were left out. Absent when none were. */
  skipped?: number;
}

interface InFlightRead {
  promise: Promise<unknown>;
  /** Fires when the last caller interested in this read has gone. */
  controller: AbortController;
  waiting: number;
}

/** A page, named either by its title or by the number the site gives it. */
export type PageTarget = { page: string } | { pageid: number };

/** The rendered page of one title, as `action=parse` serves it. */
export interface RenderedPage {
  title: string;
  pageid: number;
  html: string;
}

interface ParseResponse {
  parse?: {
    title?: string;
    pageid?: number;
    text?: { "*"?: string };
  };
  error?: { code?: string; info?: string };
}

/**
 * Apply the guarantees this project makes about its own traffic.
 *
 * The environment parser already enforces both, and this class is published as
 * a library through the `./client` export and takes a caller-built config, so
 * without this the pacing floor and the honest identity would be optional for
 * anyone importing it. IMSLP publishes a two-second crawl delay, and it holds on
 * every path.
 *
 * A caller may still name their own application in the User-Agent, and the
 * project identity is appended to it either way, so the site can always tell
 * whose client is reading and reach someone about it.
 */
function withGuarantees(config: Config): Config {
  return {
    ...config,
    userAgent: withProjectIdentity(config.userAgent),
    minIntervalMs: Math.max(MIN_ALLOWED_INTERVAL_MS, config.minIntervalMs),
  };
}

export class ImslpClient {
  private readonly config: Config;
  private readonly logger: Logger;
  private readonly limiter: RateLimiter;
  private readonly cache: TtlLruCache<unknown>;
  private readonly fetchImpl: typeof fetch;
  /**
   * Reads under way, by address.
   *
   * The cache is filled once an answer has been read, so between the request
   * going out and the answer coming back the address is absent from it. Two
   * tools wanting the same work page in one turn would each miss and each ask.
   *
   * A read is joined rather than repeated, so it belongs to no single caller:
   * `waiting` counts the callers still interested, and the request is abandoned
   * only when that count reaches zero. One caller giving up says nothing about
   * what the others still want.
   */
  private readonly inFlight = new Map<string, InFlightRead>();

  constructor(options: ImslpClientOptions = {}) {
    this.config = withGuarantees(options.config ?? loadConfig());
    this.logger = options.logger ?? createLogger(this.config.logLevel);
    this.limiter = new RateLimiter({ minIntervalMs: this.config.minIntervalMs });
    this.cache = new TtlLruCache<unknown>(this.config.cacheMaxEntries, this.config.cacheTtlMs);
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
  }

  /**
   * The rendered HTML of one page, templates expanded.
   *
   * The wikitext of a work page is heavily templated, so an editor reads
   * `{{LinkEd|Herrmann|Scholtz|1845|1918}}` there and a name here. The facets a
   * work carries are read off this rendering.
   */
  async renderPage(target: PageTarget, signal?: AbortSignal): Promise<Read<RenderedPage>> {
    const named = "page" in target ? { page: target.page } : { pageid: target.pageid };
    const url = apiUrl({ action: "parse", prop: "text", ...named });
    const asked = "page" in target ? `"${target.page}"` : `page ${target.pageid}`;

    return await this.read<RenderedPage>(url, signal, (payload) => {
      const parsed = payload as ParseResponse;
      const html = parsed.parse?.text?.["*"];
      const pageid = parsed.parse?.pageid;
      const served = parsed.parse?.title;
      if (html === undefined || pageid === undefined || served === undefined) {
        throw parseFailure(url, `no rendered text for ${asked}`);
      }
      return { data: { title: served, pageid, html } };
    });
  }

  /**
   * One work, read from its page.
   *
   * A title on IMSLP can stand for another page, and the rendering says so
   * rather than serving the work behind it. That page is read once more, and a
   * second redirect ends the read: following a chain would ask a library run on
   * donations for a page a caller never named.
   */
  async getWork(target: PageTarget, signal?: AbortSignal): Promise<Read<Work>> {
    const first = await this.renderPage(target, signal);
    const asked = "page" in target ? target.page : first.data.title;
    const parsed = parseWorkPage(first.data.html, {
      pageTitle: first.data.title,
      pageid: first.data.pageid,
      url: apiUrl({ action: "parse", prop: "text" }),
    });
    if (parsed.kind === "work") {
      return { data: parsed.work, cached: first.cached };
    }

    const second = await this.renderPage({ page: parsed.target }, signal);
    const followed = parseWorkPage(second.data.html, {
      pageTitle: second.data.title,
      pageid: second.data.pageid,
      url: apiUrl({ action: "parse", prop: "text" }),
      redirectedFrom: asked,
    });
    if (followed.kind !== "work") {
      throw parseFailure(
        apiUrl({ action: "parse", prop: "text", page: parsed.target }),
        `"${asked}" redirects to "${parsed.target}", which redirects on to ` +
          `"${followed.target}"`,
      );
    }
    return { data: followed.work, cached: first.cached && second.cached };
  }

  /**
   * Read an address, through the cache and the in-flight table.
   *
   * A caller that walks away stops waiting here, and the read carries on for
   * whoever else joined it. The request itself ends when the last of them has
   * gone, which is what `leave` counts.
   */
  private async read<T>(
    url: string,
    signal: AbortSignal | undefined,
    shape: (payload: unknown) => { data: T; skipped?: number },
  ): Promise<Read<T>> {
    if (signal?.aborted === true) {
      throw givenUp(url);
    }

    const cached = this.cache.get(url) as { data: T; skipped?: number } | undefined;
    if (cached) {
      return { ...cached, cached: true };
    }

    const read = this.join<T>(url, shape);
    try {
      const result = await (signal
        ? Promise.race([read.promise, abortsTo(signal, url)])
        : read.promise);
      return { ...result, cached: false };
    } finally {
      this.leave(url, read.entry);
    }
  }

  /**
   * Join the read of an address, starting it when nobody else has.
   *
   * The signal handed to the transport belongs to the read rather than to a
   * caller: a second tool asking for the same page keeps it alive when the
   * first one walks away.
   */
  private join<T>(
    url: string,
    shape: (payload: unknown) => { data: T; skipped?: number },
  ): { promise: Promise<{ data: T; skipped?: number }>; entry: InFlightRead } {
    const existing = this.inFlight.get(url);
    if (existing) {
      existing.waiting += 1;
      return {
        promise: existing.promise as Promise<{ data: T; skipped?: number }>,
        entry: existing,
      };
    }

    const controller = new AbortController();
    const promise = (async () => {
      const payload = await fetchJson<unknown>(url, {
        config: this.config,
        limiter: this.limiter,
        logger: this.logger,
        signal: controller.signal,
        fetchImpl: this.fetchImpl,
      });
      const result = shape(payload);
      this.cache.set(url, result);
      return result;
    })();

    const entry: InFlightRead = { promise, controller, waiting: 1 };
    this.inFlight.set(url, entry);
    return { promise, entry };
  }

  /** One caller stops waiting; the request ends when the last one has. */
  private leave(url: string, entry: InFlightRead): void {
    entry.waiting -= 1;
    if (entry.waiting <= 0) {
      this.inFlight.delete(url);
      entry.controller.abort();
    }
  }
}

/** A promise that rejects when this caller stops waiting, and never resolves. */
function abortsTo(signal: AbortSignal, url: string): Promise<never> {
  return new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(givenUp(url)), { once: true });
  });
}
