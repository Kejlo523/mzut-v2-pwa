import path from 'node:path';
import { existsSync } from 'node:fs';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Agent } from 'undici';

const app = express();
const port = Number(process.env.PORT || 8787);

const MZUT_API_BASE = 'https://www.zut.edu.pl/app-json-proxy/index.php';
const PLAN_STUDENT_BASE = 'https://plan.zut.edu.pl/schedule_student.php';
const PLAN_SUGGEST_BASE = 'https://plan.zut.edu.pl/schedule.php';
const RSS_URL = 'https://www.zut.edu.pl/rssfeed-studenci';
const REQUEST_TIMEOUT_MS = 20_000;

const unsafeAgent = new Agent({
  connect: { rejectUnauthorized: false },
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.set('trust proxy', 1);
app.use(rateLimit({ windowMs: 60_000, limit: 180, standardHeaders: true, legacyHeaders: false }));
app.use(express.json({ limit: '1mb' }));

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
  { key: 'sesja_zimowa',               pattern: /sesja\s+zimowa/i },
  { key: 'sesja_letnia',               pattern: /sesja\s+letnia/i },
  { key: 'sesja_poprawkowa',           pattern: /sesja\s+poprawkowa/i },
  { key: 'przerwa_dydaktyczna_zimowa', pattern: /przerwa\s+od\s+zaj[eęE]\w*\s+dydaktycznych\s+w\s+semestrze\s+zimowym/i },
  { key: 'przerwa_dydaktyczna_letnia', pattern: /przerwa\s+od\s+zaj[eęE]\w*\s+dydaktycznych\s+w\s+semestrze\s+letnim/i },
  { key: 'przerwa_dydaktyczna',        pattern: /przerwa\s+od\s+zaj[eęE]\w*\s+dydaktycznych/i },
  { key: 'wakacje_zimowe',             pattern: /(wakacje|ferie)\s+zimowe/i },
  { key: 'wakacje_letnie',             pattern: /wakacje\s+letnie/i },
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
        const end   = `${dates[1][3]}-${dates[1][2]}-${dates[1][1]}`;
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
