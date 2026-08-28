/**
 * HIKMAT TANI - Cloudflare Worker Entry Point
 * 
 * Entry point untuk deployment Cloudflare Workers (Edge Runtime)
 * Berjalan secara paralel dengan server Express Node.js tanpa mengubah
 * atau menggantikan deployment PostgreSQL yang sedang berjalan.
 * 
 * Bindings:
 * - env.DB: Cloudflare D1 Database Binding ('hikmat-tani-db')
 * - env.ASSETS: Fetcher untuk static assets dist/ SPA
 */

import { createD1Client, d1Schema } from './db/d1/index.ts';
import { durableOutboxConsumer } from './services/outboxConsumer.ts';

export interface Env {
  DB: any; // Cloudflare D1 Database binding
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
  DATABASE_PROVIDER?: string;
  JWT_SECRET?: string;
  CORS_ORIGIN?: string;
}

export default {
  async fetch(request: Request, env: Env, _ctx: any): Promise<Response> {
    const url = new URL(request.url);

    // 1. CORS headers
    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': env.CORS_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // 2. Health check endpoints
    if (url.pathname === '/api/v1/health' || url.pathname === '/api/health') {
      let d1Status = {
        configured: Boolean(env.DB),
        connected: Boolean(env.DB),
        engine: 'Cloudflare D1 (SQLite Drizzle ORM)',
        schemaVersion: '1.0.0',
        tableCount: Object.keys(d1Schema).length,
      };

      return new Response(
        JSON.stringify({
          status: 'ok',
          app: 'HIKMAT TANI',
          runtime: 'Cloudflare Workers (Edge)',
          database: d1Status,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    // 3. API D1 Routes placeholder (dapat diperluas bertahap)
    if (url.pathname.startsWith('/api/')) {
      if (!env.DB) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Database D1 binding (env.DB) belum terkonfigurasi pada Worker.',
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          }
        );
      }

      // Inisialisasi Drizzle D1 Client
      const db = createD1Client(env.DB);

      // Contoh: Public info config
      if (url.pathname === '/api/v1/config/public' && request.method === 'GET') {
        try {
          const configRecord = await (db as any).select().from(d1Schema.appConfigs).limit(1);
          return new Response(
            JSON.stringify({
              success: true,
              data: configRecord[0] || null,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            }
          );
        } catch (err: any) {
          return new Response(
            JSON.stringify({ success: false, error: err.message }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'HIKMAT TANI Cloudflare Worker API Ready',
          path: url.pathname,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // 4. Static assets handling (SPA)
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('HIKMAT TANI Cloudflare Worker Gateway', {
      status: 200,
      headers: { 'Content-Type': 'text/plain', ...corsHeaders },
    });
  },

  /**
   * Cloudflare Cron Trigger Scheduled Handler (Edge Background Execution)
   * 
   * Dijalankan secara otomatis oleh Cloudflare scheduler untuk memproses
   * event replikasi outbox PostgreSQL -> D1 tanpa memerlukan request user.
   */
  async scheduled(controller: any, env: Env, ctx: any): Promise<void> {
    const runDrain = async () => {
      if (!env.DB) {
        console.warn('[Worker Scheduler] DB binding tidak tersedia untuk drain.');
        return;
      }

      try {
        const db = env.DB?.prepare ? (createD1Client(env.DB)) : env.DB;
        if (db) {
          durableOutboxConsumer.setD1Db(db);
        }

        const workerNodeId = `cf_worker_${controller.cron || 'cron'}_${controller.scheduledTime || Date.now()}`;
        const result = await durableOutboxConsumer.drainPendingEvents(workerNodeId, 20);

        console.log(`[Worker Scheduler] Outbox drain completed: ${result.completed} completed, ${result.failed} failed, ${result.deadLetter} dead-letter.`);
      } catch (err: any) {
        console.error('[Worker Scheduler] Outbox drain error:', err?.message || err);
      }
    };

    if (ctx?.waitUntil) {
      ctx.waitUntil(runDrain());
    } else {
      await runDrain();
    }
  },
};

