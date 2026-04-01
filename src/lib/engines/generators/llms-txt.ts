import Anthropic from "@anthropic-ai/sdk";
import { sanitizeForPrompt } from "@/lib/utils/sanitize";

const ENRICHED_ABOUT_TIMEOUT_MS = 10_000;

/**
 * Return trimmed string if non-empty and not a placeholder, otherwise undefined.
 */
const PLACEHOLDER_VALUES = new Set(["unknown", "n/a", "none", "null", "undefined", ""]);

function truthy(val: string | undefined): string | undefined {
  if (!val) return undefined;
  const trimmed = val.trim();
  if (PLACEHOLDER_VALUES.has(trimmed.toLowerCase())) return undefined;
  return trimmed;
}

/**
 * Generate an llms.txt file for a business following the spec template.
 */
export function generateLlmsTxt(
  client: {
    businessName: string;
    category?: string;
    city?: string;
    state?: string;
    phone?: string;
    address?: string;
    services: string[];
    hours?: string;
    websiteUrl: string;
    serviceArea?: string;
  },
  crawlData: {
    description?: string;
    about?: string;
    keyPages: { title: string; url: string }[];
  }
): string {
  const city = truthy(client.city);
  const businessName = truthy(client.businessName) || "Business";
  const category = client.category || "Business";
  const serviceArea = client.serviceArea;

  // Scope-aware description fallback
  let description: string;
  if (crawlData.description) {
    description = crawlData.description;
  } else if (serviceArea === "national" || serviceArea === "global") {
    description = `${category} serving ${serviceArea === "global" ? "customers worldwide" : "customers nationwide"}`;
  } else if (city) {
    description = `${category} in ${city}${client.state ? `, ${client.state}` : ""}`;
  } else {
    description = category;
  }

  const about =
    crawlData.about ||
    generateDefaultAbout({ ...client, businessName });

  const lines: string[] = [];

  // Title
  lines.push(`# ${businessName}`);
  lines.push("");

  // Description
  lines.push(`> ${description}`);
  lines.push("");

  // About
  lines.push("## About");
  lines.push(about);
  lines.push("");

  // Services
  if (client.services.length > 0) {
    lines.push("## Services");
    for (const service of client.services) {
      lines.push(`- ${service}`);
    }
    lines.push("");
  }

  // Contact
  lines.push("## Contact");
  if (client.phone) {
    lines.push(`- Phone: ${client.phone}`);
  }
  if (client.address) {
    const location = [client.address, city, client.state]
      .filter(Boolean)
      .join(", ");
    lines.push(`- Address: ${location}`);
  } else if (serviceArea === "national") {
    lines.push("- Serving: Nationwide");
  } else if (serviceArea === "global") {
    lines.push("- Serving: Worldwide");
  } else if (city) {
    const location = [city, client.state].filter(Boolean).join(", ");
    lines.push(`- Location: ${location}`);
  }
  // If no address, no serviceArea, and no city — omit Location line entirely
  lines.push(`- Website: ${client.websiteUrl}`);
  if (client.hours) {
    lines.push(`- Hours: ${client.hours}`);
  }
  lines.push("");

  // Links
  if (crawlData.keyPages.length > 0) {
    lines.push("## Links");
    for (const page of crawlData.keyPages) {
      lines.push(`- ${page.title}: ${page.url}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function generateDefaultAbout(client: {
  businessName: string;
  category?: string;
  city?: string;
  state?: string;
  services: string[];
  serviceArea?: string;
}): string {
  const businessName = truthy(client.businessName) || "Business";
  const category = client.category || "local business";
  const city = truthy(client.city);
  const serviceArea = client.serviceArea;

  const serviceList =
    client.services.length > 0
      ? ` offering ${client.services.slice(0, 3).join(", ")}`
      : "";

  if (serviceArea === "national" || serviceArea === "global") {
    const scope = serviceArea === "global" ? "worldwide" : "nationwide";
    return `${businessName} is a ${category}${serviceList} serving customers ${scope}.`;
  }

  if (city) {
    const location = [city, client.state].filter(Boolean).join(", ");
    return `${businessName} is a ${category}${serviceList} serving ${location}.`;
  }

  return `${businessName} is a ${category}${serviceList}.`;
}

/**
 * Use Claude to generate a richer about section from crawled content.
 * Falls back to generateDefaultAbout() on any failure.
 */
export async function generateEnrichedAbout(params: {
  businessName: string;
  category?: string;
  services: string[];
  rawContent: string;
  websiteUrl: string;
}): Promise<string> {
  const { businessName, category, services, rawContent, websiteUrl } = params;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ENRICHED_ABOUT_TIMEOUT_MS);

    try {
      const client = new Anthropic();
      const sanitizedContent = sanitizeForPrompt(rawContent, 2000);
      const serviceContext = services.length > 0
        ? `Their services include: ${services.join(", ")}.`
        : "";

      const response = await client.messages.create(
        {
          model: "claude-sonnet-4-20250514",
          max_tokens: 300,
          messages: [
            {
              role: "user",
              content: `Write a 3-5 sentence "About" paragraph for ${sanitizeForPrompt(businessName, 200)}, a ${sanitizeForPrompt(category || "local business", 100)}. ${serviceContext}

Their website is ${sanitizeForPrompt(websiteUrl, 200)}.

Here is content from their website:
${sanitizedContent}

Write a professional, factual about paragraph. Do not use marketing hype. Focus on what the business does, who they serve, and what makes them notable. Return ONLY the paragraph text, no headings or labels.`,
            },
          ],
        },
        { signal: controller.signal }
      );

      clearTimeout(timeout);

      const block = response.content[0];
      if (block.type === "text" && block.text.trim().length > 0) {
        return block.text.trim();
      }
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    // Fall through to default
  }

  return generateDefaultAbout({
    businessName,
    category,
    services,
  });
}

/**
 * Check whether we have enough data to produce a useful llms.txt without AI enrichment.
 * Returns true if the business name is a real name (not just a domain), AND we have
 * location or services info, AND the about section has meaningful content.
 */
export function isLlmsTxtQualitySufficient(
  client: { businessName: string; city?: string; services: string[] },
  crawlData: { about?: string }
): boolean {
  const name = truthy(client.businessName);
  if (!name) return false;

  // Business name should be a real name, not just a domain
  const isDomainName = /\.com|\.org/i.test(name);
  if (isDomainName) return false;

  // Must have city OR at least one service
  const hasCity = Boolean(truthy(client.city));
  const hasServices = client.services.length > 0;
  if (!hasCity && !hasServices) return false;

  // Must have a meaningful about section (50+ chars)
  const about = crawlData.about?.trim();
  if (!about || about.length < 50) return false;

  return true;
}
