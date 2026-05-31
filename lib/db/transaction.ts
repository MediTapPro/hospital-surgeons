import { getDb } from '@/lib/db';

type DrizzleTransaction = Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0];

export async function withTransaction<T>(
  callback: (tx: DrizzleTransaction) => Promise<T>,
  options?: { errorMessage?: string }
): Promise<T> {
  const db = getDb();
  try {
    return await db.transaction(async (tx) => callback(tx));
  } catch (error) {
    if (options?.errorMessage) {
      console.error(options.errorMessage, error);
    }
    throw error;
  }
}
