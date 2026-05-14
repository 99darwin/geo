import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface Finding {
  severity: 'P0' | 'P1' | 'P2';
  category: string;
  file: string;
  line: number;
  message: string;
  remediation: string;
}

export interface DiffFile {
  path: string;
  content: string;
}

const READ_METHODS = ['findMany', 'findUnique', 'findFirst', 'findManyRaw'] as const;

const DEFAULT_SCHEMA_PATH = resolve(process.cwd(), 'prisma/schema.prisma');

const REMEDIATION =
  'Add a `select` clause that explicitly lists the fields to return, omitting all `*_encrypted` fields. ' +
  'See gpu-var-platform-spec §15 §"Read-Path Column Discipline (Encrypted-Column Exclusion)".';

function toCamelCase(name: string): string {
  return name.charAt(0).toLowerCase() + name.slice(1);
}

function parseEncryptedModels(schemaPath: string): string[] {
  let schema: string;
  try {
    schema = readFileSync(schemaPath, 'utf8');
  } catch {
    return [];
  }

  const models: string[] = [];
  const lines = schema.split('\n');
  let currentModel: string | null = null;
  let hasEncrypted = false;
  let depth = 0;

  for (const line of lines) {
    const modelMatch = line.match(/^model\s+(\w+)\s*\{/);
    if (modelMatch && depth === 0) {
      currentModel = modelMatch[1];
      hasEncrypted = false;
      depth = 1;
      continue;
    }

    if (currentModel !== null) {
      for (const ch of line) {
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
      }

      if (depth === 0) {
        if (hasEncrypted) models.push(currentModel);
        currentModel = null;
        hasEncrypted = false;
      } else if (/^\s+\w*_encrypted\b/.test(line)) {
        hasEncrypted = true;
      }
    }
  }

  return models;
}

function extractCallArgs(content: string, openParenIndex: number): string {
  let depth = 0;
  let i = openParenIndex;
  while (i < content.length) {
    if (content[i] === '(') depth++;
    else if (content[i] === ')') {
      depth--;
      if (depth === 0) return content.slice(openParenIndex + 1, i);
    }
    i++;
  }
  return '';
}

function lineNumberAt(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
}

export interface CheckOptions {
  schemaPath?: string;
  models?: string[];
}

export function check(diff: DiffFile[], options: CheckOptions = {}): Finding[] {
  const models =
    options.models ??
    parseEncryptedModels(options.schemaPath ?? DEFAULT_SCHEMA_PATH);

  if (models.length === 0) return [];

  const camelModels = models.map(toCamelCase);
  const methodRe = new RegExp(
    `\\bprisma\\.(${camelModels.join('|')})\\.(${READ_METHODS.join('|')})\\(`,
    'g',
  );

  const findings: Finding[] = [];

  for (const file of diff) {
    methodRe.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = methodRe.exec(file.content)) !== null) {
      const openParenIndex = match.index + match[0].length - 1;
      const args = extractCallArgs(file.content, openParenIndex);
      if (!/\bselect\s*:/.test(args)) {
        const modelName = match[1];
        const method = match[2];
        findings.push({
          severity: 'P0',
          category: 'encrypted-column-exclusion',
          file: file.path,
          line: lineNumberAt(file.content, match.index),
          message:
            `\`prisma.${modelName}.${method}()\` targets a model with \`*_encrypted\` fields but has no explicit \`select\` clause — encrypted columns may be inadvertently returned.`,
          remediation: REMEDIATION,
        });
      }
    }
  }

  return findings;
}
