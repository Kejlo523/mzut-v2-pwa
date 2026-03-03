import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Try loading from several locations: root, current dir
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '.env') });
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Agent } from 'undici';

const app = express();
const port = Number(process.env.PORT || 8787);

const USOS_CONSUMER_KEY = process.env.USOS_CONSUMER_KEY || '';
const USOS_CONSUMER_SECRET = process.env.USOS_CONSUMER_SECRET || '';
const USOS_BASE_URL = (process.env.USOS_BASE_URL || 'https://usosapi.zut.edu.pl/').replace(/\/+$/, '') + '/';

const MZUT_API_BASE = 'https://www.zut.edu.pl/app-json-proxy/index.php';
const PLAN_STUDENT_BASE = 'https://plan.zut.edu.pl/schedule_student.php';
const PLAN_SUGGEST_BASE = 'https://plan.zut.edu.pl/schedule.php';
const RSS_URL = 'https://www.zut.edu.pl/rssfeed-studenci';
const REQUEST_TIMEOUT_MS = 20_000;
const APP_BASE_PATH = (() => {
  const raw = String(process.env.VITE_APP_BASE || '/v2').trim();
  if (!raw) return '/v2';
  const normalized = raw.startsWith('/') ? raw : `/${raw}`;
  return normalized.replace(/\/+$/, '') || '/';
})();
const STATS_ROUTE_PATH = APP_BASE_PATH === '/' ? '/stats' : `${APP_BASE_PATH}/stats`;
const STATS_STORE_PATH = path.join(__dirname, 'data', 'usage-stats.json');
const STATS_BASIC_USER = process.env.STATS_USER || 'Kejlo';
const STATS_BASIC_PASS = process.env.STATS_PASS || 'hx875875';

const unsafeAgent = new Agent({
  connect: { rejectUnauthorized: false },
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.set('trust proxy', 1);
app.use(rateLimit({ windowMs: 60_000, limit: 180, standardHeaders: true, legacyHeaders: false }));
app.use(express.json({ limit: '1mb' }));
app.use((req, _res, next) => {
  if (req.path.startsWith('/api/') && req.path !== '/api/health') {
    recordDeviceActivity(req);
  }
  next();
});

function sanitizeFunctionName(value) {
  const fn = String(value || '').trim();
  return /^[a-zA-Z0-9_]+$/.test(fn) ? fn : '';
}

function sanitizeParams(value) {
  if (!value || typeof value !== 'object') return {};
  const out = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!/^[a-zA-Z0-9_]+$/.test(key)) continue;
    out[key] = String(raw ?? '');
  }
  return out;
}

function formatDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeRequestAddress(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  const first = trimmed.split(',')[0].trim();
  const withoutPort = first.startsWith('[')
    ? first.replace(/^\[|\]$/g, '')
    : first.replace(/:\d+$/, '');
  return withoutPort.split('%')[0];
}

function extractRequestAddresses(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '')
    .split(',')
    .map((item) => normalizeRequestAddress(item))
    .filter(Boolean);
  const direct = [
    normalizeRequestAddress(req.ip),
    normalizeRequestAddress(req.socket?.remoteAddress),
  ].filter(Boolean);
  return [...new Set([...forwarded, ...direct])];
}

function safeTextEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function getStatsAuthState(req) {
  const authHeader = String(req.headers.authorization || '');
  if (!authHeader.startsWith('Basic ')) {
    return 'missing';
  }

  let decoded = '';
  try {
    decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
  } catch {
    return 'invalid';
  }

  const separatorIndex = decoded.indexOf(':');
  if (separatorIndex < 0) {
    return 'invalid';
  }

  const username = decoded.slice(0, separatorIndex);
  const password = decoded.slice(separatorIndex + 1);

  return safeTextEqual(username, STATS_BASIC_USER) && safeTextEqual(password, STATS_BASIC_PASS)
    ? 'valid'
    : 'invalid';
}

function sendStatsBasicAuthPrompt(res) {
  res.set('WWW-Authenticate', 'Basic realm="mZUT v2 stats", charset="UTF-8"');
  return res.status(401).type('text/plain').send('Authentication required');
}

function redirectToAppHome(res) {
  const destination = APP_BASE_PATH === '/' ? '/' : `${APP_BASE_PATH}/`;
  return res.redirect(destination);
}

function createEmptyStatsStore() {
  return {
    version: 1,
    devices: {},
    dailyActive: {},
    successfulLoginsTotal: 0,
    successfulLoginsByDay: {},
  };
}

function normalizeStatsStore(value) {
  if (!value || typeof value !== 'object') {
    return createEmptyStatsStore();
  }

  const payload = value;
  const devices = payload.devices && typeof payload.devices === 'object' ? payload.devices : {};
  const dailyActive = payload.dailyActive && typeof payload.dailyActive === 'object' ? payload.dailyActive : {};
  const successfulLoginsByDay = payload.successfulLoginsByDay && typeof payload.successfulLoginsByDay === 'object'
    ? payload.successfulLoginsByDay
    : {};

  const normalizedDailyActive = {};
  for (const [day, rawDevices] of Object.entries(dailyActive)) {
    if (!Array.isArray(rawDevices)) continue;
    normalizedDailyActive[day] = [...new Set(rawDevices.map((item) => String(item || '').trim()).filter(Boolean))];
  }

  const normalizedLoginsByDay = {};
  for (const [day, rawCount] of Object.entries(successfulLoginsByDay)) {
    const count = Number(rawCount);
    if (Number.isFinite(count) && count > 0) {
      normalizedLoginsByDay[day] = Math.round(count);
    }
  }

  return {
    version: 1,
    devices,
    dailyActive: normalizedDailyActive,
    successfulLoginsTotal: Number.isFinite(Number(payload.successfulLoginsTotal))
      ? Math.max(0, Math.round(Number(payload.successfulLoginsTotal)))
      : 0,
    successfulLoginsByDay: normalizedLoginsByDay,
  };
}

function loadStatsStore() {
  try {
    if (!existsSync(STATS_STORE_PATH)) {
      return createEmptyStatsStore();
    }

    const raw = readFileSync(STATS_STORE_PATH, 'utf8');
    if (!raw.trim()) {
      return createEmptyStatsStore();
    }

    return normalizeStatsStore(JSON.parse(raw));
  } catch {
    return createEmptyStatsStore();
  }
}

let statsStore = loadStatsStore();
let statsPersistTimer = null;

function persistStatsStore() {
  try {
    mkdirSync(path.dirname(STATS_STORE_PATH), { recursive: true });
    writeFileSync(STATS_STORE_PATH, JSON.stringify(statsStore, null, 2));
  } catch (error) {
    console.warn('Failed to persist local stats store', error);
  }
}

function scheduleStatsPersist() {
  if (statsPersistTimer) return;

  statsPersistTimer = setTimeout(() => {
    statsPersistTimer = null;
    persistStatsStore();
  }, 600);

  if (typeof statsPersistTimer.unref === 'function') {
    statsPersistTimer.unref();
  }
}

function pruneStatsBuckets() {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - 180);
  const cutoffKey = formatDayKey(cutoff);

  for (const day of Object.keys(statsStore.dailyActive)) {
    if (day < cutoffKey) {
      delete statsStore.dailyActive[day];
    }
  }

  for (const day of Object.keys(statsStore.successfulLoginsByDay)) {
    if (day < cutoffKey) {
      delete statsStore.successfulLoginsByDay[day];
    }
  }
}

function getRequestDeviceKey(req) {
  const explicitDeviceId = String(req.headers['x-mzut-device-id'] || '').trim();
  if (explicitDeviceId) {
    return `device:${crypto.createHash('sha1').update(explicitDeviceId).digest('hex')}`;
  }

  const address = extractRequestAddresses(req)[0] || 'unknown';
  const userAgent = String(req.headers['user-agent'] || 'unknown');
  return `legacy:${crypto.createHash('sha1').update(`${address}|${userAgent}`).digest('hex')}`;
}

function ensureTrackedDevice(req, nowIso = new Date().toISOString()) {
  const deviceKey = getRequestDeviceKey(req);
  if (!deviceKey) {
    return { deviceKey: '', record: null };
  }

  const current = statsStore.devices[deviceKey];
  const next = current && typeof current === 'object' ? { ...current } : {};
  next.firstSeenAt = typeof next.firstSeenAt === 'string' && next.firstSeenAt ? next.firstSeenAt : nowIso;
  next.lastSeenAt = nowIso;
  next.hitCount = Number.isFinite(Number(next.hitCount)) ? Number(next.hitCount) : 0;
  next.successfulLogins = Number.isFinite(Number(next.successfulLogins)) ? Number(next.successfulLogins) : 0;
  next.lastUserAgent = String(req.headers['user-agent'] || '').slice(0, 240);
  next.lastAddress = (extractRequestAddresses(req)[0] || '').slice(0, 120);
  statsStore.devices[deviceKey] = next;

  return { deviceKey, record: next };
}

function recordDeviceActivity(req) {
  pruneStatsBuckets();
  const dayKey = formatDayKey();
  const { deviceKey, record } = ensureTrackedDevice(req);
  if (!deviceKey || !record) return;

  record.hitCount += 1;
  const bucket = statsStore.dailyActive[dayKey] ?? [];
  if (!bucket.includes(deviceKey)) {
    bucket.push(deviceKey);
    statsStore.dailyActive[dayKey] = bucket;
  }

  scheduleStatsPersist();
}

function recordSuccessfulLogin(req, method) {
  pruneStatsBuckets();
  const dayKey = formatDayKey();
  const nowIso = new Date().toISOString();
  const { record } = ensureTrackedDevice(req, nowIso);

  if (record) {
    record.successfulLogins += 1;
    record.lastSuccessfulLoginAt = nowIso;
    record.lastSuccessfulLoginMethod = method;
  }

  statsStore.successfulLoginsTotal += 1;
  statsStore.successfulLoginsByDay[dayKey] = (statsStore.successfulLoginsByDay[dayKey] || 0) + 1;
  scheduleStatsPersist();
}

function getStatsSnapshot() {
  pruneStatsBuckets();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = formatDayKey(today);
  const chartDays = [];

  for (let offset = 13; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const key = formatDayKey(date);
    chartDays.push({
      key,
      label: `${key.slice(8, 10)}.${key.slice(5, 7)}`,
      activeDevices: (statsStore.dailyActive[key] || []).length,
    });
  }

  return {
    todayActiveDevices: (statsStore.dailyActive[todayKey] || []).length,
    totalDevices: Object.keys(statsStore.devices).length,
    successfulLoginsTotal: statsStore.successfulLoginsTotal,
    successfulLoginsToday: statsStore.successfulLoginsByDay[todayKey] || 0,
    chartDays,
    chartMax: Math.max(1, ...chartDays.map((day) => day.activeDevices)),
    updatedAt: new Intl.DateTimeFormat('pl-PL', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date()),
  };
}

function renderStatsPage() {
  const snapshot = getStatsSnapshot();
  const appHomePath = APP_BASE_PATH === '/' ? '/' : `${APP_BASE_PATH}/`;
  const chartHtml = snapshot.chartDays.map((day, index) => {
    const height = day.activeDevices <= 0
      ? 6
      : Math.max(10, Math.round((day.activeDevices / snapshot.chartMax) * 100));
    const isToday = index === snapshot.chartDays.length - 1;

    return `
      <div class="stats-bar-col">
        <div class="stats-bar-track">
          <div class="stats-bar${isToday ? ' is-today' : ''}" style="height:${height}%"></div>
        </div>
        <div class="stats-bar-value">${day.activeDevices}</div>
        <div class="stats-bar-label">${escapeHtml(day.label)}</div>
      </div>
    `;
  }).join('');

  return `<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <title>mZUT v2 • Statystyki</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #0d0f12;
      --panel: #15181c;
      --panel-soft: #1a1e23;
      --border: #252a31;
      --text: #f3f4f6;
      --muted: #a1a7b0;
      --accent: #7ab8ff;
      --accent-soft: rgba(122, 184, 255, 0.14);
      --shadow: 0 12px 32px rgba(0, 0, 0, 0.28);
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      font-family: "Segoe UI Variable", "Aptos", sans-serif;
      color: var(--text);
      background: var(--bg);
      padding: 24px 16px 36px;
    }

    .shell {
      max-width: 980px;
      margin: 0 auto;
      display: grid;
      gap: 16px;
    }

    .hero {
      padding: 20px;
      border-radius: 18px;
      border: 1px solid var(--border);
      background: var(--panel);
      box-shadow: var(--shadow);
    }

    .eyebrow {
      display: inline-flex;
      align-items: center;
      padding: 6px 10px;
      border-radius: 999px;
      background: var(--accent-soft);
      color: var(--accent);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    h1 {
      margin: 14px 0 6px;
      font-size: clamp(28px, 4vw, 40px);
      line-height: 1.05;
      letter-spacing: -0.03em;
    }

    .hero-copy {
      margin: 0;
      color: var(--muted);
      font-size: 14px;
      line-height: 1.5;
    }

    .hero-actions {
      margin-top: 16px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .btn,
    .btn:visited {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 40px;
      padding: 0 14px;
      border-radius: 12px;
      border: 1px solid var(--border);
      background: var(--panel-soft);
      color: var(--text);
      text-decoration: none;
      font-size: 13px;
      font-weight: 600;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }

    .card {
      padding: 20px;
      border-radius: 18px;
      border: 1px solid var(--border);
      background: var(--panel);
      box-shadow: var(--shadow);
    }

    .kpi-label {
      color: var(--muted);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .kpi-value {
      margin-top: 8px;
      font-size: clamp(30px, 4vw, 42px);
      line-height: 1;
      font-weight: 700;
      letter-spacing: -0.03em;
    }

    .kpi-note {
      margin-top: 8px;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.45;
    }

    .chart-card {
      padding: 20px;
    }

    .chart-head {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: flex-end;
      margin-bottom: 14px;
    }

    .chart-title {
      margin: 0;
      font-size: clamp(20px, 3vw, 28px);
      line-height: 1.1;
      letter-spacing: -0.03em;
    }

    .chart-subtitle {
      margin: 6px 0 0;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.45;
    }

    .chart-meta {
      color: var(--muted);
      font-size: 12px;
      text-align: right;
      line-height: 1.4;
    }

    .stats-chart {
      display: grid;
      grid-template-columns: repeat(14, minmax(0, 1fr));
      gap: 8px;
      min-height: 220px;
      align-items: end;
    }

    .stats-bar-col {
      display: grid;
      gap: 6px;
      align-items: end;
      justify-items: center;
    }

    .stats-bar-value {
      font-size: 11px;
      font-weight: 600;
      color: var(--muted);
      min-height: 14px;
    }

    .stats-bar-track {
      width: 100%;
      height: 160px;
      border-radius: 999px;
      background: #101318;
      display: flex;
      align-items: flex-end;
      padding: 4px;
      overflow: hidden;
    }

    .stats-bar {
      width: 100%;
      border-radius: 999px;
      background: #4f8fdd;
    }

    .stats-bar.is-today {
      background: #7ab8ff;
    }

    .stats-bar-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--muted);
    }

    .footnote {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.5;
      padding: 0 2px;
    }

    @media (max-width: 900px) {
      body { padding: 16px; }
      .grid { grid-template-columns: 1fr; }
      .chart-head {
        align-items: flex-start;
        flex-direction: column;
      }
      .chart-meta { text-align: left; }
      .stats-chart {
        gap: 6px;
        min-height: 200px;
      }
      .stats-bar-track {
        height: 130px;
        padding: 4px;
      }
      .hero,
      .card {
        border-radius: 16px;
      }
    }
  </style>
</head>
<body>
  <main class="shell">
    <section class="hero">
      <div class="eyebrow">Stats</div>
      <h1>Statystyki mZUT v2</h1>
      <p class="hero-copy">
        Prosty podgląd aktywnych urządzeń, łącznej liczby urządzeń i poprawnych logowań.
        Dostęp jest chroniony przeglądarkowym oknem logowania.
      </p>
      <div class="hero-actions">
        <button type="button" class="btn" onclick="window.location.reload()">Odśwież</button>
        <a class="btn" href="${escapeHtml(appHomePath)}">Powrót do aplikacji</a>
      </div>
    </section>

    <section class="grid">
      <article class="card">
        <div class="kpi-label">Aktywne urządzenia dziś</div>
        <div class="kpi-value">${snapshot.todayActiveDevices}</div>
        <div class="kpi-note">Unikalne urządzenia widziane dzisiaj przez API.</div>
      </article>

      <article class="card">
        <div class="kpi-label">Łączna liczba urządzeń</div>
        <div class="kpi-value">${snapshot.totalDevices}</div>
        <div class="kpi-note">Wszystkie zapisane urządzenia od startu zbierania danych.</div>
      </article>

      <article class="card">
        <div class="kpi-label">Poprawne logowania</div>
        <div class="kpi-value">${snapshot.successfulLoginsTotal}</div>
        <div class="kpi-note">Dziś: ${snapshot.successfulLoginsToday}</div>
      </article>
    </section>

    <section class="card chart-card">
      <div class="chart-head">
        <div>
          <h2 class="chart-title">Aktywne urządzenia z ostatnich 14 dni</h2>
          <p class="chart-subtitle">Ostatni słupek oznacza bieżący dzień.</p>
        </div>
        <div class="chart-meta">
          Ostatnia aktualizacja<br />
          <strong>${escapeHtml(snapshot.updatedAt)}</strong>
        </div>
      </div>
      <div class="stats-chart">${chartHtml}</div>
    </section>

    <div class="footnote">
      Dane są zapisywane lokalnie na serwerze w pliku JSON.
    </div>
  </main>
</body>
</html>`;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      dispatcher: unsafeAgent,
      signal: controller.signal,
      ...options,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function passthroughJson(response) {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Niepoprawny JSON z upstream');
  }
}

// ── USOS OAuth 1.0a Signing ────────────────────────────────────────────────

function pct(s) {
  if (!s) return '';
  return encodeURIComponent(String(s))
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%20/g, '+') // Simple OAuth 1.0 implementation often uses + for space, but RFC 3986 says %20.
    // However, the Android implementation used .replace("+", "%20"), so it wants %20.
    .replace(/\+/g, '%20')
    .replace(/%7E/g, '~');
}

function signOAuth1(method, baseUrl, params, consumerSecret, tokenSecret = '') {
  // Sort and join params
  const sortedPairs = Object.entries(params)
    .map(([k, v]) => `${pct(k)}=${pct(v)}`)
    .sort()
    .join('&');

  const sigBase = [
    method.toUpperCase(),
    pct(baseUrl),
    pct(sortedPairs)
  ].join('&');

  const signingKey = [
    pct(consumerSecret),
    pct(tokenSecret)
  ].join('&');

  return crypto
    .createHmac('sha1', signingKey)
    .update(sigBase)
    .digest('base64');
}

function getAuthHeader(oauthParams, signature) {
  const parts = Object.entries(oauthParams)
    .map(([k, v]) => `${pct(k)}="${pct(v)}"`)
    .sort();
  parts.push(`oauth_signature="${pct(signature)}"`);
  return `OAuth ${parts.join(', ')}`;
}

function baseOAuthParams() {
  return {
    oauth_consumer_key: USOS_CONSUMER_KEY,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: '1.0'
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, timestamp: Date.now() });
});

app.post('/api/proxy/mzut', async (req, res) => {
  try {
    const fn = sanitizeFunctionName(req.body?.fn);
    const params = sanitizeParams(req.body?.params);

    if (!fn) {
      return res.status(400).json({ error: 'Brak poprawnej funkcji mZUT' });
    }

    const url = `${MZUT_API_BASE}?f=${encodeURIComponent(fn)}`;
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      body.set(key, value);
    }

    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'User-Agent': 'mZUT-PWA-Proxy/1.0',
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
      },
      body,
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Upstream mZUT HTTP ${response.status}` });
    }

    const data = await passthroughJson(response);
    const status = String(data?.logInStatus || data?.loginInStatus || '').trim().toUpperCase();
    if (fn === 'getAuthorization' && status === 'OK') {
      recordSuccessfulLogin(req, 'mzut');
    }
    return res.json({ data });
  } catch (error) {
    return res.status(502).json({ error: `Proxy mZUT error: ${error.message}` });
  }
});

app.get('/api/proxy/plan-student', async (req, res) => {
  try {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query ?? {})) {
      if (!/^[a-zA-Z0-9_]+$/.test(key)) continue;
      query.set(key, String(value ?? ''));
    }

    const url = `${PLAN_STUDENT_BASE}?${query.toString()}`;
    const response = await fetchWithTimeout(url, {
      headers: { 'User-Agent': 'mZUT-PWA-Proxy/1.0' },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Upstream plan HTTP ${response.status}` });
    }

    const data = await passthroughJson(response);
    return res.json({ data });
  } catch (error) {
    return res.status(502).json({ error: `Proxy plan error: ${error.message}` });
  }
});

app.get('/api/proxy/plan-suggest', async (req, res) => {
  try {
    const kind = String(req.query.kind ?? '').trim();
    const query = String(req.query.query ?? '').trim();
    if (!kind || !query) {
      return res.json({ data: [] });
    }

    const url = `${PLAN_SUGGEST_BASE}?kind=${encodeURIComponent(kind)}&query=${encodeURIComponent(query)}`;
    const response = await fetchWithTimeout(url, {
      headers: { 'User-Agent': 'mZUT-PWA-Proxy/1.0' },
    });

    if (!response.ok) {
      return res.json({ data: [] });
    }

    const data = await passthroughJson(response);
    return res.json({ data: Array.isArray(data) ? data : [] });
  } catch {
    return res.json({ data: [] });
  }
});

app.get('/api/proxy/image', async (req, res) => {
  try {
    const userId = String(req.query.userId ?? '').trim();
    const tokenJpg = String(req.query.tokenJpg ?? '').trim();
    if (!userId || !tokenJpg) {
      return res.status(400).json({ error: 'Missing userId or tokenJpg' });
    }

    const url = `https://www.zut.edu.pl/app-json-proxy/image/?userId=${encodeURIComponent(userId)}&tokenJpg=${encodeURIComponent(tokenJpg)}`;
    const response = await fetchWithTimeout(url, {
      headers: { 'User-Agent': 'mZUTv2-PWA-Proxy/1.0' },
    });

    if (!response.ok) {
      return res.status(response.status).end();
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    if (buffer.length === 0) {
      return res.status(404).end();
    }

    // ZUT returns JPEG with wrong Content-Type (text/html), detect from magic bytes
    let contentType = 'image/jpeg';
    if (buffer[0] === 0x89 && buffer[1] === 0x50) contentType = 'image/png';
    else if (buffer[0] === 0x47 && buffer[1] === 0x49) contentType = 'image/gif';
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=86400');
    return res.send(buffer);
  } catch (error) {
    return res.status(502).json({ error: `Image proxy error: ${error.message}` });
  }
});

app.get('/api/usos/image', async (req, res) => {
  try {
    const url = String(req.query.url ?? '').trim();
    if (!url || !url.includes('zut.edu.pl')) {
      return res.status(400).json({ error: 'Invalid USOS image URL' });
    }

    const response = await fetchWithTimeout(url, {
      headers: { 'User-Agent': 'mZUTv2-PWA-Proxy/1.0' },
    });

    if (!response.ok) {
      return res.status(response.status).end();
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0) {
      return res.status(404).end();
    }

    let contentType = 'image/jpeg';
    if (buffer[0] === 0x89 && buffer[1] === 0x50) contentType = 'image/png';
    else if (buffer[0] === 0x47 && buffer[1] === 0x49) contentType = 'image/gif';
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=86400');
    return res.send(buffer);
  } catch (error) {
    return res.status(502).end();
  }
});

// ── USOS API Endpoints ──────────────────────────────────────────────────────

app.get('/api/usos/request-token', async (req, res) => {
  try {
    const scopes = String(req.query.scopes || 'studies|grades|personal|photo|email|mobile_numbers|payments|cards');
    const callbackUrl = String(req.query.callbackUrl || '');

    const url = `${USOS_BASE_URL}services/oauth/request_token`;
    const oauthParams = {
      ...baseOAuthParams(),
      oauth_callback: callbackUrl
    };

    const allParams = { ...oauthParams, scopes };
    const sig = signOAuth1('POST', url, allParams, USOS_CONSUMER_SECRET);
    const authHeader = getAuthHeader(oauthParams, sig);

    const body = new URLSearchParams();
    body.set('scopes', scopes);

    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'User-Agent': 'mZUT-PWA-Proxy/1.0',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    });

    const text = await response.text();
    if (!response.ok) {
      return res.status(response.status).json({ error: `USOS Request Token error: ${text}` });
    }

    const result = Object.fromEntries(new URLSearchParams(text));
    recordSuccessfulLogin(req, 'usos');
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/usos/access-token', async (req, res) => {
  try {
    const { oauth_token, oauth_token_secret, oauth_verifier } = req.body;
    if (!oauth_token || !oauth_token_secret || !oauth_verifier) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    const url = `${USOS_BASE_URL}services/oauth/access_token`;
    const oauthParams = {
      ...baseOAuthParams(),
      oauth_token,
      oauth_verifier
    };

    const sig = signOAuth1('POST', url, oauthParams, USOS_CONSUMER_SECRET, oauth_token_secret);
    const authHeader = getAuthHeader(oauthParams, sig);

    const body = new URLSearchParams();
    body.set('oauth_verifier', oauth_verifier);

    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'User-Agent': 'mZUT-PWA-Proxy/1.0',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    });

    const text = await response.text();
    if (!response.ok) {
      return res.status(response.status).json({ error: `USOS Access Token error: ${text}` });
    }

    const result = Object.fromEntries(new URLSearchParams(text));
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/usos/proxy', async (req, res) => {
  try {
    const { endpoint, token, secret, params = {} } = req.body;
    if (!endpoint || !token || !secret) {
      return res.status(400).json({ error: 'Missing endpoint or credentials' });
    }

    const baseUrl = `${USOS_BASE_URL}${endpoint.startsWith('/') ? endpoint.slice(1) : endpoint}`;

    const oauthParams = {
      ...baseOAuthParams(),
      oauth_token: token
    };

    const allForSig = { ...oauthParams, ...params };
    const sig = signOAuth1('GET', baseUrl, allForSig, USOS_CONSUMER_SECRET, secret);
    const authHeader = getAuthHeader(oauthParams, sig);

    // USOS quirk: query parameters should NOT be percent encoded for commas etc.
    // but the parameters in the signature base string SHOULD be.
    // fetch URL builder will encode them, so we build it manually or use a trick.
    let fullUrl = baseUrl;
    if (Object.keys(params).length > 0) {
      const query = Object.entries(params)
        .map(([k, v]) => `${k}=${v}`) // No encoding here, just like in Android buildUrl()
        .join('&');
      fullUrl += `?${query}`;
    }

    const response = await fetchWithTimeout(fullUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'User-Agent': 'mZUT-PWA-Proxy/1.0'
      }
    });

    const body = await response.text();
    if (!response.ok) {
      return res.status(response.status).json({ error: `USOS API error: ${body}` });
    }

    try {
      return res.json(JSON.parse(body));
    } catch {
      return res.send(body);
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// ── Academic calendar (session periods) ─────────────────────────────────────
const CALENDAR_URLS = (() => {
  const year = new Date().getFullYear();
  return [
    'https://www.zut.edu.pl/zut-studenci/organizacja-roku-akademickiego.html',
    `https://www.zut.edu.pl/zut-studenci/organizacja-roku-akademickiego-${year}${year + 1}.html`,
    `https://www.zut.edu.pl/zut-studenci/organizacja-roku-akademickiego-${year - 1}${year}.html`,
    `https://www.zut.edu.pl/zut-studenci/organizacja-roku-akademickiego-${year + 1}${year + 2}.html`,
  ];
})();

const CALENDAR_PERIODS = [
  { key: 'sesja_zimowa', pattern: /sesja\s+zimowa/i },
  { key: 'sesja_letnia', pattern: /sesja\s+letnia/i },
  { key: 'sesja_poprawkowa', pattern: /sesja\s+poprawkowa/i },
  { key: 'przerwa_dydaktyczna_zimowa', pattern: /przerwa\s+od\s+zaj[eęE]\w*\s+dydaktycznych\s+w\s+semestrze\s+zimowym/i },
  { key: 'przerwa_dydaktyczna_letnia', pattern: /przerwa\s+od\s+zaj[eęE]\w*\s+dydaktycznych\s+w\s+semestrze\s+letnim/i },
  { key: 'przerwa_dydaktyczna', pattern: /przerwa\s+od\s+zaj[eęE]\w*\s+dydaktycznych/i },
  { key: 'wakacje_zimowe', pattern: /(wakacje|ferie)\s+zimowe/i },
  { key: 'wakacje_letnie', pattern: /wakacje\s+letnie/i },
];

function stripHtmlTags(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ');
}

function parseCalendarHtml(html) {
  const text = stripHtmlTags(html);
  const dateRe = /(\d{2})\.(\d{2})\.(\d{4})/g;
  const results = [];
  const seen = new Set();

  // Check if specific break found (to avoid adding generic one if specific exists)
  let hasSpecificBreak = false;

  for (const period of CALENDAR_PERIODS) {
    const matches = [];
    let idx = 0;
    let m;
    // Reset lastIndex if using global
    const re = new RegExp(period.pattern.source, 'gi');
    while ((m = re.exec(text)) !== null) {
      // Find next two dates after this match
      const after = text.slice(m.index + m[0].length, m.index + m[0].length + 120);
      const dates = [...after.matchAll(/(\d{2})\.(\d{2})\.(\d{4})/g)];
      if (dates.length >= 2) {
        const start = `${dates[0][3]}-${dates[0][2]}-${dates[0][1]}`;
        const end = `${dates[1][3]}-${dates[1][2]}-${dates[1][1]}`;
        if (start <= end) {
          const dedup = `${period.key}|${start}|${end}`;
          if (!seen.has(dedup)) {
            seen.add(dedup);
            results.push({ key: period.key, start, end });
            if (period.key.startsWith('przerwa_dydaktyczna_') && period.key !== 'przerwa_dydaktyczna') {
              hasSpecificBreak = true;
            }
          }
        }
      }
    }
  }

  // Remove generic break if specific ones found
  const filtered = hasSpecificBreak
    ? results.filter(r => r.key !== 'przerwa_dydaktyczna')
    : results;

  return filtered.sort((a, b) => a.start.localeCompare(b.start));
}

let calendarCache = null;
let calendarCacheTs = 0;
const CALENDAR_CACHE_TTL = 6 * 60 * 60 * 1000; // 6h

app.get('/api/proxy/calendar', async (_req, res) => {
  try {
    const now = Date.now();
    if (calendarCache && (now - calendarCacheTs) < CALENDAR_CACHE_TTL) {
      return res.json({ periods: calendarCache });
    }

    for (const url of CALENDAR_URLS) {
      try {
        const response = await fetchWithTimeout(url, {
          headers: { 'User-Agent': 'mZUT-PWA-Proxy/1.0' },
        });
        if (!response.ok) continue;
        const html = await response.text();
        if (!html) continue;
        const periods = parseCalendarHtml(html);
        if (periods.length > 0) {
          calendarCache = periods;
          calendarCacheTs = now;
          return res.json({ periods });
        }
      } catch { /* try next URL */ }
    }

    return res.json({ periods: calendarCache ?? [] });
  } catch (error) {
    return res.status(502).json({ error: `Calendar proxy error: ${error.message}`, periods: [] });
  }
});

app.get('/api/proxy/rss', async (_req, res) => {
  try {
    const response = await fetchWithTimeout(RSS_URL, {
      headers: { 'User-Agent': 'mZUT-PWA-Proxy/1.0' },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Upstream RSS HTTP ${response.status}` });
    }

    const xml = await response.text();
    return res.json({ xml });
  } catch (error) {
    return res.status(502).json({ error: `Proxy RSS error: ${error.message}` });
  }
});

app.get([STATS_ROUTE_PATH, `${STATS_ROUTE_PATH}/`], (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  const authState = getStatsAuthState(req);
  if (authState === 'missing') {
    return sendStatsBasicAuthPrompt(res);
  }
  if (authState === 'invalid') {
    return redirectToAppHome(res);
  }

  return res.type('html').send(renderStatsPage());
});

const distPath = path.resolve(process.cwd(), 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (req.path.startsWith('/api/')) return next();
    return res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(port, () => {
  console.log(`mzut-v2-pwa proxy listening on http://localhost:${port}`);
});
