import { logger } from "@/lib/logger";

/**
 * 真正的上游仓库 (ding113/claude-code-hub)
 * 区别于 src/lib/version.ts 中的 GITHUB_REPO —— 那个指向本 fork 自身 (ctacy/claude-code-hub)
 */
const UPSTREAM_REPO = {
  owner: "ding113",
  repo: "claude-code-hub",
};

const REVALIDATE_SECONDS = 5 * 60; // 5 分钟
const USER_AGENT = "claude-code-hub";

export interface UpstreamVersionInfo {
  version: string;
  releaseUrl: string;
}

function normalizeVersionForDisplay(version: string): string {
  const trimmed = version.trim();
  if (!trimmed) return trimmed;

  if (/^v/i.test(trimmed)) {
    return `v${trimmed.slice(1)}`;
  }

  if (/^\d+(?:\.\d+)*(?:[-+].+)?$/.test(trimmed)) {
    return `v${trimmed}`;
  }

  return trimmed;
}

function buildGitHubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": USER_AGENT,
  };

  const token = (process.env.GITHUB_TOKEN || process.env.GH_TOKEN)?.trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

// AI Accept 2026-07-04 main v1
/**
 * 获取上游仓库 (ding113/claude-code-hub) 的最新发布版本
 * 用于 Footer 同时展示 fork 自身版本(保留 io-log 模块)与真正上游版本，方便判断落后进度
 * Fail Open: 任何网络/解析错误都返回 null，不影响页面渲染
 */
export async function fetchUpstreamVersionInfo(): Promise<UpstreamVersionInfo | null> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${UPSTREAM_REPO.owner}/${UPSTREAM_REPO.repo}/releases/latest`,
      {
        headers: buildGitHubHeaders(),
        next: { revalidate: REVALIDATE_SECONDS },
      }
    );

    if (!response.ok) {
      return null;
    }

    const release = (await response.json()) as { tag_name: string; html_url: string };
    if (!release.tag_name) {
      return null;
    }

    return {
      version: normalizeVersionForDisplay(release.tag_name),
      releaseUrl: release.html_url,
    };
  } catch (error) {
    logger.warn("[UpstreamVersion] Failed to fetch upstream release", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
