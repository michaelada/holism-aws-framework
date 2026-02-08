import { db, PoolClient } from './pool';
import { logQueryPerformance } from '../config/logger';

/**
 * Execute a query with performance logging
 */
export async function queryWithLogging(
  text: string,
  params?: any[]
): Promise<any> {
  const startTime = Date.now();
  try {
    const result = await db.query(text, params);
    const duration = Date.now() - startTime;
    logQueryPerformance(text, duration, params);
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logQueryPerformance(text, duration, params);
    throw error;
  }
}

/**
 * Execute a function within a database transaction
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Check if a table exists in the database
 */
export async function tableExists(tableName: string): Promise<boolean> {
  const result = await queryWithLogging(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    )`,
    [tableName]
  );

  return result.rows[0].exists;
}

/**
 * Get column names for a table
 */
export async function getTableColumns(tableName: string): Promise<string[]> {
  const result = await queryWithLogging(
    `SELECT column_name 
     FROM information_schema.columns 
     WHERE table_schema = 'public' 
     AND table_name = $1
     ORDER BY ordinal_position`,
    [tableName]
  );

  return result.rows.map((row: any) => row.column_name);
}

/**
 * Execute multiple queries in a transaction
 */
export async function executeInTransaction(queries: Array<{ text: string; params?: any[] }>): Promise<void> {
  await withTransaction(async (client) => {
    for (const query of queries) {
      const startTime = Date.now();
      await client.query(query.text, query.params);
      const duration = Date.now() - startTime;
      logQueryPerformance(query.text, duration, query.params);
    }
  });
}

/**
 * Build a parameterized query with numbered placeholders
 */
export function buildParameterizedQuery(
  baseQuery: string,
  params: Record<string, any>
): { text: string; values: any[] } {
  const values: any[] = [];
  let paramIndex = 1;
  const paramMap = new Map<string, number>();

  const text = baseQuery.replace(/:(\w+)/g, (_match, paramName) => {
    if (!paramMap.has(paramName)) {
      paramMap.set(paramName, paramIndex++);
      values.push(params[paramName]);
    }
    return `$${paramMap.get(paramName)}`;
  });

  return { text, values };
}
