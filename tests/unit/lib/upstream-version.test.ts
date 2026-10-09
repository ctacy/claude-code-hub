import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  fetchUpstreamVersionInfo,
  getUpstreamBaseVersionInfo,
  UPSTREAM_BASE_VERSION,
} from "@/lib/upstream-version";

describe("getUpstreamBaseVersionInfo", () => {
  it("returns the merged upstream version with a v prefix and its release tag url", () => {
    const info = getUpstreamBaseVersionInfo();
    expect(info.version).toBe(`v${UPSTREAM_BASE_VERSION}`);
    expect(info.releaseUrl).toBe(
      `https://github.com/ding113/claude-code-hub/releases/tag/v${UPSTREAM_BASE_VERSION}`
    );
  });
});

describe("fetchUpstreamVersionInfo", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the latest release version and url", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ tag_name: "0.9.8", html_url: "https://example.com/r" }),
      })
    );
    await expect(fetchUpstreamVersionInfo()).resolves.toEqual({
      version: "v0.9.8",
      releaseUrl: "https://example.com/r",
    });
  });

  it("returns null on non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    await expect(fetchUpstreamVersionInfo()).resolves.toBeNull();
  });

  it("returns null when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(fetchUpstreamVersionInfo()).resolves.toBeNull();
  });
});
