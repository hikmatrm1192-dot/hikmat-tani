import { DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import * as d1Schema from './schema.ts';
import { D1Database } from './index.ts';

/**
 * In-memory D1 Database Engine for Tests & Standalone Node Runtime
 * Implements the Cloudflare D1Database interface for Drizzle ORM
 */
export class InMemoryD1Database implements D1Database {
  private tables: Map<string, Map<string, any>> = new Map();
  private tableColumns: Map<string, Array<{ cid: number; name: string; type: string; notnull: number; dflt_value: any; pk: number }>> = new Map();

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.tables.clear();
    this.tableColumns.clear();
    const defaultTables = [
      'processed_operations',
      'sync_journal',
      'lands',
      'farmers',
      'crop_seasons',
      'activities',
      'activity_fertilizers',
      'activity_opt_observations',
      'recommendations',
      'farmer_decisions',
      'actual_actions',
      'app_configs',
      'admin_users',
      'admin_audit_logs',
      'fertilizers',
      'varieties',
      'opts',
      'natural_enemies',
      'references',
      'knowledge_articles',
      'auth_users',
      'replication_outbox',
    ];
    for (const tbl of defaultTables) {
      this.tables.set(tbl, new Map());
    }
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

  public getTableInfo(tableName: string): Array<{ cid: number; name: string; type: string; notnull: number; dflt_value: any; pk: number }> {
    const normalized = tableName.replace(/["`]/g, '').toLowerCase();
    if (this.tableColumns.has(normalized)) {
      return this.tableColumns.get(normalized)!;
    }
    // Return default schema columns if table exists
    const defaultCols: Record<string, string[]> = {
      admin_audit_logs: ['id', 'actor_id', 'actor_name', 'actor_role', 'action', 'details', 'ip_address', 'created_at'],
      admin_users: ['id', 'username', 'email', 'full_name', 'password_hash', 'salt', 'role', 'is_active', 'last_login_at', 'created_at', 'updated_at'],
      app_configs: ['id', 'app_name', 'slogan', 'logo_url', 'logo_primary', 'logo_horizontal', 'app_icon', 'description', 'contact_phone', 'contact_email', 'support_title', 'support_description', 'donation_active', 'donation_recipient_name', 'donation_bank_name', 'donation_account_number', 'donation_ewallet_number', 'donation_qris_image', 'donation_url', 'updated_by', 'updated_at'],
      auth_users: ['id', 'anonymous_id', 'role', 'is_active', 'last_seen_at', 'created_at', 'updated_at'],
      farmers: ['id', 'name', 'phone_number', 'nik', 'pin_hash', 'salt', 'village', 'district', 'regency', 'province', 'farmer_group_name', 'auth_user_id', 'created_at', 'updated_at'],
    };

    if (defaultCols[normalized]) {
      const cols = defaultCols[normalized].map((name, idx) => ({
        cid: idx,
        name,
        type: 'TEXT',
        notnull: name === 'id' ? 1 : 0,
        dflt_value: null,
        pk: name === 'id' ? 1 : 0,
      }));
      this.tableColumns.set(normalized, cols);
      return cols;
    }

    return [];
  }

  public setTableInfo(tableName: string, cols: Array<{ cid: number; name: string; type: string; notnull: number; dflt_value: any; pk: number }>): void {
    const normalized = tableName.replace(/["`]/g, '').toLowerCase();
    this.tableColumns.set(normalized, cols);
  }

  public addColumn(tableName: string, colName: string, colType: string = 'TEXT', defaultValue: any = null): void {
    const normalized = tableName.replace(/["`]/g, '').toLowerCase();
    const cols = this.getTableInfo(normalized);
    if (!cols.some((c) => c.name.toLowerCase() === colName.toLowerCase())) {
      cols.push({
        cid: cols.length,
        name: colName,
        type: colType,
        notnull: 0,
        dflt_value: defaultValue,
        pk: 0,
      });
      this.tableColumns.set(normalized, cols);

      // Backfill existing rows if default value provided
      const tableMap = this.getTableMap(normalized);
      for (const [k, row] of tableMap.entries()) {
        if (row[colName] === undefined) {
          row[colName] = defaultValue;
          tableMap.set(k, row);
        }
      }
    }
  }

  public renameTable(oldName: string, newName: string): void {
    const oldNorm = oldName.replace(/["`]/g, '').toLowerCase();
    const newNorm = newName.replace(/["`]/g, '').toLowerCase();
    if (this.tables.has(oldNorm)) {
      const data = this.tables.get(oldNorm)!;
      this.tables.delete(oldNorm);
      this.tables.set(newNorm, data);
    }
    if (this.tableColumns.has(oldNorm)) {
      const cols = this.tableColumns.get(oldNorm)!;
      this.tableColumns.delete(oldNorm);
      this.tableColumns.set(newNorm, cols);
    }
  }

  public dropTable(tableName: string): void {
    const normalized = tableName.replace(/["`]/g, '').toLowerCase();
    this.tables.delete(normalized);
    this.tableColumns.delete(normalized);
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
    const selectMatch = this.query.trim().match(/^SELECT\s+([\s\S]+?)\s+FROM/i);
    if (selectMatch && selectMatch[1] && selectMatch[1].trim() !== '*') {
      const selectCols = selectMatch[1]
        .split(',')
        .map((c) => {
          const parts = c.trim().split(/\s+as\s+/i);
          const colWithTable = parts[0].trim().replace(/[`"]/g, '');
          const dotIdx = colWithTable.lastIndexOf('.');
          return dotIdx >= 0 ? colWithTable.slice(dotIdx + 1) : colWithTable;
        });
      return results.map((row) => selectCols.map((col) => (row[col] !== undefined ? row[col] : null)));
    }
    return results.map((row) => Object.values(row));
  }

  private async execute(): Promise<any[]> {
    const sql = this.query.trim();

    // 1. PRAGMA queries
    if (/^PRAGMA\s+table_info\(([^)]+)\)/i.test(sql)) {
      const match = sql.match(/^PRAGMA\s+table_info\(([^)]+)\)/i);
      const tableName = match ? match[1].replace(/[`"]/g, '').trim() : '';
      return this.db.getTableInfo(tableName);
    }
    if (/^PRAGMA/i.test(sql)) {
      return [];
    }

    // 2. CREATE TABLE / INDEX
    if (/^CREATE\s+INDEX/i.test(sql)) {
      return [];
    }
    if (/^CREATE\s+TABLE/i.test(sql)) {
      const match = sql.match(/CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+[`"]?([a-zA-Z0-9_]+)[`"]?\s*\(([\s\S]+)\)/i);
      if (match) {
        const tableName = match[1];
        this.db.getTableMap(tableName); // ensure table map exists
      }
      return [];
    }

    // 3. ALTER TABLE statement
    if (/^ALTER\s+TABLE/i.test(sql)) {
      const addColMatch = sql.match(/ALTER\s+TABLE\s+[`"]?([a-zA-Z0-9_]+)[`"]?\s+ADD(?:\s+COLUMN)?\s+[`"]?([a-zA-Z0-9_]+)[`"]?(?:\s+([a-zA-Z0-9_]+))?(?:.*DEFAULT\s+([^;]+))?/i);
      if (addColMatch) {
        const tableName = addColMatch[1];
        const colName = addColMatch[2];
        const colType = addColMatch[3] || 'TEXT';
        let defaultVal: any = null;
        if (addColMatch[4]) {
          const rawDef = addColMatch[4].trim().replace(/^\(|\)$/g, '');
          if (/^CURRENT_TIMESTAMP/i.test(rawDef)) {
            defaultVal = new Date().toISOString();
          } else if (/^\d+$/.test(rawDef)) {
            defaultVal = Number(rawDef);
          } else {
            defaultVal = rawDef.replace(/^['"`]|['"`]$/g, '');
          }
        }
        this.db.addColumn(tableName, colName, colType, defaultVal);
        return [];
      }

      const renameMatch = sql.match(/ALTER\s+TABLE\s+[`"]?([a-zA-Z0-9_]+)[`"]?\s+RENAME\s+TO\s+[`"]?([a-zA-Z0-9_]+)[`"]?/i);
      if (renameMatch) {
        this.db.renameTable(renameMatch[1], renameMatch[2]);
        return [];
      }
      return [];
    }

    // 4. DROP TABLE statement
    if (/^DROP\s+TABLE/i.test(sql)) {
      const dropMatch = sql.match(/DROP\s+TABLE(?:\s+IF\s+EXISTS)?\s+[`"]?([a-zA-Z0-9_]+)[`"]?/i);
      if (dropMatch) {
        this.db.dropTable(dropMatch[1]);
      }
      return [];
    }

    // 5. SELECT 1 health check
    if (/^SELECT\s+1/i.test(sql)) {
      return [{ 1: 1 }];
    }

    // 2. INSERT statement
    if (/^INSERT\s+INTO/i.test(sql)) {
      const match = sql.match(/INSERT\s+INTO\s+[`"]?([a-zA-Z0-9_]+)[`"]?\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
      if (match) {
        const tableName = match[1];
        const columns = match[2].split(',').map((c) => c.trim().replace(/[`"]/g, ''));
        const valTokens = match[3].split(',').map((v) => v.trim());
        const tableMap = this.db.getTableMap(tableName);

        const row: Record<string, any> = {};
        let paramIdx = 0;
        for (let i = 0; i < columns.length; i++) {
          const colName = columns[i];
          const token = valTokens[i] ? valTokens[i].toLowerCase() : '?';
          if (token === '?') {
            row[colName] = this.params[paramIdx++] !== undefined ? this.params[paramIdx - 1] : null;
          } else if (token === 'null' || token === 'default') {
            row[colName] = null;
          } else {
            row[colName] = valTokens[i].replace(/^['"`]|['"`]$/g, '');
          }
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
      const updateMatch = sql.match(/UPDATE\s+[`"]?([a-zA-Z0-9_]+)[`"]?\s+SET\s+([\s\S]+?)(?:\s+WHERE\s+([\s\S]+))?$/i);
      if (updateMatch) {
        const tableName = updateMatch[1];
        const setClause = updateMatch[2];
        const whereClause = updateMatch[3] || '';
        const tableMap = this.db.getTableMap(tableName);

        const setAssignments = setClause.split(',').map((s) => s.trim());
        let paramIdx = 0;
        const updates: Record<string, any> = {};
        for (const assign of setAssignments) {
          const eqIdx = assign.indexOf('=');
          if (eqIdx > 0) {
            const col = assign.slice(0, eqIdx).trim().replace(/[`"]/g, '');
            const rawVal = assign.slice(eqIdx + 1).trim();
            if (rawVal === '?') {
              updates[col] = this.params[paramIdx++];
            } else if (rawVal.toLowerCase() === 'null') {
              updates[col] = null;
            } else {
              updates[col] = rawVal.replace(/^['"`]|['"`]$/g, '');
            }
          }
        }

        let whereId: string | null = null;
        if (whereClause && /(?:^|\s|\.)[`"]?id[`"]?\s*=\s*\?/i.test(whereClause)) {
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
        } else {
          // Conditional update matching whereClause
          for (const [k, v] of tableMap.entries()) {
            let matches = false;
            if (/actor_name\s+IS\s+NULL\s+OR\s+actor_name\s*=\s*''/i.test(whereClause)) {
              matches = !v.actor_name || v.actor_name === '';
            } else if (/phone_number\s+IS\s+NULL\s+AND\s+phone\s+IS\s+NOT\s+NULL/i.test(whereClause)) {
              matches = !v.phone_number && Boolean(v.phone);
            } else if (/id\s*=\s*['"]?([^'"]+)['"]?/i.test(whereClause)) {
              const idMatch = whereClause.match(/id\s*=\s*['"]?([^'"]+)['"]?/i);
              matches = idMatch ? v.id === idMatch[1] : false;
            }
            if (matches) {
              tableMap.set(k, { ...v, ...updates });
            }
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
      const whereMatch = sql.match(/WHERE\s+([\s\S]+?)(?:\s+ORDER\s+BY|\s+LIMIT|$)/i);
      if (whereMatch) {
        const whereClause = whereMatch[1];
        // Cek apakah query melibatkan tabel farmers dengan pencarian NIK atau Nomor HP (termasuk klausa OR)
        if (tableName === 'farmers' && (/nik/i.test(whereClause) || /phone_number/i.test(whereClause))) {
          const matchParams = this.params.map(String);
          rows = rows.filter((r) => {
            return matchParams.includes(String(r.nik)) || matchParams.includes(String(r.phone_number));
          });
        } else if (tableName === 'admin_users' && (/username/i.test(whereClause) || /email/i.test(whereClause))) {
          const matchParams = this.params.map((p) => String(p).toLowerCase());
          rows = rows.filter((r) => {
            return matchParams.includes(String(r.username || '').toLowerCase()) ||
                   matchParams.includes(String(r.email || '').toLowerCase());
          });
        } else {
          let paramIdx = 0;

          // Specific filter for id = ? (supporting optional table prefix like "auth_users"."id" = ?, without matching _id columns)
          if (/(?:^|\s|\.)[`"]?id[`"]?\s*=\s*\?/i.test(whereClause) && !/(?:farmer_id|auth_user_id|operation_id|entity_id|anonymous_id)\s*=/i.test(whereClause)) {
            const targetId = this.params[paramIdx++];
            rows = rows.filter((r) => String(r.id) === String(targetId));
          }

          // Specific filter for auth_user_id = ?
          if (/auth_user_id["`]?\s*=\s*\?/i.test(whereClause)) {
            const targetAuthId = this.params[paramIdx++];
            rows = rows.filter((r) => r.auth_user_id === targetAuthId);
          }

          // Specific filter for operation_id
          if (/operation_id["`]?\s*=\s*\?/i.test(whereClause)) {
            const targetOpId = this.params[paramIdx++];
            rows = rows.filter((r) => r.operation_id === targetOpId);
          }

          // Specific filter for entity_type and entity_id
          if (/entity_type["`]?\s*=\s*\?/i.test(whereClause) && /entity_id["`]?\s*=\s*\?/i.test(whereClause)) {
            const targetType = this.params[paramIdx++];
            const targetId = this.params[paramIdx++];
            rows = rows.filter((r) => r.entity_type === targetType && r.entity_id === targetId);
          }

          // Specific filter for farmer_id
          if (/farmer_id["`]?\s*=\s*\?/i.test(whereClause)) {
            const targetFarmer = this.params[paramIdx++];
            rows = rows.filter((r) => r.farmer_id === targetFarmer);
          }

          // Specific filter for server_timestamp > ?
          if (/server_timestamp["`]?\s*>\s*\?/i.test(whereClause)) {
            const sinceVal = this.params[paramIdx++];
            rows = rows.filter((r) => String(r.server_timestamp) > String(sinceVal));
          }
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
        } else if (/created_at["`]?\s+DESC/i.test(sql)) {
          rows.sort((a, b) => {
            const timeA = String(a.created_at || '');
            const timeB = String(b.created_at || '');
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

export function createTestD1Database(): InMemoryD1Database {
  return new InMemoryD1Database();
}

export function createTestD1Client(db?: InMemoryD1Database): DrizzleD1Database<typeof d1Schema> {
  const inMemoryD1 = db || new InMemoryD1Database();
  return drizzle(inMemoryD1, { schema: d1Schema });
}
