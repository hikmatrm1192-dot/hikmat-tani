import { DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import * as d1Schema from './schema.ts';
import { D1Database } from './index.ts';

/**
 * In-memory D1 Database Engine for Tests & Standalone Node Runtime
 * Implements the Cloudflare D1Database interface for Drizzle ORM
 */
export class InMemoryD1Database implements D1Database {
  private tables: Map<string, Map<string, any>> = new Map();

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.tables.clear();
    this.tables.set('processed_operations', new Map());
    this.tables.set('sync_journal', new Map());
    this.tables.set('lands', new Map());
    this.tables.set('farmers', new Map());
    this.tables.set('crop_seasons', new Map());
    this.tables.set('activities', new Map());
    this.tables.set('activity_fertilizers', new Map());
    this.tables.set('activity_opt_observations', new Map());
    this.tables.set('recommendations', new Map());
    this.tables.set('farmer_decisions', new Map());
    this.tables.set('actual_actions', new Map());
    this.tables.set('app_configs', new Map());
    this.tables.set('admin_users', new Map());
    this.tables.set('admin_audit_logs', new Map());
    this.tables.set('fertilizers', new Map());
    this.tables.set('varieties', new Map());
    this.tables.set('opts', new Map());
    this.tables.set('natural_enemies', new Map());
    this.tables.set('references', new Map());
    this.tables.set('knowledge_articles', new Map());
    this.tables.set('auth_users', new Map());
  }

  public prepare(query: string): any {
    return new InMemoryD1PreparedStatement(this, query);
  }

  public async dump(): Promise<ArrayBuffer> {
    return new ArrayBuffer(0);
  }

  public async batch<T = unknown>(statements: any[]): Promise<any[]> {
    const results: any[] = [];
    for (const stmt of statements) {
      results.push(await stmt.all());
    }
    return results;
  }

  public async exec(query: string): Promise<any> {
    return { count: 0, duration: 0 };
  }

  public getTableMap(tableName: string): Map<string, any> {
    const normalized = tableName.replace(/["`]/g, '').toLowerCase();
    if (!this.tables.has(normalized)) {
      this.tables.set(normalized, new Map());
    }
    return this.tables.get(normalized)!;
  }
}

class InMemoryD1PreparedStatement {
  private db: InMemoryD1Database;
  private query: string;
  private params: any[] = [];

  constructor(db: InMemoryD1Database, query: string, params: any[] = []) {
    this.db = db;
    this.query = query;
    this.params = params;
  }

  public bind(...params: any[]): InMemoryD1PreparedStatement {
    return new InMemoryD1PreparedStatement(this.db, this.query, params);
  }

  public async run(): Promise<{ success: boolean; meta: any }> {
    await this.execute();
    return { success: true, meta: { changes: 1, duration: 0 } };
  }

  public async all(): Promise<{ results: any[]; success: boolean; meta: any }> {
    const results = await this.execute();
    return { results, success: true, meta: { duration: 0 } };
  }

  public async first(colName?: string): Promise<any> {
    const results = await this.execute();
    const row = results[0] || null;
    if (row && colName) {
      return row[colName];
    }
    return row;
  }

  public async raw(): Promise<any[][]> {
    const results = await this.execute();
    return results.map((row) => Object.values(row));
  }

  private async execute(): Promise<any[]> {
    const sql = this.query.trim();

    // 1. SELECT 1 health check
    if (/^SELECT\s+1/i.test(sql)) {
      return [{ 1: 1 }];
    }

    // 2. INSERT statement
    if (/^INSERT\s+INTO/i.test(sql)) {
      const match = sql.match(/INSERT\s+INTO\s+[`"]?([a-zA-Z0-9_]+)[`"]?\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
      if (match) {
        const tableName = match[1];
        const columns = match[2].split(',').map((c) => c.trim().replace(/[`"]/g, ''));
        const tableMap = this.db.getTableMap(tableName);

        const row: Record<string, any> = {};
        for (let i = 0; i < columns.length; i++) {
          row[columns[i]] = this.params[i] !== undefined ? this.params[i] : null;
        }

        // Determine primary key
        const pkCol = columns.includes('operation_id')
          ? 'operation_id'
          : columns.includes('id')
          ? 'id'
          : columns[0];

        const pkValue = row[pkCol];
        if (pkValue !== undefined && pkValue !== null) {
          if (tableMap.has(String(pkValue))) {
            throw new Error(`UNIQUE constraint failed: ${tableName}.${pkCol} = ${pkValue}`);
          }
          tableMap.set(String(pkValue), row);
        } else {
          const autoKey = `auto_${Date.now()}_${Math.random()}`;
          tableMap.set(autoKey, row);
        }
        return [row];
      }
      return [];
    }

    // 3. UPDATE statement
    if (/^UPDATE/i.test(sql)) {
      const updateMatch = sql.match(/UPDATE\s+[`"]?([a-zA-Z0-9_]+)[`"]?\s+SET\s+([^WHERE]+)(?:\s+WHERE\s+(.+))?/i);
      if (updateMatch) {
        const tableName = updateMatch[1];
        const setClause = updateMatch[2];
        const whereClause = updateMatch[3] || '';
        const tableMap = this.db.getTableMap(tableName);

        const setCols = setClause.split(',').map((s) => s.split('=')[0].trim().replace(/[`"]/g, ''));
        let paramIdx = 0;
        const updates: Record<string, any> = {};
        for (const col of setCols) {
          updates[col] = this.params[paramIdx++];
        }

        let whereId: string | null = null;
        if (/id["`]?\s*=\s*\?/i.test(whereClause)) {
          whereId = String(this.params[paramIdx++]);
        }

        if (whereId && tableMap.has(whereId)) {
          const existing = tableMap.get(whereId)!;
          const merged = { ...existing, ...updates };
          tableMap.set(whereId, merged);
          return [merged];
        } else if (!whereClause) {
          for (const [k, v] of tableMap.entries()) {
            tableMap.set(k, { ...v, ...updates });
          }
        }
      }
      return [];
    }

    // 4. SELECT statement
    if (/^SELECT/i.test(sql)) {
      const fromMatch = sql.match(/FROM\s+[`"]?([a-zA-Z0-9_]+)[`"]?/i);
      if (!fromMatch) return [];
      const tableName = fromMatch[1];
      const tableMap = this.db.getTableMap(tableName);
      let rows = Array.from(tableMap.values());

      // Check WHERE conditions
      if (/WHERE/i.test(sql)) {
        let paramIdx = 0;

        // Specific filter for id = ?
        if (/WHERE\s+[`"]?id[`"]?\s*=\s*\?/i.test(sql)) {
          const targetId = this.params[paramIdx++];
          rows = rows.filter((r) => String(r.id) === String(targetId));
        }

        // Specific filter for operation_id
        if (/operation_id["`]?\s*=\s*\?/i.test(sql)) {
          const targetOpId = this.params[paramIdx++];
          rows = rows.filter((r) => r.operation_id === targetOpId);
        }

        // Specific filter for entity_type and entity_id
        if (/entity_type["`]?\s*=\s*\?/i.test(sql) && /entity_id["`]?\s*=\s*\?/i.test(sql)) {
          const targetType = this.params[paramIdx++];
          const targetId = this.params[paramIdx++];
          rows = rows.filter((r) => r.entity_type === targetType && r.entity_id === targetId);
        }

        // Specific filter for farmer_id
        if (/farmer_id["`]?\s*=\s*\?/i.test(sql)) {
          const targetFarmer = this.params[paramIdx++];
          rows = rows.filter((r) => r.farmer_id === targetFarmer);
        }

        // Specific filter for server_timestamp > ?
        if (/server_timestamp["`]?\s*>\s*\?/i.test(sql)) {
          const sinceVal = this.params[paramIdx++];
          rows = rows.filter((r) => String(r.server_timestamp) > String(sinceVal));
        }
      }

      // Check ORDER BY
      if (/ORDER\s+BY/i.test(sql)) {
        if (/server_timestamp["`]?\s+ASC/i.test(sql)) {
          rows.sort((a, b) => {
            const timeA = String(a.server_timestamp || '');
            const timeB = String(b.server_timestamp || '');
            if (timeA !== timeB) return timeA.localeCompare(timeB);
            return String(a.id || '').localeCompare(String(b.id || ''));
          });
        } else if (/server_timestamp["`]?\s+DESC/i.test(sql)) {
          rows.sort((a, b) => {
            const timeA = String(a.server_timestamp || '');
            const timeB = String(b.server_timestamp || '');
            if (timeA !== timeB) return timeB.localeCompare(timeA);
            return String(b.id || '').localeCompare(String(a.id || ''));
          });
        }
      }

      // Check LIMIT
      const limitMatch = sql.match(/LIMIT\s+(\?|\d+)/i);
      if (limitMatch) {
        let limit = 500;
        if (limitMatch[1] === '?') {
          limit = this.params[this.params.length - 1] || 500;
        } else {
          limit = parseInt(limitMatch[1], 10);
        }
        rows = rows.slice(0, limit);
      }

      return rows;
    }

    // 5. DELETE statement (e.g. reset or targeted delete)
    if (/^DELETE\s+FROM/i.test(sql)) {
      const fromMatch = sql.match(/FROM\s+[`"]?([a-zA-Z0-9_]+)[`"]?(?:\s+WHERE\s+(.+))?/i);
      if (fromMatch) {
        const tableName = fromMatch[1];
        const whereClause = fromMatch[2];
        const tableMap = this.db.getTableMap(tableName);

        if (whereClause && /id["`]?\s*=\s*\?/i.test(whereClause)) {
          const targetId = String(this.params[0]);
          tableMap.delete(targetId);
        } else {
          tableMap.clear();
        }
      }
      return [];
    }

    return [];
  }
}

export function createTestD1Client(): DrizzleD1Database<typeof d1Schema> {
  const inMemoryD1 = new InMemoryD1Database();
  return drizzle(inMemoryD1, { schema: d1Schema });
}
