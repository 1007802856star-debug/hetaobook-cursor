import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// In development: don't cache the PrismaClient to avoid stale SQLite file handles
// when the database file is recreated (e.g., after `prisma db push` or DB recreation).
// In production: cache globally for connection pooling and performance.
if (process.env.NODE_ENV === 'production') {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({ log: ['query'] })
  }
} else {
  // Dev mode: always create a fresh client to avoid stale file descriptor issues
  // with SQLite when the DB file is recreated while the server is running
  if (globalForPrisma.prisma) {
    globalForPrisma.prisma.$disconnect().catch(() => {})
  }
  globalForPrisma.prisma = new PrismaClient({ log: ['query'] })
}

export const db = globalForPrisma.prisma!
