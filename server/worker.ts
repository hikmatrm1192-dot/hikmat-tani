/**
 * HIKMAT TANI - Cloudflare Worker Entry Point
 *
 * Edge gateway for the SPA, farmer API, and admin portal.
 */

import { createD1Client, d1Schema, ensureD1CanonicalSchema } from './db/d1/index.ts';
import { durableOutboxConsumer } from './services/outboxConsumer.ts';
import { authService } from './services/authService.ts';
import { adminService } from './services/adminService.ts';
import { authenticateAdminOnWorker } from './services/workerAdminAuth.ts';
import { weatherService } from './services/weatherService.ts';
import { regionalAlertService } from './services/regionalAlertService.ts';
import { config } from './config.ts';

export interface Env {
  DB: any;
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
  DATABASE_PROVIDER?: string;
  JWT_SECRET?: string;
  CORS_ORIGIN?: string;
  ADMIN_INITIAL_PASSWORD?: string;
  SUPER_ADMIN_PASSWORD?: string;
  MANAGER_INITIAL_PASSWORD?: string;
}

function jsonResponse(body: unknown, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

function getBearerSession(request: Request) {
  const authHeader = request.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  return authService.verifyToken(authHeader.slice(7));
}

export default {
  async fetch(request: Request, env: Env, _ctx: any): Promise<Response> {
    const url = new URL(request.url);

    if (env.JWT_SECRET) config.jwtSecret = env.JWT_SECRET;

    const requestOrigin = request.headers.get('Origin') || '';
    const allowedOrigins = [
      'https://app.hikmattani.id',
      'https://hikmat-tani.hikmat-rm1192.workers.dev',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
    ];

    let allowOrigin = '';
    if (env.CORS_ORIGIN && env.CORS_ORIGIN !== '*') {
      const configuredOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);
      if (requestOrigin && configuredOrigins.includes(requestOrigin)) allowOrigin = requestOrigin;
    } else if (env.CORS_ORIGIN === '*') {
      allowOrigin = '*';
    } else if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
      allowOrigin = requestOrigin;
    }

    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    };

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

    try {
      if (url.pathname === '/api/v1/health' || url.pathname === '/api/health') {
        let connected = false;
        if (env.DB) {
          try {
            await env.DB.prepare('SELECT 1').first();
            connected = true;
          } catch {
            connected = false;
          }
        }

        const d1Status = {
          configured: Boolean(env.DB),
          connected,
          engine: 'Cloudflare D1 (SQLite Drizzle ORM)',
          schemaVersion: '1.0.0',
          tableCount: Object.keys(d1Schema).length,
        };

        return jsonResponse({
          status: connected ? 'ok' : 'degraded',
          app: 'HIKMAT TANI',
          runtime: 'Cloudflare Workers (Edge)',
          database: d1Status,
          timestamp: new Date().toISOString(),
        }, connected ? 200 : 503, corsHeaders);
      }

      if (url.pathname === '/api/v1/info/weather') {
        if (request.method !== 'GET') return jsonResponse({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Hanya metode GET yang didukung.' } }, 405, corsHeaders);
        const latStr = url.searchParams.get('lat');
        const lonStr = url.searchParams.get('lon');
        if (!latStr || !lonStr) return jsonResponse({ success: false, error: { code: 'MISSING_COORDINATES', message: 'Parameter lat (latitude) dan lon (longitude) diperlukan.' } }, 400, corsHeaders);
        const lat = parseFloat(latStr);
        const lon = parseFloat(lonStr);
        if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) return jsonResponse({ success: false, error: { code: 'INVALID_COORDINATES', message: 'Koordinat lat dan lon harus berupa angka yang valid dan berada dalam rentang yang diperbolehkan.' } }, 400, corsHeaders);
        try {
          return jsonResponse({ success: true, data: await weatherService.getWeather(lat, lon) }, 200, corsHeaders);
        } catch (err: any) {
          return jsonResponse({ success: false, error: { code: 'WEATHER_SERVICE_ERROR', message: err?.message || 'Gagal memuat perkiraan cuaca.' } }, 500, corsHeaders);
        }
      }

      if (url.pathname === '/api/v1/info/regional-alerts') {
        if (request.method !== 'GET') return jsonResponse({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Hanya metode GET yang didukung.' } }, 405, corsHeaders);
        const districtId = url.searchParams.get('district_id') || undefined;
        const latStr = url.searchParams.get('lat');
        const lonStr = url.searchParams.get('lon');
        try {
          const alertsData = await regionalAlertService.getAlerts({ districtId, lat: latStr ? parseFloat(latStr) : undefined, lon: lonStr ? parseFloat(lonStr) : undefined });
          return jsonResponse({ success: true, data: alertsData }, 200, corsHeaders);
        } catch (err: any) {
          return jsonResponse({ success: false, error: { code: 'REGIONAL_ALERTS_ERROR', message: err?.message || 'Gagal memeriksa peringatan regional.' } }, 500, corsHeaders);
        }
      }

      if (url.pathname.startsWith('/api/v1/admin/')) {
        const ipAddress = request.headers.get('CF-Connecting-IP') || '127.0.0.1';
        let db: any = null;
        if (env.DB) {
          await ensureD1CanonicalSchema(env.DB);
          db = createD1Client(env.DB);
          adminService.setDb(db);
        }

        if (url.pathname === '/api/v1/admin/auth/login' && request.method === 'POST') {
          const body = (await request.json().catch(() => ({}))) as any;
          if (!body.username || typeof body.username !== 'string' || !body.password || typeof body.password !== 'string') return jsonResponse({ success: false, error: { code: 'INVALID_INPUT', message: 'Nama pengguna/email dan kata sandi pengelola wajib diisi.' } }, 400, corsHeaders);
          if (!env.DB) return jsonResponse({ success: false, error: { code: 'DATABASE_UNAVAILABLE', message: 'Database pengelola tidak tersedia.' } }, 503, corsHeaders);
          if (!env.JWT_SECRET) return jsonResponse({ success: false, error: { code: 'JWT_SECRET_NOT_CONFIGURED', message: 'Konfigurasi keamanan sesi pengelola belum tersedia di Worker.' } }, 503, corsHeaders);
          const result = await authenticateAdminOnWorker({ db, username: body.username, password: body.password, ipAddress, userAgent: request.headers.get('User-Agent') || undefined, jwtSecret: env.JWT_SECRET });
          return jsonResponse(result.body, result.status, corsHeaders);
        }

        const authResult = await authenticateAdminOnWorker({ db, username: '', password: '', ipAddress, userAgent: request.headers.get('User-Agent') || undefined, jwtSecret: env.JWT_SECRET || '', mode: 'verify', token: request.headers.get('Authorization') || '' });
        if (authResult.status !== 200 || !authResult.body?.success) return jsonResponse(authResult.body, authResult.status, corsHeaders);
        if (!db) return jsonResponse({ success: false, error: { code: 'DATABASE_UNAVAILABLE', message: 'Database pengelola tidak tersedia.' } }, 503, corsHeaders);

        const adminId = authResult.body.data?.admin?.id || authResult.body.data?.user?.id;
        const adminRole = authResult.body.data?.admin?.role || authResult.body.data?.user?.role;

        try {
          if (url.pathname === '/api/v1/admin/config' && request.method === 'GET') return jsonResponse({ success: true, data: await adminService.getAdminConfigAsync() }, 200, corsHeaders);
          if (url.pathname === '/api/v1/admin/config' && request.method === 'PUT') {
            if (adminRole !== 'SUPER_ADMIN' && adminRole !== 'MANAGER') return jsonResponse({ success: false, error: { code: 'FORBIDDEN', message: 'Akses ditolak.' } }, 403, corsHeaders);
            return jsonResponse({ success: true, data: await adminService.updateAdminConfigAsync(await request.json().catch(() => ({})), adminId, ipAddress) }, 200, corsHeaders);
          }
          if (url.pathname === '/api/v1/admin/users' && request.method === 'GET') {
            if (adminRole !== 'SUPER_ADMIN') return jsonResponse({ success: false, error: { code: 'FORBIDDEN', message: 'Hanya SUPER_ADMIN yang dapat mengelola akun pengelola.' } }, 403, corsHeaders);
            return jsonResponse({ success: true, data: await adminService.listAdminUsersAsync() }, 200, corsHeaders);
          }
          if (url.pathname === '/api/v1/admin/users' && request.method === 'POST') {
            if (adminRole !== 'SUPER_ADMIN') return jsonResponse({ success: false, error: { code: 'FORBIDDEN', message: 'Hanya SUPER_ADMIN yang dapat membuat akun pengelola.' } }, 403, corsHeaders);
            return jsonResponse({ success: true, data: await adminService.createAdminUserAsync(await request.json().catch(() => ({})), adminId, ipAddress) }, 201, corsHeaders);
          }
          if (url.pathname.startsWith('/api/v1/admin/users/') && request.method === 'PUT') {
            if (adminRole !== 'SUPER_ADMIN') return jsonResponse({ success: false, error: { code: 'FORBIDDEN', message: 'Hanya SUPER_ADMIN yang dapat mengubah akun pengelola.' } }, 403, corsHeaders);
            const targetId = decodeURIComponent(url.pathname.split('/').pop() || '');
            return jsonResponse({ success: true, data: await adminService.updateAdminUserAsync(targetId, await request.json().catch(() => ({})), adminId, ipAddress) }, 200, corsHeaders);
          }
          if (url.pathname.startsWith('/api/v1/admin/users/') && request.method === 'DELETE') {
            if (adminRole !== 'SUPER_ADMIN') return jsonResponse({ success: false, error: { code: 'FORBIDDEN', message: 'Hanya SUPER_ADMIN yang dapat menghapus akun pengelola.' } }, 403, corsHeaders);
            const targetId = decodeURIComponent(url.pathname.split('/').pop() || '');
            return jsonResponse({ success: true, data: await adminService.deleteAdminUserAsync(targetId, adminId, ipAddress) }, 200, corsHeaders);
          }
          if (url.pathname === '/api/v1/admin/audit-logs' && request.method === 'GET') {
            if (adminRole !== 'SUPER_ADMIN') return jsonResponse({ success: false, error: { code: 'FORBIDDEN', message: 'Hanya SUPER_ADMIN yang dapat melihat audit log.' } }, 403, corsHeaders);
            return jsonResponse({ success: true, data: await adminService.getAuditLogsAsync() }, 200, corsHeaders);
          }
          return jsonResponse({ success: false, error: { code: 'NOT_FOUND', message: 'Endpoint pengelola tidak ditemukan.' } }, 404, corsHeaders);
        } catch (error: any) {
          return jsonResponse({ success: false, error: { code: error?.code || 'ADMIN_ERROR', message: error?.message || 'Terjadi kesalahan pada area pengelola.' } }, error?.statusCode || 500, corsHeaders);
        }
      }

      if (url.pathname === '/api/v1/auth/register' && request.method === 'POST') {
        try {
          const result = await authService.registerFarmerAsync(await request.json().catch(() => ({})), env.DB);
          return jsonResponse(result.body, result.status, corsHeaders);
        } catch (error: any) {
          console.error('[Worker POST /api/v1/auth/register Error]', error);
          return jsonResponse({ success: false, error: { code: error?.code || 'REGISTRATION_ERROR', message: error?.message || 'Registrasi gagal.' } }, error?.statusCode || 500, corsHeaders);
        }
      }

      if (url.pathname === '/api/v1/auth/login' && request.method === 'POST') {
        try {
          const result = await authService.loginFarmerAsync(await request.json().catch(() => ({})), env.DB);
          return jsonResponse(result.body, result.status, corsHeaders);
        } catch (error: any) {
          console.error('[Worker POST /api/v1/auth/login Error]', error);
          return jsonResponse({ success: false, error: { code: error?.code || 'LOGIN_ERROR', message: error?.message || 'Login gagal.' } }, error?.statusCode || 500, corsHeaders);
        }
      }

      if (url.pathname === '/api/v1/auth/me' && request.method === 'GET') {
        const session = getBearerSession(request);
        if (!session) return jsonResponse({ success: false, error: { code: 'UNAUTHORIZED', message: 'Sesi tidak valid atau telah kedaluwarsa.' } }, 401, corsHeaders);
        try {
          const result = await authService.getFarmerProfileAsync(session.userId, env.DB);
          return jsonResponse(result.body, result.status, corsHeaders);
        } catch (error: any) {
          return jsonResponse({ success: false, error: { code: error?.code || 'PROFILE_ERROR', message: error?.message || 'Profil tidak dapat dimuat.' } }, error?.statusCode || 500, corsHeaders);
        }
      }

      if (url.pathname === '/api/v1/auth/logout' && request.method === 'POST') {
        const session = getBearerSession(request);
        if (!session) return jsonResponse({ success: false, error: { code: 'UNAUTHORIZED', message: 'Sesi tidak valid atau telah kedaluwarsa.' } }, 401, corsHeaders);
        return jsonResponse({ success: true, data: { loggedOut: true } }, 200, corsHeaders);
      }

      if (url.pathname === '/api/v1/sync/push' || url.pathname === '/api/v1/sync/pull') {
        const session = getBearerSession(request);
        if (!session) return jsonResponse({ success: false, error: { code: 'UNAUTHORIZED', message: 'Sesi tidak valid atau telah kedaluwarsa.' } }, 401, corsHeaders);
        try {
          const db = createD1Client(env.DB);
          if (url.pathname.endsWith('/push')) return jsonResponse(await db.sync.push(await request.json(), session.userId), 200, corsHeaders);
          const cursor = url.searchParams.get('cursor');
          return jsonResponse(await db.sync.pull(session.userId, cursor ? Number(cursor) : undefined), 200, corsHeaders);
        } catch (error: any) {
          return jsonResponse({ success: false, error: { code: error?.code || 'SYNC_ERROR', message: error?.message || 'Sinkronisasi gagal.' } }, 500, corsHeaders);
        }
      }

      if (url.pathname.startsWith('/api/')) return jsonResponse({ success: false, error: { code: 'NOT_FOUND', message: 'Endpoint API tidak ditemukan.' } }, 404, corsHeaders);
      if (env.ASSETS) return env.ASSETS.fetch(request);
      return new Response('HIKMAT TANI', { status: 200, headers: corsHeaders });
    } catch (error: any) {
      console.error('[Worker Error]', error);
      return jsonResponse({ success: false, error: { code: error?.code || 'INTERNAL_ERROR', message: error?.message || 'Terjadi kesalahan internal.' } }, error?.statusCode || 500, corsHeaders);
    }
  },

  async scheduled(event: any, env: Env, ctx: any): Promise<void> {
    if (!env.DB) return;
    const result = await durableOutboxConsumer.drainPendingEvents(env.DB);
    if (ctx?.waitUntil) ctx.waitUntil(Promise.resolve(result));
    console.log('[Worker Scheduler] Outbox drain completed:', result);
  },
};
