import { Pool, PoolClient, QueryResult, types as pgTypes } from 'pg';
import { getDatabaseConfig, validateDatabaseConfig } from '../config/database.config';
import { dbQueryDuration, dbQueryTotal, dbQueryErrors, dbConnectionPoolSize } from '../config/metrics';
import { logger } from '../config/logger';

/**
 * `timestamp without time zone` is read as UTC, not as the server's local time.
 *
 * ## The bug this fixes
 *
 * Saving an event moved its entry open/close times back by the server's UTC
 * offset — **every time it was saved**. Nobody touched the field; it just
 * walked backwards an hour per save.
 *
 * The cause is an asymmetry between how these columns are read and written:
 *
 * | step | what happens |
 * |---|---|
 * | read  | node-postgres parses a naive timestamp as **local** time, so `17:23` becomes the instant `16:23Z` in Dublin |
 * | send  | the API serialises that instant: `2026-09-19T16:23:46.269Z` |
 * | write | Postgres casts that back to `timestamp without time zone` by **discarding the offset**, storing `16:23` |
 *
 * Read applies the offset; write does not. One round trip, one hour lost.
 *
 * ## Why here, and why this way
 *
 * Reading as UTC makes the two halves inverse operations: `17:23` reads as
 * `17:23Z`, is sent as `17:23Z`, and is stored again as `17:23`. Proven with a
 * round-trip probe before and after.
 *
 * It is deliberately at the driver rather than in the event service, because
 * the asymmetry is the driver's, and every naive column shares it —
 * `discounts.valid_from`, `electronic_tickets.valid_until` and the rest would
 * each need the same patch otherwise, and would each be forgotten once.
 *
 * **On a UTC server this changes nothing at all.** The deployed containers run
 * UTC, so the bug was latent there and live only where a developer's machine
 * sets a different zone. That is precisely why it is worth fixing rather than
 * shrugging at: a `TZ` set on the container — an entirely reasonable thing for
 * an Irish product wanting readable logs — would have started corrupting entry
 * dates in production, and dev and production disagreeing is the kind of
 * difference that hides a fault until it is expensive.
 *
 * `date` (OID 1082) is deliberately left alone. It has the same local-midnight
 * quirk, but a browser in the server's zone renders it back correctly, and
 * turning those values into strings would change every caller that does date
 * arithmetic on them. Where a `date` must cross a zone boundary server-side,
 * the caller converts explicitly — see `asDateString` in member-filter.service.
 */
const TIMESTAMP_WITHOUT_TIME_ZONE = 1114;

pgTypes.setTypeParser(TIMESTAMP_WITHOUT_TIME_ZONE, (value: string) =>
  // Postgres hands these over as `2026-09-19 17:23:46.269`. Naming it UTC is
  // the whole fix; `new Date(...)` on the bare string would apply local time
  // again and put us back where we started.
  value === null ? null : new Date(`${value.replace(' ', 'T')}Z`)
);

/**
 * Database connection pool singleton
 */
class DatabasePool {
  private static instance: DatabasePool;
  private pool: Pool | null = null;
  private isConnected = false;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): DatabasePool {
    if (!DatabasePool.instance) {
      DatabasePool.instance = new DatabasePool();
    }
    return DatabasePool.instance;
  }

  /**
   * Initialize the connection pool
   */
  public async initialize(): Promise<void> {
    if (this.pool) {
      console.warn('Database pool already initialized');
      return;
    }

    const config = await getDatabaseConfig();
    validateDatabaseConfig(config);

    this.pool = new Pool(config);

    // Set up event handlers
    this.pool.on('connect', () => {
      // Client connected to database
      this.updatePoolMetrics();
    });

    this.pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', { error: err });
      this.isConnected = false;
      this.updatePoolMetrics();
    });

    this.pool.on('remove', () => {
      // Client removed from pool
      this.updatePoolMetrics();
    });

    // Test the connection
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      this.isConnected = true;
      this.updatePoolMetrics();
      logger.info('Database connection pool initialized successfully');
    } catch (error) {
      this.isConnected = false;
      throw new Error(`Failed to connect to database: ${error}`);
    }
  }

  /**
   * Get the pool instance
   */
  public getPool(): Pool {
    if (!this.pool) {
      throw new Error('Database pool not initialized. Call initialize() first.');
    }
    return this.pool;
  }

  /**
   * Execute a query
   */
  public async query(text: string, params?: any[]): Promise<QueryResult> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    const start = Date.now();
    const operation = this.extractOperation(text);
    const table = this.extractTable(text);
    
    try {
      const result = await this.pool.query(text, params);
      const duration = (Date.now() - start) / 1000; // Convert to seconds

      // Record metrics
      dbQueryDuration.observe({ operation, table }, duration);
      dbQueryTotal.inc({ operation, table, status: 'success' });

      // Log slow queries (> 1000ms)
      if (duration > 1) {
        logger.warn('Slow query detected', {
          text,
          duration: `${duration}s`,
          rows: result.rowCount,
          operation,
          table,
        });
      }

      return result;
    } catch (error) {
      const duration = (Date.now() - start) / 1000;
      
      // Record error metrics
      dbQueryTotal.inc({ operation, table, status: 'error' });
      dbQueryErrors.inc({ 
        operation, 
        table, 
        error_type: error instanceof Error ? error.name : 'unknown' 
      });
      
      logger.error('Database query error', {
        text,
        params,
        error,
        duration: `${duration}s`,
        operation,
        table,
      });
      throw error;
    }
  }

  /**
   * Get a client from the pool for transactions
   */
  public async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }
    return this.pool.connect();
  }

  /**
   * Check if database is connected
   */
  public async isHealthy(): Promise<boolean> {
    if (!this.pool || !this.isConnected) {
      return false;
    }

    try {
      const result = await this.pool.query('SELECT 1');
      return result.rowCount === 1;
    } catch (error) {
      logger.error('Database health check failed', { error });
      return false;
    }
  }

  /**
   * Close the pool and all connections
   */
  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.isConnected = false;
      logger.info('Database connection pool closed');
    }
  }

  /**
   * Get pool statistics
   */
  public getStats() {
    if (!this.pool) {
      return null;
    }

    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
      isConnected: this.isConnected,
    };
  }

  /**
   * Update pool metrics
   */
  private updatePoolMetrics(): void {
    if (!this.pool) {
      return;
    }

    dbConnectionPoolSize.set({ state: 'total' }, this.pool.totalCount);
    dbConnectionPoolSize.set({ state: 'idle' }, this.pool.idleCount);
    dbConnectionPoolSize.set({ state: 'waiting' }, this.pool.waitingCount);
  }

  /**
   * Extract operation type from SQL query
   */
  private extractOperation(sql: string): string {
    const normalized = sql.trim().toUpperCase();
    if (normalized.startsWith('SELECT')) return 'SELECT';
    if (normalized.startsWith('INSERT')) return 'INSERT';
    if (normalized.startsWith('UPDATE')) return 'UPDATE';
    if (normalized.startsWith('DELETE')) return 'DELETE';
    if (normalized.startsWith('CREATE')) return 'CREATE';
    if (normalized.startsWith('ALTER')) return 'ALTER';
    if (normalized.startsWith('DROP')) return 'DROP';
    return 'OTHER';
  }

  /**
   * Extract table name from SQL query
   */
  private extractTable(sql: string): string {
    const normalized = sql.trim().toUpperCase();
    
    // Match common patterns
    const patterns = [
      /FROM\s+([a-z_][a-z0-9_]*)/i,
      /INTO\s+([a-z_][a-z0-9_]*)/i,
      /UPDATE\s+([a-z_][a-z0-9_]*)/i,
      /TABLE\s+([a-z_][a-z0-9_]*)/i,
    ];
    
    for (const pattern of patterns) {
      const match = normalized.match(pattern);
      if (match && match[1]) {
        return match[1].toLowerCase();
      }
    }
    
    return 'unknown';
  }
}

// Export singleton instance
export const db = DatabasePool.getInstance();

// Export types
export type { PoolClient, QueryResult };
