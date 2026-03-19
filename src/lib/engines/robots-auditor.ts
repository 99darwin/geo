import type { RobotsTxtAudit } from "@/types";

const AI_BOTS = [
  "GPTBot",
  "ClaudeBot",
  "PerplexityBot",
  "Google-Extended",
  "OAI-SearchBot",
];

const ROBOTS_TIMEOUT_MS = 5_000;

/**
 * Audit a site's robots.txt for AI bot blocking rules.
 */
export async function auditRobotsTxt(
  url: string,
  options?: { signal?: AbortSignal }
): Promise<RobotsTxtAudit> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ROBOTS_TIMEOUT_MS);

  if (options?.signal) {
    options.signal.addEventListener("abort", () => controller.abort());
  }

  try {
    const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;
    const robotsUrl = new URL("/robots.txt", normalizedUrl).toString();

    const response = await fetch(robotsUrl, { signal: controller.signal });

    if (!response.ok) {
      return {
        accessible: true,
        blocked: [],
        total: AI_BOTS.length,
        status: "no_robots_txt",
      };
    }

    const text = await response.text();
    const blocked = AI_BOTS.filter((bot) => isBotBlocked(text, bot));

    return {
      accessible: blocked.length === 0,
      blocked,
      total: AI_BOTS.length,
      status: blocked.length === 0 ? "clean" : "blocked",
    };
  } catch {
    // Network error or timeout — assume no robots.txt
    return {
      accessible: true,
      blocked: [],
      total: AI_BOTS.length,
      status: "no_robots_txt",
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Check if a specific bot is blocked by a robots.txt file.
 * Looks for User-agent directives followed by Disallow: /
 */
function isBotBlocked(robotsTxt: string, botName: string): boolean {
  const lines = robotsTxt.split("\n").map((l) => l.trim());
  let isTargetBot = false;
  let isWildcard = false;

  for (const line of lines) {
    // Skip comments and empty lines
    if (line.startsWith("#") || line === "") {
      // Reset target tracking on empty line (new block)
      if (line === "") {
        isTargetBot = false;
        isWildcard = false;
      }
      continue;
    }

    const lowerLine = line.toLowerCase();

    if (lowerLine.startsWith("user-agent:")) {
      const agent = line.slice("user-agent:".length).trim();
      if (agent.toLowerCase() === botName.toLowerCase()) {
        isTargetBot = true;
      } else if (agent === "*") {
        isWildcard = true;
      } else {
        // Different specific bot — don't reset, could be multi-agent block
      }
      continue;
    }

    if (lowerLine.startsWith("disallow:")) {
      const path = line.slice("disallow:".length).trim();
      if (path === "/" && (isTargetBot || isWildcard)) {
        // Check if the wildcard block is actually overridden by a specific allow for this bot
        if (isTargetBot) return true;
        if (isWildcard && !hasSpecificAllow(robotsTxt, botName)) return true;
      }
    }
  }

  return false;
}

/**
 * Check if there's a specific User-agent block for this bot with Allow: /
 */
function hasSpecificAllow(robotsTxt: string, botName: string): boolean {
  const lines = robotsTxt.split("\n").map((l) => l.trim());
  let isTargetBot = false;

  for (const line of lines) {
    if (line === "" || line.startsWith("#")) {
      if (line === "") isTargetBot = false;
      continue;
    }

    const lowerLine = line.toLowerCase();

    if (lowerLine.startsWith("user-agent:")) {
      const agent = line.slice("user-agent:".length).trim();
      isTargetBot = agent.toLowerCase() === botName.toLowerCase();
      continue;
    }

    if (isTargetBot && lowerLine.startsWith("allow:")) {
      const path = line.slice("allow:".length).trim();
      if (path === "/") return true;
    }
  }

  return false;
}
