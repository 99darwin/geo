import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { crawlSite } from "@/lib/engines/crawler";
import { generateLlmsTxt } from "@/lib/engines/generators/llms-txt";
import { generateSchemaScript } from "@/lib/engines/generators/schema-jsonld";
import { isBlockedUrl } from "@/lib/url-validation";
import type { ApiResponse } from "@/types";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<{ triggered: boolean }>>> {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;

  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  if (isBlockedUrl(client.websiteUrl)) {
    return NextResponse.json({ error: "Blocked URL" }, { status: 400 });
  }

  const promise = (async () => {
    const crawlResult = await crawlSite(client.websiteUrl);

    // Update client data from crawl
    await prisma.client.update({
      where: { id },
      data: {
        businessName: crawlResult.businessName || client.businessName,
        city: crawlResult.city || client.city,
        state: crawlResult.state || client.state,
        phone: crawlResult.phone || client.phone,
        address: crawlResult.address || client.address,
        category: crawlResult.category || client.category,
        services: crawlResult.services.length > 0 ? crawlResult.services : client.services,
        hours: crawlResult.hours || client.hours,
      },
    });

    const updatedClient = await prisma.client.findUniqueOrThrow({ where: { id } });

    // Generate new files
    const llmsTxt = generateLlmsTxt(
      {
        businessName: updatedClient.businessName,
        category: updatedClient.category ?? undefined,
        city: updatedClient.city,
        state: updatedClient.state ?? undefined,
        phone: updatedClient.phone ?? undefined,
        address: updatedClient.address ?? undefined,
        services: updatedClient.services,
        hours: updatedClient.hours ?? undefined,
        websiteUrl: updatedClient.websiteUrl,
      },
      {
        description: crawlResult.description ?? undefined,
        about: crawlResult.about ?? undefined,
        keyPages: crawlResult.keyPages,
      }
    );

    const schemaScript = generateSchemaScript({
      businessName: updatedClient.businessName,
      address: updatedClient.address ?? undefined,
      city: updatedClient.city,
      state: updatedClient.state ?? undefined,
      phone: updatedClient.phone ?? undefined,
      websiteUrl: updatedClient.websiteUrl,
      hours: updatedClient.hours ?? undefined,
      googleBusinessUrl: updatedClient.googleBusinessUrl ?? undefined,
    });

    // Deactivate old files and create new versions
    for (const fileType of ["llms_txt", "schema_json"] as const) {
      const content = fileType === "llms_txt" ? llmsTxt : schemaScript;

      const maxVersion = await prisma.generatedFile.findFirst({
        where: { clientId: id, fileType },
        orderBy: { version: "desc" },
        select: { version: true },
      });

      await prisma.generatedFile.updateMany({
        where: { clientId: id, fileType, isActive: true },
        data: { isActive: false },
      });

      await prisma.generatedFile.create({
        data: {
          clientId: id,
          fileType,
          content,
          version: (maxVersion?.version ?? 0) + 1,
          isActive: true,
        },
      });
    }

    console.log(`[Admin Regenerate] Complete for client ${id}`);
  })();

  try {
    const { waitUntil } = await import("@vercel/functions");
    waitUntil(promise.catch((err) => console.error(`[Admin Regenerate] Failed for ${id}:`, err)));
  } catch {
    // fire and forget in dev
  }

  return NextResponse.json({ data: { triggered: true } });
}
