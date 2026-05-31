import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/src/db/drizzle/migrations/schema';

let dbInstance: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!dbInstance) {
    const connectionString = process.env.DATABASE_URL;
    
    if (!connectionString) {
      throw new Error('DATABASE_URL must be set in environment variables');
    }

    // Create a PostgreSQL connection pool
    const pool = new Pool({
      connectionString,
      // SSL configuration for Supabase/cloud databases
      ssl: connectionString.includes('supabase') || connectionString.includes('amazonaws') 
        ? { rejectUnauthorized: false } 
        : undefined,
    });

    // Initialize Drizzle with the pool and schema
    dbInstance = drizzle(pool, { schema });
    console.log('Database client initialized');
  }
  
  return dbInstance;
}
