import type { Grade, SessionData, ViewMode } from '../types';

export function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDaysYmd(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fmtDateLabel(v: string, lang: string = 'pl'): string {
  const d = new Date(`${v}T00:00:00`);
  if (!Number.isFinite(d.getTime())) return v;
  const loc = lang === 'en' ? 'en-US' : 'pl-PL';
  return new Intl.DateTimeFormat(loc, { day: '2-digit', month: '2-digit', weekday: 'short' }).format(d);
}

export function fmtWeekdayShort(v: string, lang: string = 'pl'): string {
  const d = new Date(`${v}T00:00:00`);
  if (!Number.isFinite(d.getTime())) return v;
  const loc = lang === 'en' ? 'en-US' : 'pl-PL';
  return new Intl.DateTimeFormat(loc, { weekday: 'short' }).format(d);
}

export function fmtDayMonth(v: string, lang: string = 'pl'): string {
  const d = new Date(`${v}T00:00:00`);
  if (!Number.isFinite(d.getTime())) return v;
  const loc = lang === 'en' ? 'en-US' : 'pl-PL';
  return new Intl.DateTimeFormat(loc, { day: '2-digit', month: '2-digit' }).format(d);
}

export function fmtHour(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

export function isWeekendDate(dateYmd: string): boolean {
  const d = new Date(`${dateYmd}T00:00:00`);
  if (!Number.isFinite(d.getTime())) return false;
  const day = d.getDay();
  return day === 0 || day === 6;
}

function normalizeMatch(value: string): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const PLAN_TEACHER_TITLE_TOKENS = new Set([
  'prof',
  'profesor',
  'dr',
  'doktor',
  'hab',
  'habilitowany',
  'inz',
  'inż',
  'mgr',
  'magister',
  'lic',
  'licencjat',
  'doc',
  'docent',
  'lek',
  'med',
]);

function normalizeTeacherToken(token: string): string {
  return normalizeMatch(token).replace(/[^a-z-]/g, '');
}

export function toPlanTeacherSearchQuery(value: string): string {
  const tokens = String(value || '')
    .replace(/[(),]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) return '';

  const filtered = tokens.filter((token) => {
    const normalized = normalizeTeacherToken(token);
    return normalized && !PLAN_TEACHER_TITLE_TOKENS.has(normalized);
  });

  if (filtered.length === 0) return '';

  const uppercaseNameTokens = filtered.filter((token) => {
    const cleaned = token.replace(/[.,]/g, '');
    return cleaned.length > 0 && cleaned === cleaned.toUpperCase();
  });

  const source = uppercaseNameTokens.length >= 2
    ? uppercaseNameTokens.map((token) => token.replace(/[.,]/g, ''))
    : filtered.map((token) => token.replace(/[.,]/g, '').toUpperCase());

  if (source.length < 2) return source.join(' ');
  return [...source.slice(1), source[0]].join(' ');
}

export function isFinalGradeType(type: string, subjectName?: string): boolean {
  const t = normalizeMatch(type);
  if (
    t.includes('ocena koncowa') ||
    t.includes('koncowa') ||
    t.includes('final') ||
    t.includes('abschluss')
  ) {
    return true;
  }
  if (!t) {
    const s = normalizeMatch(subjectName || '');
    return (
      s.includes('ocena koncowa') ||
      s.includes('koncowa') ||
      s.includes('final') ||
      s.includes('abschluss')
    );
  }
  return false;
}

export function getSessionSignature(session: SessionData | null): string {
  if (!session) return '';
  return [
    session.userId,
    session.authKey,
    session.usos?.accessToken ?? '',
    session.usos?.accessTokenSecret ?? '',
  ].join('|');
}

export function gradeTone(g: string): 'ok' | 'warn' | 'bad' | 'neutral' {
  const normalized = g.trim().toLowerCase();
  if (normalized === '-' || normalized === '') return 'neutral';
  if (normalized === 'zal' || normalized === 'zaliczone') return 'ok';
  if (normalized === 'niezal' || normalized === 'niezaliczone') return 'bad';

  const v = Number.parseFloat(g.replace(',', '.'));
  if (!Number.isFinite(v)) return 'neutral';
  if (v > 2) return 'ok';
  return 'bad';
}

export function parseGradeNum(g: string): number | null {
  const v = Number.parseFloat(g.replace(',', '.'));
  return Number.isFinite(v) ? v : null;
}

export function fmtDec(v: number, d: number): string {
  if (!Number.isFinite(v)) return '-';
  return v.toFixed(d).replace('.', ',');
}

export function initials(name: string): string {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return 'S';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function planCacheKey(viewMode: ViewMode, date: string, studyId: string | null | undefined): string {
  return `${viewMode}_${date}_${studyId ?? 'nostudy'}`;
}

export function sumUniqueEcts(items: Grade[]): number {
  if (!items.length) return 0;

  let sumFinal = 0;
  let hasFinal = false;

  for (const g of items) {
    if (!isFinalGradeType(g.type, g.subjectName)) continue;
    hasFinal = true;
    if (Number.isFinite(g.weight) && g.weight > 0) {
      sumFinal += g.weight;
    }
  }

  if (hasFinal) return sumFinal;

  let sumAll = 0;
  for (const g of items) {
    if (Number.isFinite(g.weight) && g.weight > 0) {
      sumAll += g.weight;
    }
  }
  return sumAll;
}
