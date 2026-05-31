import { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// Load .env.local (Next.js convention) or .env as fallback
dotenv.config({ path: '.env.local' });
dotenv.config(); // Fallback to .env

export default {
  out: './src/db/drizzle/migrations',
  schema: './src/db/drizzle/migrations/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  schemaFilter: ['public'],
  exportFilter: {
    exclude: ['postgis'], // Exclude PostGIS system views
  },
} as Config;

