import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Link } from "@/i18n/routing";
// AI Accept 2026-07-04 main v1
import { fetchUpstreamVersionInfo, getUpstreamBaseVersionInfo } from "@/lib/upstream-version";

async function getVersion(): Promise<string> {
  try {
    const versionPath = join(process.cwd(), "VERSION");
    const version = await readFile(versionPath, "utf-8");
    return version.trim();
  } catch {
    return "unknown";
  }
}

// AI Accept 2026-07-04 main v1
export async function Footer() {
  const year = new Date().getFullYear();
  const [version, latest] = await Promise.all([getVersion(), fetchUpstreamVersionInfo()]);
  const base = getUpstreamBaseVersionInfo();

  return (
    <footer className="border-t border-border bg-background/80">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-2 px-6 py-6 text-sm text-muted-foreground sm:flex-row">
        <p className="text-center sm:text-left">
          © {year} Claude Code Hub · v{version} ·{" "}
          <Link
            href={base.releaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-primary"
          >
            upstream {base.version}
          </Link>
          {latest && latest.version !== base.version ? (
            <>
              {" → "}
              <Link
                href={latest.releaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-primary"
              >
                {latest.version}
              </Link>
            </>
          ) : null}
        </p>
        <Link
          href="https://github.com/ding113/claude-code-hub"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors hover:text-primary"
        >
          GitHub
        </Link>
      </div>
    </footer>
  );
}
