import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (!globalForPrisma.prisma) {
      const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
      globalForPrisma.prisma = new PrismaClient({ adapter });
    }
    return Reflect.get(globalForPrisma.prisma, prop);
  },
});
