/**
 * Generate an llms.txt file for a business following the spec template.
 */
export function generateLlmsTxt(
  client: {
    businessName: string;
    category?: string;
    city: string;
    state?: string;
    phone?: string;
    address?: string;
    services: string[];
    hours?: string;
    websiteUrl: string;
  },
  crawlData: {
    description?: string;
    about?: string;
    keyPages: { title: string; url: string }[];
  }
): string {
  const description =
    crawlData.description ||
    `${client.category || "Business"} in ${client.city}${client.state ? `, ${client.state}` : ""}`;

  const about =
    crawlData.about ||
    generateDefaultAbout(client);

  const lines: string[] = [];

  // Title
  lines.push(`# ${client.businessName}`);
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
    const location = [client.address, client.city, client.state]
      .filter(Boolean)
      .join(", ");
    lines.push(`- Address: ${location}`);
  } else {
    const location = [client.city, client.state].filter(Boolean).join(", ");
    lines.push(`- Location: ${location}`);
  }
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
  city: string;
  state?: string;
  services: string[];
}): string {
  const serviceList =
    client.services.length > 0
      ? ` offering ${client.services.slice(0, 3).join(", ")}`
      : "";

  const location = [client.city, client.state].filter(Boolean).join(", ");

  return `${client.businessName} is a ${client.category || "local business"}${serviceList} serving ${location}.`;
}
