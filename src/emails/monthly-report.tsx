import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Text,
  Button,
  Hr,
  Row,
  Column,
} from "@react-email/components";
import * as React from "react";

interface MonthlyReportEmailProps {
  businessName: string;
  currentScore: number;
  previousScore: number | null;
  topCitedQueries: { query: string; platforms: string[] }[];
  topUncitedQueries: string[];
  newlyCited: { query: string; platform: string }[];
  lostCitations: { query: string; platform: string }[];
  hasLlmsTxt: boolean;
  hasSchema: boolean;
  dashboardUrl: string;
  period: string;
}

function getScoreDelta(
  current: number,
  previous: number | null
): string {
  if (previous === null) return "";
  const diff = current - previous;
  if (diff > 0) return ` (+${diff})`;
  if (diff < 0) return ` (${diff})`;
  return " (no change)";
}

export function MonthlyReportEmail({
  businessName,
  currentScore,
  previousScore,
  topCitedQueries,
  topUncitedQueries,
  newlyCited,
  lostCitations,
  hasLlmsTxt,
  hasSchema,
  dashboardUrl,
  period,
}: MonthlyReportEmailProps) {
  const delta = getScoreDelta(currentScore, previousScore);
  const hasChanges = newlyCited.length > 0 || lostCitations.length > 0;

  return (
    <Html>
      <Head />
      <Preview>Your GEO Report for {period}</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={headerTitle}>{businessName}</Text>
            <Text style={headerSubtitle}>
              Visibility Report - {period}
            </Text>
          </Section>

          <Hr style={divider} />

          {/* Score */}
          <Section style={scoreSection}>
            <Text style={scoreLabel}>Visibility Score</Text>
            <Text style={scoreValue}>
              {currentScore}
              <span style={scoreDelta}>{delta}</span>
            </Text>
          </Section>

          <Hr style={divider} />

          {/* Top Cited Queries */}
          {topCitedQueries.length > 0 && (
            <Section style={section}>
              <Text style={sectionTitle}>Top Cited Queries</Text>
              {topCitedQueries.slice(0, 3).map((item, i) => (
                <Row key={i} style={listItem}>
                  <Column>
                    <Text style={queryText}>{item.query}</Text>
                    <Text style={platformText}>
                      {item.platforms.join(", ")}
                    </Text>
                  </Column>
                </Row>
              ))}
            </Section>
          )}

          {/* Opportunities */}
          {topUncitedQueries.length > 0 && (
            <Section style={section}>
              <Text style={sectionTitle}>Opportunities</Text>
              <Text style={sectionSubtext}>
                Queries where you are not yet cited:
              </Text>
              {topUncitedQueries.slice(0, 3).map((query, i) => (
                <Text key={i} style={opportunityItem}>
                  {query}
                </Text>
              ))}
            </Section>
          )}

          {/* What Changed */}
          {hasChanges && (
            <Section style={section}>
              <Text style={sectionTitle}>What Changed</Text>

              {newlyCited.length > 0 && (
                <>
                  <Text style={changeLabel}>Newly cited:</Text>
                  {newlyCited.map((item, i) => (
                    <Text key={i} style={changeItem}>
                      {item.query} ({item.platform})
                    </Text>
                  ))}
                </>
              )}

              {lostCitations.length > 0 && (
                <>
                  <Text style={changeLabel}>Lost citations:</Text>
                  {lostCitations.map((item, i) => (
                    <Text key={i} style={changeItem}>
                      {item.query} ({item.platform})
                    </Text>
                  ))}
                </>
              )}
            </Section>
          )}

          <Hr style={divider} />

          {/* File Status */}
          <Section style={section}>
            <Text style={sectionTitle}>File Status</Text>
            <Row style={statusRow}>
              <Column>
                <Text style={statusItem}>
                  llms.txt: {hasLlmsTxt ? "Active" : "Inactive"}
                </Text>
              </Column>
            </Row>
            <Row style={statusRow}>
              <Column>
                <Text style={statusItem}>
                  JSON-LD Schema: {hasSchema ? "Active" : "Inactive"}
                </Text>
              </Column>
            </Row>
          </Section>

          <Hr style={divider} />

          {/* CTA */}
          <Section style={ctaSection}>
            <Button style={ctaButton} href={dashboardUrl}>
              View Full Dashboard
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default MonthlyReportEmail;

/* ---------- Styles ---------- */

const body: React.CSSProperties = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  margin: 0,
  padding: 0,
};

const container: React.CSSProperties = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  maxWidth: "600px",
  borderRadius: "8px",
  overflow: "hidden",
};

const header: React.CSSProperties = {
  padding: "32px 40px 16px",
};

const headerTitle: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: 700,
  color: "#1a1a1a",
  margin: "0 0 4px",
};

const headerSubtitle: React.CSSProperties = {
  fontSize: "14px",
  color: "#6b7280",
  margin: 0,
};

const divider: React.CSSProperties = {
  borderColor: "#e5e7eb",
  margin: "0 40px",
};

const scoreSection: React.CSSProperties = {
  padding: "24px 40px",
  textAlign: "center" as const,
};

const scoreLabel: React.CSSProperties = {
  fontSize: "13px",
  color: "#6b7280",
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  margin: "0 0 8px",
};

const scoreValue: React.CSSProperties = {
  fontSize: "48px",
  fontWeight: 700,
  color: "#1a1a1a",
  margin: 0,
  lineHeight: "1",
};

const scoreDelta: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: 400,
  color: "#6b7280",
};

const section: React.CSSProperties = {
  padding: "20px 40px",
};

const sectionTitle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: 600,
  color: "#1a1a1a",
  margin: "0 0 12px",
};

const sectionSubtext: React.CSSProperties = {
  fontSize: "13px",
  color: "#6b7280",
  margin: "0 0 8px",
};

const listItem: React.CSSProperties = {
  marginBottom: "10px",
};

const queryText: React.CSSProperties = {
  fontSize: "14px",
  color: "#1a1a1a",
  margin: "0 0 2px",
};

const platformText: React.CSSProperties = {
  fontSize: "12px",
  color: "#6b7280",
  margin: 0,
};

const opportunityItem: React.CSSProperties = {
  fontSize: "14px",
  color: "#374151",
  margin: "0 0 6px",
  paddingLeft: "12px",
  borderLeft: "2px solid #e5e7eb",
};

const changeLabel: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 600,
  color: "#374151",
  margin: "8px 0 4px",
};

const changeItem: React.CSSProperties = {
  fontSize: "13px",
  color: "#374151",
  margin: "0 0 4px",
  paddingLeft: "12px",
};

const statusRow: React.CSSProperties = {
  marginBottom: "4px",
};

const statusItem: React.CSSProperties = {
  fontSize: "14px",
  color: "#374151",
  margin: 0,
};

const ctaSection: React.CSSProperties = {
  padding: "24px 40px 32px",
  textAlign: "center" as const,
};

const ctaButton: React.CSSProperties = {
  backgroundColor: "#2563eb",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: 600,
  padding: "12px 24px",
  borderRadius: "6px",
  textDecoration: "none",
  display: "inline-block",
};
