import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL;

export const isDbConfigured = Boolean(databaseUrl && databaseUrl.startsWith('postgres'));

// Export a safe query function that runs queries on Neon if configured,
// or logs/throws a helpful message if not.
export const sql = isDbConfigured
  ? neon(databaseUrl!)
  : () => {
      console.warn('Neon DB: Query attempted but DATABASE_URL is not configured in .env.');
      return Promise.resolve([]) as any;
    };
