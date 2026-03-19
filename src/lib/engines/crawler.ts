import type { CrawlResult } from "@/types";
import * as cheerio from "cheerio";

const FIRECRAWL_BASE = "https://llmstxt.firecrawl.dev";
const CRAWL_TIMEOUT_MS = 15_000;

/**
 * Crawl a website to extract business information.
 * Primary: Firecrawl API. Fallback: direct fetch + cheerio parsing.
 */
export async function crawlSite(
  url: string,
  options?: { signal?: AbortSignal }
): Promise<CrawlResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CRAWL_TIMEOUT_MS);

  // Link external signal to our controller
  if (options?.signal) {
    options.signal.addEventListener("abort", () => controller.abort());
  }

  try {
    return await crawlWithFirecrawl(url, controller.signal);
  } catch {
    // Fallback to direct fetch
    return await crawlDirect(url, controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

async function crawlWithFirecrawl(
  url: string,
  signal: AbortSignal
): Promise<CrawlResult> {
  const normalizedUrl = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const firecrawlUrl = `${FIRECRAWL_BASE}/${normalizedUrl}`;

  const headers: Record<string, string> = {};
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const response = await fetch(firecrawlUrl, { signal, headers });

  if (!response.ok) {
    throw new Error(`Firecrawl returned ${response.status}`);
  }

  const rawContent = await response.text();
  return parseFirecrawlResponse(rawContent, url);
}

function parseFirecrawlResponse(content: string, sourceUrl: string): CrawlResult {
  const lines = content.split("\n");

  // Extract business name from first heading
  const titleLine = lines.find((l) => l.startsWith("# "));
  const businessName = titleLine?.replace(/^#\s+/, "").trim() || extractDomainName(sourceUrl);

  // Extract description from blockquote
  const descLine = lines.find((l) => l.startsWith("> "));
  const description = descLine?.replace(/^>\s+/, "").trim() || null;

  // Extract sections
  let about: string | null = null;
  const services: string[] = [];
  const keyPages: { title: string; url: string }[] = [];
  let currentSection = "";

  for (const line of lines) {
    if (line.startsWith("## ")) {
      currentSection = line.replace(/^##\s+/, "").toLowerCase();
      continue;
    }

    if (currentSection === "about" && line.trim()) {
      about = (about ? about + " " : "") + line.trim();
    }

    if (currentSection === "services" && line.startsWith("- ")) {
      services.push(line.replace(/^-\s+/, "").trim());
    }

    if (currentSection === "links" && line.startsWith("- ")) {
      const linkMatch = line.match(/^-\s+(.+?):\s+(https?:\/\/.+)$/);
      if (linkMatch) {
        keyPages.push({ title: linkMatch[1], url: linkMatch[2] });
      }
    }
  }

  // Try to extract city/state from contact section
  const { city, state, phone, address } = extractContactInfo(lines);

  return {
    businessName,
    category: null,
    city,
    state,
    phone,
    address,
    services,
    hours: null,
    description,
    about,
    keyPages,
    rawContent: content,
  };
}

async function crawlDirect(
  url: string,
  signal: AbortSignal
): Promise<CrawlResult> {
  const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;
  const response = await fetch(normalizedUrl, { signal });

  if (!response.ok) {
    throw new Error(`Direct fetch returned ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Extract meta information
  const ogTitle = $('meta[property="og:title"]').attr("content");
  const metaDescription =
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content");
  const h1 = $("h1").first().text().trim();

  const businessName = ogTitle || h1 || extractDomainName(normalizedUrl);

  // Extract JSON-LD structured data
  const jsonLdScripts = $('script[type="application/ld+json"]');
  let category: string | null = null;
  let phone: string | null = null;
  let address: string | null = null;
  let city: string | null = null;
  let state: string | null = null;
  let hours: string | null = null;

  jsonLdScripts.each((_, el) => {
    try {
      const data = JSON.parse($(el).text());
      const item = Array.isArray(data) ? data[0] : data;

      if (item["@type"] === "LocalBusiness" || item["@type"]?.includes?.("LocalBusiness")) {
        category = item.additionalType || item["@type"] || category;
        phone = item.telephone || phone;
        hours = item.openingHours || hours;

        if (item.address) {
          address = item.address.streetAddress || address;
          city = item.address.addressLocality || city;
          state = item.address.addressRegion || state;
        }
      }
    } catch {
      // Invalid JSON-LD, skip
    }
  });

  // Extract headings as services hints
  const services: string[] = [];
  $("h2, h3").each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length < 100) {
      services.push(text);
    }
  });

  // Extract key pages from nav links
  const keyPages: { title: string; url: string }[] = [];
  $("nav a, header a").each((_, el) => {
    const href = $(el).attr("href");
    const title = $(el).text().trim();
    if (href && title && !href.startsWith("#") && title.length < 80) {
      try {
        const absoluteUrl = new URL(href, normalizedUrl).toString();
        keyPages.push({ title, url: absoluteUrl });
      } catch {
        // Invalid URL, skip
      }
    }
  });

  return {
    businessName,
    category,
    city,
    state,
    phone,
    address,
    services: services.slice(0, 20),
    hours,
    description: metaDescription || null,
    about: null,
    keyPages: deduplicatePages(keyPages).slice(0, 15),
    rawContent: html,
  };
}

function extractContactInfo(lines: string[]): {
  city: string | null;
  state: string | null;
  phone: string | null;
  address: string | null;
} {
  let city: string | null = null;
  let state: string | null = null;
  let phone: string | null = null;
  let address: string | null = null;
  let inContact = false;

  for (const line of lines) {
    if (line.toLowerCase().startsWith("## contact")) {
      inContact = true;
      continue;
    }
    if (line.startsWith("## ") && inContact) break;

    if (!inContact) continue;

    const phoneLine = line.match(/phone:\s*(.+)/i);
    if (phoneLine) phone = phoneLine[1].trim();

    const addressLine = line.match(/address:\s*(.+)/i);
    if (addressLine) {
      const full = addressLine[1].trim();
      address = full;
      // Try to extract city, state from "123 Main St, City, ST"
      const parts = full.split(",").map((p) => p.trim());
      if (parts.length >= 2) {
        city = parts[parts.length - 2] || null;
        state = parts[parts.length - 1]?.replace(/\d{5}.*/, "").trim() || null;
      }
    }
  }

  return { city, state, phone, address };
}

function extractDomainName(url: string): string {
  try {
    const hostname = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
    return hostname
      .replace(/^www\./, "")
      .split(".")[0]
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return "Unknown Business";
  }
}

function deduplicatePages(
  pages: { title: string; url: string }[]
): { title: string; url: string }[] {
  const seen = new Set<string>();
  return pages.filter((p) => {
    if (seen.has(p.url)) return false;
    seen.add(p.url);
    return true;
  });
}
