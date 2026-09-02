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
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
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
    if (env.CORS_ORIGIN === '*') {
      allowOrigin = '*';
    } else if (env.CORS_ORIGIN) {
      const configuredOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);
      if (requestOrigin && configuredOrigins.includes(requestOrigin)) allowOrigin = requestOrigin;
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
        if (isNaN(lat) || isNaN(lon)) return jsonResponse({ success: false, error: { code: 'INVALID_COORDINATES', message: 'Koordinat lat dan lon harus berupa angka yang valid.' } }, 400, corsHeaders);
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return jsonResponse({ success: false, error: { code: 'INVALID_COORDINATES', message: 'Rentang koordinat tidak valid (Lat: -90 s.d 90, Lon: -180 s.d 180).' } }, 400, corsHeaders);
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
        const lat = latStr ? parseFloat(latStr) : undefined;
        const lon = lonStr ? parseFloat(lonStr) : undefined;
        try {
          const alertsData = await regionalAlertService.getAlerts({ districtId, lat, lon });
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
          const result = await authenticateAdminOnWorker(env.DB, env, body.username, body.password, ipAddress);
          if (!result.success || !result.admin) return jsonResponse({ success: false, error: { code: 'INVALID_CREDENTIALS', message: result.error || 'Autentikasi pengelola gagal.' } }, 401, corsHeaders);
          const tokenResult = authService.generateSessionToken({ userId: result.admin.id, role: result.admin.role, isAnonymous: false });
          return jsonResponse({ success: true, message: 'Login pengelola berhasil.', data: { token: tokenResult.token, admin: result.admin } }, 200, corsHeaders);
        }

        if (url.pathname === '/api/v1/admin/me' && request.method === 'GET') {
          const session = getBearerSession(request);
          if (!session) return jsonResponse({ success: false, error: { code: 'UNAUTHORIZED', message: 'Token pengelola tidak valid.' } }, 401, corsHeaders);
          return jsonResponse({ success: true, data: { userId: session.userId, role: session.role } }, 200, corsHeaders);
        }

        if (url.pathname === '/api/v1/admin/auth/change-password' && request.method === 'POST') {
          const session = getBearerSession(request);
          if (!session || !['MANAGER', 'SUPER_ADMIN'].includes(String(session.role).toUpperCase())) return jsonResponse({ success: false, error: { code: 'UNAUTHORIZED', message: 'Sesi pengelola tidak valid.' } }, 401, corsHeaders);
          try {
            const body = (await request.json().catch(() => ({}))) as any;
            const result = await adminService.changePasswordAsync(session, body.currentPassword, body.newPassword, ipAddress, db || undefined);
            return jsonResponse({ success: true, message: result.message }, 200, corsHeaders);
          } catch (err: any) {
            return jsonResponse({ success: false, error: { code: 'CHANGE_PASSWORD_ERROR', message: err?.message || 'Gagal mengubah kata sandi.' } }, 400, corsHeaders);
          }
        }

        const session = getBearerSession(request);
        if (!session || !['MANAGER', 'SUPER_ADMIN'].includes(String(session.role).toUpperCase())) return jsonResponse({ success: false, error: { code: 'UNAUTHORIZED', message: 'Akses pengelola memerlukan Bearer token yang valid.' } }, 401, corsHeaders);

        try {
          if (url.pathname === '/api/v1/admin/config' && request.method === 'GET') {
            return jsonResponse({ success: true, data: await adminService.getAdminConfigAsync(session, db || undefined) }, 200, corsHeaders);
          }
          if (url.pathname === '/api/v1/admin/config' && request.method === 'PUT') {
            const body = (await request.json().catch(() => ({}))) as any;
            const updated = await adminService.updateAdminConfigAsync(session, body, ipAddress, db || undefined);
            return jsonResponse({ success: true, message: 'Konfigurasi resmi HIKMAT TANI berhasil diperbarui.', data: updated }, 200, corsHeaders);
          }
          if (url.pathname === '/api/v1/admin/qris' && request.method === 'POST') {
            const body = (await request.json().catch(() => ({}))) as any;
            const updated = await adminService.updateQrisImageAsync(session, body.qrisImage, ipAddress, db || undefined);
            return jsonResponse({ success: true, message: 'Gambar QRIS resmi berhasil diperbarui.', data: updated }, 200, corsHeaders);
          }
          if (url.pathname === '/api/v1/admin/audit-logs' && request.method === 'GET') {
            const limit = Math.min(Number(url.searchParams.get('limit') || 50), 200);
            return jsonResponse({ success: true, data: await adminService.getAuditLogsAsync(session, limit, db || undefined) }, 200, corsHeaders);
          }
          if (url.pathname === '/api/v1/admin/managers' && request.method === 'GET') {
            if (String(session.role).toUpperCase() !== 'SUPER_ADMIN') return jsonResponse({ success: false, error: { code: 'FORBIDDEN', message: 'Hanya SUPER_ADMIN yang dapat mengelola akun pengelola.' } }, 403, corsHeaders);
            return jsonResponse({ success: true, data: await adminService.listManagersAsync(session, db || undefined) }, 200, corsHeaders);
          }
          if (url.pathname === '/api/v1/admin/managers' && request.method === 'POST') {
            if (String(session.role).toUpperCase() !== 'SUPER_ADMIN') return jsonResponse({ success: false, error: { code: 'FORBIDDEN', message: 'Hanya SUPER_ADMIN yang dapat mengelola akun pengelola.' } }, 403, corsHeaders);
            const body = (await request.json().catch(() => ({}))) as any;
            return jsonResponse({ success: true, message: 'Akun pengelola baru berhasil dibuat.', data: await adminService.createManagerAsync(session, body, ipAddress, db || undefined) }, 201, corsHeaders);
          }
          const managerMatch = url.pathname.match(/^\/api\/v1\/admin\/managers\/([^/]+)$/);
          if (managerMatch && String(session.role).toUpperCase() !== 'SUPER_ADMIN') return jsonResponse({ success: false, error: { code: 'FORBIDDEN', message: 'Hanya SUPER_ADMIN yang dapat mengelola akun pengelola.' } }, 403, corsHeaders);
          if (managerMatch && request.method === 'PATCH') {
            const body = (await request.json().catch(() => ({}))) as any;
            return jsonResponse({ success: true, message: 'Data pengelola berhasil diperbarui.', data: await adminService.updateManagerAsync(session, managerMatch[1], body, ipAddress, db || undefined) }, 200, corsHeaders);
          }
          if (managerMatch && request.method === 'DELETE') {
            await adminService.deleteManagerAsync(session, managerMatch[1], ipAddress, db || undefined);
            return jsonResponse({ success: true, message: 'Akun pengelola berhasil dihapus.' }, 200, corsHeaders);
          }
          return jsonResponse({ success: false, error: { code: 'NOT_FOUND', message: 'Endpoint pengelola tidak ditemukan.' } }, 404, corsHeaders);
        } catch (err: any) {
          return jsonResponse({ success: false, error: { code: err?.code || 'ADMIN_ERROR', message: err?.message || 'Operasi pengelola gagal.' } }, err?.statusCode || 400, corsHeaders);
        }
      }

      if (url.pathname.startsWith('/api/')) {
        if (!env.DB) return jsonResponse({ success: false, error: 'Database D1 binding (env.DB) belum terkonfigurasi pada Worker.' }, 503, corsHeaders);
        await ensureD1CanonicalSchema(env.DB);
        const db = createD1Client(env.DB);

        if (url.pathname === '/api/v1/auth/register' && request.method === 'POST') {
          try {
            const body = (await request.json().catch(() => ({}))) as any;
            const result = await authService.registerFarmerAsync({ name: body.name, nik: body.nik, phoneNumber: body.phoneNumber, pin: body.pin, village: body.village, district: body.district, regency: body.regency, province: body.province, farmerGroupName: body.farmerGroupName }, db);
            return jsonResponse({ success: true, message: 'Pendaftaran identitas petani berhasil', data: result }, 201, corsHeaders);
          } catch (err: any) {
            console.error('[Worker POST /api/v1/auth/register Error]', { statusCode: err?.statusCode || 400, code: err?.code || 'REGISTRATION_ERROR', message: err?.message || 'Terjadi kesalahan saat pendaftaran', detail: err?.detail, cause: err?.cause, stack: err?.stack });
            return jsonResponse({ success: false, error: { code: err.code || 'REGISTRATION_ERROR', message: err.message || 'Terjadi kesalahan saat pendaftaran', ...(err.detail ? { detail: err.detail } : {}) } }, err.statusCode || 400, corsHeaders);
          }
        }

        if (url.pathname === '/api/v1/auth/login' && request.method === 'POST') {
          try {
            const body = (await request.json().catch(() => ({}))) as any;
            const result = await authService.loginFarmerAsync({ identifier: body.identifier || body.nik || body.phoneNumber, pin: body.pin }, db);
            return jsonResponse({ success: true, message: 'Login berhasil', data: result }, 200, corsHeaders);
          } catch (err: any) {
            return jsonResponse({ success: false, error: { code: err.code || 'AUTH_ERROR', message: err.message || 'Login gagal' } }, err.statusCode || 400, corsHeaders);
          }
        }

        if (url.pathname === '/api/v1/auth/me' && request.method === 'GET') {
          const user = getBearerSession(request);
          if (!user) return jsonResponse({ success: false, error: { code: 'INVALID_TOKEN', message: 'Token tidak valid atau kedaluwarsa' } }, 401, corsHeaders);
          const profile = (await authService.getFarmerProfileAsync(user.farmerId, db)) || { id: user.farmerId, name: user.name || 'Petani Padi Indonesia', nikMasked: '3210********0001', phoneNumber: user.phoneNumber || '081234567890', role: user.role, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
          return jsonResponse({ success: true, data: { user: { id: user.userId, role: user.role, isAnonymous: user.isAnonymous }, farmer: profile } }, 200, corsHeaders);
        }

        if (url.pathname === '/api/v1/auth/logout' && request.method === 'POST') return jsonResponse({ success: true, message: 'Sesi berhasil diakhiri' }, 200, corsHeaders);

        if (url.pathname === '/api/v1/config/public' && request.method === 'GET') {
          try {
            const configRecord = await (db as any).select().from(d1Schema.appConfigs).limit(1);
            return jsonResponse({ success: true, data: configRecord[0] || null }, 200, corsHeaders);
          } catch (err: any) {
            return jsonResponse({ success: false, error: err.message }, 500, corsHeaders);
          }
        }
        return jsonResponse({ success: true, message: 'HIKMAT TANI Cloudflare Worker API Ready', path: url.pathname }, 200, corsHeaders);
      }

      if (env.ASSETS) {
        try {
          const response = await env.ASSETS.fetch(request);
          if (response.status === 404 && request.method === 'GET' && !url.pathname.includes('.')) {
            const indexUrl = new URL('/index.html', request.url);
            return await env.ASSETS.fetch(new Request(indexUrl.toString(), request));
          }
          return response;
        } catch (assetErr: any) {
          console.error('[Worker Assets Error]', assetErr?.message || assetErr);
        }
      }
      return new Response('HIKMAT TANI Cloudflare Worker Gateway', { status: 200, headers: { 'Content-Type': 'text/plain', ...corsHeaders } });
    } catch (globalErr: any) {
      console.error('[Worker Unhandled Error]', globalErr?.message || globalErr);
      return jsonResponse({ success: false, error: { code: 'WORKER_INTERNAL_ERROR', message: globalErr?.message || 'Terjadi kesalahan pada Cloudflare Worker Edge Runtime' } }, 500, corsHeaders);
    }
  },

  async scheduled(controller: any, env: Env, ctx: any): Promise<void> {
    const runDrain = async () => {
      if (!env.DB) {
        console.warn('[Worker Scheduler] DB binding tidak tersedia untuk drain.');
        return;
      }
      try {
        const db = env.DB?.prepare ? createD1Client(env.DB) : env.DB;
        if (db) durableOutboxConsumer.setD1Db(db);
        const workerNodeId = `cf_worker_${controller.cron || 'cron'}_${controller.scheduledTime || Date.now()}`;
        const result = await durableOutboxConsumer.drainPendingEvents(workerNodeId, 20);
        console.log(`[Worker Scheduler] Outbox drain completed: ${result.completed} completed, ${result.failed} failed, ${result.deadLetter} dead-letter.`);
      } catch (err: any) {
        console.error('[Worker Scheduler] Outbox drain error:', err?.message || err);
      }
    };
    if (ctx?.waitUntil) ctx.waitUntil(runDrain());
    else await runDrain();
  },
};
