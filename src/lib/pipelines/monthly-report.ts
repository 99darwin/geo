import { prisma } from "@/lib/db";
import { MonthlyReportEmail } from "@/emails/monthly-report";
import { sendEmail } from "@/lib/email";

export async function runMonthlyReport(clientId: string): Promise<void> {
  // 1. Load client with user email
  const client = await prisma.client.findUniqueOrThrow({
    where: { id: clientId },
    include: { user: { select: { email: true, name: true } } },
  });

  if (!client.user.email) {
    console.warn(
      `[Monthly Report] Client ${clientId} has no user email — skipping`
    );
    return;
  }

  // 2. Load current and previous VisibilityScore
  const scores = await prisma.visibilityScore.findMany({
    where: { clientId },
    orderBy: { period: "desc" },
    take: 2,
  });

  const currentScore = scores[0];
  const previousScore = scores[1] ?? null;

  if (!currentScore) {
    console.warn(
      `[Monthly Report] No visibility score for client ${clientId} — skipping`
    );
    return;
  }

  // 3. Check if report already sent
  const breakdown = (currentScore.breakdown as Record<string, unknown>) ?? {};
  if (breakdown.reportSentAt) {
    console.log(
      `[Monthly Report] Report already sent for client ${clientId} period ${currentScore.period.toISOString()}`
    );
    return;
  }

  // 4. Load current period's citations with queries
  const currentPeriodStart = currentScore.period;
  const currentPeriodEnd = new Date(
    currentPeriodStart.getFullYear(),
    currentPeriodStart.getMonth() + 1,
    1
  );

  const currentCitations = await prisma.citation.findMany({
    where: {
      clientId,
      checkedAt: { gte: currentPeriodStart, lt: currentPeriodEnd },
    },
    include: { query: { select: { queryText: true } } },
  });

  // 5. Build email data

  // Top 3 cited queries: group by queryText where cited=true, count platforms
  const citedByQuery = new Map<string, Set<string>>();
  for (const c of currentCitations) {
    if (!c.cited) continue;
    const text = c.query.queryText;
    if (!citedByQuery.has(text)) {
      citedByQuery.set(text, new Set());
    }
    citedByQuery.get(text)!.add(c.platform);
  }

  const topCitedQueries = [...citedByQuery.entries()]
    .map(([query, platforms]) => ({
      query,
      platforms: [...platforms],
      count: platforms.size,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map(({ query, platforms }) => ({ query, platforms }));

  // Top 3 uncited queries: queries with zero cited=true across all platforms
  const allQueryTexts = new Set(currentCitations.map((c) => c.query.queryText));
  const citedQueryTexts = new Set(citedByQuery.keys());
  const topUncitedQueries = [...allQueryTexts]
    .filter((q) => !citedQueryTexts.has(q))
    .slice(0, 3);

  // Newly cited / lost citations from breakdown delta
  const delta = (breakdown.delta as Record<string, unknown[]>) ?? {};
  const newlyCited: { query: string; platform: string }[] = Array.isArray(
    delta.newlyCited
  )
    ? (delta.newlyCited as { query: string; platform: string }[])
    : [];
  const lostCitations: { query: string; platform: string }[] = Array.isArray(
    delta.lostCitations
  )
    ? (delta.lostCitations as { query: string; platform: string }[])
    : [];

  // 6. Check generated files status
  const generatedFiles = await prisma.generatedFile.findMany({
    where: { clientId, isActive: true },
    select: { fileType: true },
  });
  const fileTypes = new Set(generatedFiles.map((f) => f.fileType));
  const hasLlmsTxt = fileTypes.has("llms_txt");
  const hasSchema = fileTypes.has("schema_json");

  // 7. Format period label
  const periodLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(currentScore.period);

  // 8. Build dashboard URL
  const dashboardUrl = `${
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL ||
    "https://app.example.com"
  }/dashboard`;

  // 9. Send email
  try {
    await sendEmail({
      to: client.user.email,
      subject: `Your GEO Visibility Report - ${periodLabel}`,
      react: MonthlyReportEmail({
        businessName: client.businessName,
        currentScore: currentScore.score,
        previousScore: previousScore?.score ?? null,
        topCitedQueries,
        topUncitedQueries,
        newlyCited,
        lostCitations,
        hasLlmsTxt,
        hasSchema,
        dashboardUrl,
        period: periodLabel,
      }),
    });
  } catch (error) {
    console.error(
      `[Monthly Report] Failed to send email for client ${clientId}:`,
      error
    );
    throw error;
  }

  // 10. Mark report sent
  const updatedBreakdown = {
    ...breakdown,
    reportSentAt: new Date().toISOString(),
  };
  await prisma.visibilityScore.update({
    where: { id: currentScore.id },
    data: { breakdown: updatedBreakdown },
  });

  console.log(`[Monthly Report] Sent report for client ${clientId}`);
}
