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
