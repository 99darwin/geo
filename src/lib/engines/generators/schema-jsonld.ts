/**
 * Generate an embeddable <script> IIFE that injects JSON-LD LocalBusiness schema.
 */
export function generateSchemaScript(client: {
  businessName: string;
  address?: string;
  city: string;
  state?: string;
  phone?: string;
  websiteUrl: string;
  hours?: string;
  googleBusinessUrl?: string;
}): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const schema: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: client.businessName,
    url: client.websiteUrl,
  };

  // Address
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const address: Record<string, any> = {
    "@type": "PostalAddress",
    addressLocality: client.city,
  };

  if (client.address) address.streetAddress = client.address;
  if (client.state) address.addressRegion = client.state;

  schema.address = address;

  // Optional fields
  if (client.phone) schema.telephone = client.phone;
  if (client.hours) schema.openingHours = client.hours;
  if (client.googleBusinessUrl) schema.sameAs = [client.googleBusinessUrl];

  const schemaJson = JSON.stringify(schema);

  return `(function(){var s=document.createElement('script');s.type='application/ld+json';s.text=${JSON.stringify(schemaJson)};document.head.appendChild(s);})();`;
}
