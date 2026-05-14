import { execSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { check as checkEncryptedColumns, type Finding, type DiffFile } from './rules/encrypted-column-exclusion.ts';

const REPORT_DIR = resolve(process.cwd(), '.security-scan');

function getChangedFiles(base: string): string[] {
  try {
    const out = execSync(`git diff --name-only ${base}`, { encoding: 'utf8' });
    return out.trim().split('\n').filter(Boolean);
  } catch {
    console.error(`Failed to get diff against ${base}`);
    process.exit(1);
  }
}

function loadDiffFiles(paths: string[]): DiffFile[] {
  return paths
    .filter(p => /\.(ts|tsx|js|jsx|mts|mjs)$/.test(p))
    .map(p => {
      const abs = resolve(process.cwd(), p);
      if (!existsSync(abs)) return null;
      return { path: p, content: readFileSync(abs, 'utf8') };
    })
    .filter((f): f is DiffFile => f !== null);
}

function getCommitSha(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function parseArgs(args: string[]): { base: string } {
  const diffIndex = args.indexOf('--diff');
  const base = diffIndex !== -1 ? args[diffIndex + 1] : 'origin/main';
  return { base };
}

function main() {
  const { base } = parseArgs(process.argv.slice(2));

  console.log(`Running security scan against ${base}...`);

  const changedPaths = getChangedFiles(base);
  if (changedPaths.length === 0) {
    console.log('No changed files found.');
    process.exit(0);
  }

  const diff = loadDiffFiles(changedPaths);
  const findings: Finding[] = [
    ...checkEncryptedColumns(diff),
  ];

  const sha = getCommitSha();
  mkdirSync(REPORT_DIR, { recursive: true });
  const reportPath = join(REPORT_DIR, `${sha}.json`);
  writeFileSync(reportPath, JSON.stringify({ sha, findings }, null, 2));

  const p0 = findings.filter(f => f.severity === 'P0');

  if (findings.length === 0) {
    console.log('No findings.');
  } else {
    for (const f of findings) {
      console.log(`[${f.severity}] ${f.file}:${f.line} — ${f.message}`);
    }
  }

  console.log(`\nReport written to ${reportPath}`);
  console.log(`Total: ${findings.length} finding(s), ${p0.length} P0`);

  if (p0.length > 0) {
    console.error('\nFAILED: P0 findings block merge.');
    process.exit(1);
  }
}

main();
