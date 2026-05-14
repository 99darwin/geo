import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { check, type DiffFile } from '../encrypted-column-exclusion.ts';

const MODELS = ['Payment'];

function makeFile(path: string, content: string): DiffFile {
  return { path, content };
}

describe('encrypted-column-exclusion rule', () => {
  describe('positive cases (should flag P0)', () => {
    it('flags bare findUnique with no select', () => {
      const findings = check(
        [makeFile('src/lib/payments.ts', 'const p = await prisma.payment.findUnique({ where: { id } });')],
        { models: MODELS },
      );
      assert.equal(findings.length, 1);
      assert.equal(findings[0].severity, 'P0');
      assert.equal(findings[0].category, 'encrypted-column-exclusion');
      assert.equal(findings[0].file, 'src/lib/payments.ts');
      assert.match(findings[0].message, /findUnique/);
      assert.match(findings[0].remediation, /gpu-var-platform-spec §15/);
    });

    it('flags bare findMany with no select', () => {
      const findings = check(
        [makeFile('src/lib/payments.ts', 'const rows = await prisma.payment.findMany({ where: { userId } });')],
        { models: MODELS },
      );
      assert.equal(findings.length, 1);
      assert.equal(findings[0].severity, 'P0');
    });

    it('flags bare findFirst with no select', () => {
      const findings = check(
        [makeFile('src/lib/payments.ts', 'const row = await prisma.payment.findFirst({ where: { id } });')],
        { models: MODELS },
      );
      assert.equal(findings.length, 1);
    });

    it('flags bare findManyRaw with no select', () => {
      const findings = check(
        [makeFile('src/lib/payments.ts', 'const rows = await prisma.payment.findManyRaw({ query: { id } });')],
        { models: MODELS },
      );
      assert.equal(findings.length, 1);
    });

    it('flags call with empty args (no select)', () => {
      const findings = check(
        [makeFile('src/lib/payments.ts', 'const p = await prisma.payment.findUnique();')],
        { models: MODELS },
      );
      assert.equal(findings.length, 1);
    });

    it('reports correct line number for call on line 2', () => {
      const content = 'const x = 1;\nconst p = await prisma.payment.findUnique({ where: { id } });\n';
      const findings = check([makeFile('src/lib/payments.ts', content)], { models: MODELS });
      assert.equal(findings[0].line, 2);
    });
  });

  describe('negative cases (should not flag)', () => {
    it('passes findUnique with select that omits encrypted field', () => {
      const content = `
        const p = await prisma.payment.findUnique({
          where: { id },
          select: { id: true, amount: true, createdAt: true },
        });
      `;
      const findings = check([makeFile('src/lib/payments.ts', content)], { models: MODELS });
      assert.equal(findings.length, 0);
    });

    it('passes findMany with select clause', () => {
      const content = `
        const rows = await prisma.payment.findMany({
          where: { userId },
          select: { id: true, amount: true },
        });
      `;
      const findings = check([makeFile('src/lib/payments.ts', content)], { models: MODELS });
      assert.equal(findings.length, 0);
    });

    it('does not flag models without encrypted fields', () => {
      const findings = check(
        [makeFile('src/lib/users.ts', 'const u = await prisma.user.findUnique({ where: { id } });')],
        { models: MODELS },
      );
      assert.equal(findings.length, 0);
    });

    it('returns empty when no encrypted models provided', () => {
      const findings = check(
        [makeFile('src/lib/payments.ts', 'const p = await prisma.payment.findUnique({ where: { id } });')],
        { models: [] },
      );
      assert.equal(findings.length, 0);
    });

    it('does not flag write operations (create, update, delete)', () => {
      const content = `
        await prisma.payment.create({ data: { amount: 100 } });
        await prisma.payment.update({ where: { id }, data: { amount: 200 } });
        await prisma.payment.delete({ where: { id } });
      `;
      const findings = check([makeFile('src/lib/payments.ts', content)], { models: MODELS });
      assert.equal(findings.length, 0);
    });
  });

  describe('schema parsing via schemaPath', () => {
    it('detects encrypted model from schema and flags bare call', () => {
      const schemaPath = join(tmpdir(), `schema-${Date.now()}.prisma`);
      writeFileSync(schemaPath, `
model Payment {
  id                   String  @id
  amount               Int
  cardNumber_encrypted String
}

model User {
  id   String @id
  name String
}
`);

      const findings = check(
        [makeFile('src/lib/payments.ts', 'const p = await prisma.payment.findUnique({ where: { id } });')],
        { schemaPath },
      );
      assert.equal(findings.length, 1, 'should flag Payment model (has encrypted field)');
    });

    it('does not flag a model without encrypted fields from schema', () => {
      const schemaPath = join(tmpdir(), `schema-${Date.now()}.prisma`);
      writeFileSync(schemaPath, `
model Payment {
  id                   String  @id
  amount               Int
  cardNumber_encrypted String
}

model User {
  id   String @id
  name String
}
`);

      const findings = check(
        [makeFile('src/lib/users.ts', 'const u = await prisma.user.findUnique({ where: { id } });')],
        { schemaPath },
      );
      assert.equal(findings.length, 0, 'should not flag User model (no encrypted fields)');
    });
  });
});
