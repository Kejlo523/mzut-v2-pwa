import type {
  Grade,
  NewsItem,
  PlanResult,
  SessionData,
  Semester,
  Study,
  StudyDetails,
  StudyHistoryItem,
  ViewMode,
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';
const CARR = [...'23456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'];
const CARR2 = [...'vwxyz23456789ABCDEFGHJKkmnopqrstuvwxyzabcdefghijWXYZLMNPQRSTUV'];

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return '';
}

function ensureArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value === null || value === undefined) return [];
  return [value as T];
}

function normalizeLoginIdentifier(rawLogin: string): string {
  const trimmed = rawLogin.trim();
  const at = trimmed.indexOf('@');
  return at >= 0 ? trimmed.slice(0, at).trim() : trimmed;
}

function fixImageUrls(html: string): string {
  return html.replace(/<img([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi, (_match, before, src, after) => {
    let fixedSrc = src;
    if (!fixedSrc.startsWith('http') && !fixedSrc.startsWith('data:')) {
      if (fixedSrc.startsWith('/')) {
        fixedSrc = `https://www.zut.edu.pl${fixedSrc}`;
      } else {
        fixedSrc = `https://www.zut.edu.pl/${fixedSrc}`;
      }
    }
    // Use image proxy to avoid CORS issues - rewrite zut.edu.pl URLs through /image-proxy/
    if (fixedSrc.includes('zut.edu.pl')) {
      fixedSrc = fixedSrc.replace('https://www.zut.edu.pl/', '/image-proxy/').replace('https://www.zut.edu.pl', '/image-proxy/');
    }
    return `<img${before}src="${fixedSrc}"${after}>`;
  });
}

function randomString(length: number, alphabet: string[]): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join('');
}

function generateToken(login: string, password: string): string {
  const base = randomString(32, CARR);
  if (!password) return base;

  const now = new Date();
  const dayOfMonth = now.getDate();
  const dayOfWeek = now.getDay() + 1;
  const dayOfWeekInMonth = Math.floor((dayOfMonth - 1) / 7) + 1;
  const len = `${login}${password}`.length;

  let indexes = [len - 1, len - 5, len - 8, dayOfMonth, dayOfWeek, dayOfWeekInMonth];
  let alphabet = CARR;

  if (indexes.reduce((acc, n) => acc + n, 0) % 2 === 0) {
    indexes = [dayOfMonth, len + 3, len + 9, dayOfWeek, len, dayOfWeekInMonth];
    alphabet = CARR2;
  }

  return [...base]
    .map((ch, index) => {
      if (indexes.includes(index) && index >= 0 && index <= 32 && index < alphabet.length) {
        return alphabet[index];
      }
      return ch;
    })
    .join('');
}

async function proxyMzut<T = Record<string, unknown>>(fn: string, params: Record<string, string>): Promise<T> {
  const response = await fetch(`${API_BASE}/proxy/mzut`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fn, params }),
  });

  const body = (await response.json().catch(() => ({}))) as { data: T; error: string };
  if (!response.ok) {
    throw new Error(body.error || `mZUT proxy HTTP ${response.status}`);
  }
  return body.data ?? ({} as T);
}

async function proxyPlanStudent(query: Record<string, string>): Promise<Record<string, unknown>[]> {
  const url = new URL(`${API_BASE}/proxy/plan-student`, window.location.origin);
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(`${url.pathname}${url.search}`);
  const body = (await response.json().catch(() => ({}))) as { data: Record<string, unknown>[]; error: string };
  if (!response.ok) {
    throw new Error(body.error || `Plan proxy HTTP ${response.status}`);
  }
  return Array.isArray(body.data) ? body.data : [];
}

async function proxyRssXml(): Promise<string> {
  const response = await fetch(`${API_BASE}/proxy/rss`);
  const body = (await response.json().catch(() => ({}))) as { xml: string; error: string };
  if (!response.ok) {
    throw new Error(body.error || `RSS proxy HTTP ${response.status}`);
  }
  return body.xml || '';
}

function normalizeStudyId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function parseFlexibleDouble(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.trim().replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function parseEcts(row: Record<string, unknown>): number {
  const direct = parseFlexibleDouble(row.ects);
  if (direct > 0) return direct;
  for (const key of ['ectsO', 'ECTS', 'punktyEcts', 'punkty_ects', 'punktyEctsO']) {
    const value = parseFlexibleDouble(row[key]);
    if (value > 0) return value;
  }
  return 0;
}

export async function login(loginValue: string, password: string): Promise<SessionData> {
  const login = normalizeLoginIdentifier(loginValue);
  const cleanPassword = password.trim();
  if (!login || !cleanPassword) {
    throw new Error('Wpisz login i hasło.');
  }

  const token = generateToken(login, cleanPassword);
  const tokenJpg = generateToken(login, '');

  const payload = await proxyMzut<Record<string, unknown>>('getAuthorization', {
    login,
    password: cleanPassword,
    token,
    tokenJpg,
  });

  const status = firstNonEmpty(payload.logInStatus, payload.loginInStatus).toUpperCase();
  if (status !== 'OK') {
    if (status === 'SYSTEM ERROR') throw new Error('Błąd systemu mZUT.');
    throw new Error('Niepoprawny login lub hasło.');
  }

  const userId = firstNonEmpty(payload.login, login);
  const username = firstNonEmpty(`${firstNonEmpty(payload.pierwszeImie)} ${firstNonEmpty(payload.nazwisko)}`.trim(), userId);
  const authKey = firstNonEmpty(payload.token, token);
  const tokenJpgFromApi = firstNonEmpty(payload.tokenJpg, tokenJpg);

  return {
    userId,
    username,
    authKey,
    imageUrl: `https://www.zut.edu.pl/app-json-proxy/image/userId=${encodeURIComponent(userId)}&tokenJpg=${encodeURIComponent(tokenJpgFromApi)}`,
    activeStudyId: null,
  };
}

export async function fetchStudies(session: SessionData): Promise<Study[]> {
  const payload = await proxyMzut<Record<string, unknown>>('getMenuStudent', {
    login: session.userId,
    token: session.authKey,
  });

  return ensureArray<Record<string, unknown>>(payload.Menu)
    .map((row) => {
      const przynaleznoscId = normalizeStudyId(row.przynaleznoscId);
      const nazwa = firstNonEmpty(row.nazwa);
      const poziom = firstNonEmpty(row.poziom);
      const label = poziom ? `${nazwa} (${poziom})` : nazwa;
      return {
        przynaleznoscId: przynaleznoscId ?? '',
        label: label || przynaleznoscId || 'Kierunek',
      };
    })
    .filter((study) => study.przynaleznoscId);
}

export async function fetchSemesters(session: SessionData, studyId: string | null): Promise<Semester[]> {
  const resolvedStudyId = studyId || session.activeStudyId;
  if (!resolvedStudyId) return [];

  const payload = await proxyMzut<Record<string, unknown>>('getStudies', {
    login: session.userId,
    token: session.authKey,
    przynaleznoscId: resolvedStudyId,
    oceny: 'true',
  });

  return ensureArray<Record<string, unknown>>(payload.Przebieg)
    .map((row) => ({
      listaSemestrowId: firstNonEmpty(row.listaSemestrowId),
      nrSemestru: firstNonEmpty(row.nrSemestru),
      pora: firstNonEmpty(row.pora),
      rokAkademicki: firstNonEmpty(row.rokAkademicki),
      status: firstNonEmpty(row.status, row.statusO),
    }))
    .filter((semester) => semester.listaSemestrowId);
}

export async function fetchGrades(session: SessionData, semesterId: string): Promise<Grade[]> {
  if (!semesterId) return [];
  const payload = await proxyMzut<Record<string, unknown>>('getGrade', {
    login: session.userId,
    token: session.authKey,
    listaSemestrowId: semesterId,
  });

  return ensureArray<Record<string, unknown>>(payload.Ocena).map((row) => {
    const subject = firstNonEmpty(row.przedmiot, row.przedmiotO);
    const form = firstNonEmpty(row.formaZajec, row.formaZajecO);
    const term = firstNonEmpty(row.termin, row.terminO);
    const date = firstNonEmpty(row.data);

    return {
      subjectName: subject,
      grade: firstNonEmpty(row.ocena),
      weight: parseEcts(row),
      type: form,
      teacher: firstNonEmpty(row.pracownik),
      date: firstNonEmpty(`${term} ${date}`.trim(), date, term),
    };
  });
}

export async function fetchInfo(
  session: SessionData,
  studyId: string | null,
): Promise<{ details: StudyDetails | null; history: StudyHistoryItem[] }> {
  const resolvedStudyId = studyId || session.activeStudyId;
  if (!resolvedStudyId) {
    return { details: null, history: [] };
  }

  const [study, studies] = await Promise.all([
    proxyMzut<Record<string, unknown>>('getStudy', {
      login: session.userId,
      token: session.authKey,
      przynaleznoscId: resolvedStudyId,
    }),
    proxyMzut<Record<string, unknown>>('getStudies', {
      login: session.userId,
      token: session.authKey,
      przynaleznoscId: resolvedStudyId,
      oceny: 'true',
    }),
  ]);

  const details: StudyDetails = {
    album: firstNonEmpty(study.album),
    wydzial: firstNonEmpty(study.wydzial, study.wydzialAng),
    kierunek: firstNonEmpty(study.kierunek, study.kierunekAng),
    forma: firstNonEmpty(study.forma, study.formaAng),
    poziom: firstNonEmpty(study.poziom, study.poziomAng),
    specjalnosc: firstNonEmpty(study.specjalnosc, study.specjalnoscO),
    specjalizacja: firstNonEmpty(study.specjalizacja, study.specjalizacjaO),
    status: firstNonEmpty(study.status, study.statusAng),
    rokAkademicki: firstNonEmpty(study.rokAkademicki),
    semestrLabel: firstNonEmpty(`${firstNonEmpty(study.nrSemestru)} ${firstNonEmpty(study.pora)}`.trim()),
  };

  const history = ensureArray<Record<string, unknown>>(studies.Przebieg).map((row) => ({
    label: `${firstNonEmpty(row.nrSemestru)} ${firstNonEmpty(row.pora)} - ${firstNonEmpty(row.rokAkademicki)}`.trim(),
    status: firstNonEmpty(row.status, row.statusO),
  }));

  return { details, history };
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const copy = startOfDay(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function parseYmdOrToday(value: string): Date {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isFinite(parsed.getTime()) ? startOfDay(parsed) : startOfDay(new Date());
}

function formatYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toOffsetIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  const oh = String(Math.floor(abs / 60)).padStart(2, '0');
  const om = String(abs % 60).padStart(2, '0');
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}${sign}${oh}:${om}`;
}

function mapSearchCategory(category: string): string {
  const key = String(category || '').toLowerCase();
  if (key.includes('teacher') || key.includes('wyk')) return 'teacher';
  if (key.includes('room') || key.includes('sal')) return 'room';
  if (key.includes('group') || key.includes('grup')) return 'group';
  if (key.includes('subject') || key.includes('przedm')) return 'subject';
  return 'number';
}

function resolveViewRange(viewMode: ViewMode, currentDateText: string): { current: Date; rangeStart: Date; rangeEnd: Date; prev: Date; next: Date } {
  const current = parseYmdOrToday(currentDateText);
  if (viewMode === 'day') {
    return { current, rangeStart: current, rangeEnd: current, prev: addDays(current, -1), next: addDays(current, 1) };
  }
  if (viewMode === 'month') {
    return {
      current,
      rangeStart: new Date(current.getFullYear(), current.getMonth(), 1),
      rangeEnd: new Date(current.getFullYear(), current.getMonth() + 1, 0),
      prev: new Date(current.getFullYear(), current.getMonth() - 1, 1),
      next: new Date(current.getFullYear(), current.getMonth() + 1, 1),
    };
  }
  const day = current.getDay() || 7;
  const rangeStart = addDays(current, -(day - 1));
  const rangeEnd = addDays(rangeStart, 6);
  return { current, rangeStart, rangeEnd, prev: addDays(current, -7), next: addDays(current, 7) };
}

function formatHeaderLabel(viewMode: ViewMode, current: Date, rangeStart: Date, rangeEnd: Date): string {
  if (viewMode === 'day') {
    return new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', weekday: 'short' }).format(current);
  }
  if (viewMode === 'month') {
    return new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' }).format(current);
  }
  const left = new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: '2-digit' }).format(rangeStart);
  const right = new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(rangeEnd);
  return `${left} - ${right}`;
}

function parsePlanEventRow(row: Record<string, unknown>): Record<string, string> | null {
  const start = firstNonEmpty(row.start);
  const end = firstNonEmpty(row.end);
  if (!start || !end) return null;
  return {
    title: firstNonEmpty(row.title),
    description: firstNonEmpty(row.description),
    start,
    end,
    workerTitle: firstNonEmpty(row.worker_title),
    worker: firstNonEmpty(row.worker),
    lessonForm: firstNonEmpty(row.lesson_form),
    lessonFormShort: firstNonEmpty(row.lesson_form_short),
    groupName: firstNonEmpty(row.group_name),
    tokName: firstNonEmpty(row.tok_name),
    room: firstNonEmpty(row.room),
    lessonStatus: firstNonEmpty(row.lesson_status),
    lessonStatusShort: firstNonEmpty(row.lesson_status_short),
    subject: firstNonEmpty(row.subject),
  };
}

function parseEventDate(value: string): Date | null {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function minutesFromMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function formatHm(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function eventTypeClass(event: Record<string, string>): string {
  const status = event.lessonStatusShort.toLowerCase();
  const form = event.lessonForm.toLowerCase();
  const short = event.lessonFormShort.toLowerCase();
  const hay = `${form} ${(event.subject || event.title).toLowerCase()}`;

  if (status === 'e') return 'exam';
  if (status === 'o') return 'cancelled';
  if (status === 'zz') return 'remote';
  if (hay.includes('laboratorium') || short === 'l') return 'lab';
  if (hay.includes('audytoryjne') || short === 'a') return 'auditory';
  if (hay.includes('wyklad') || hay.includes('wykład') || short === 'w') return 'lecture';
  if (hay.includes('egzamin') || form.includes('exam')) return 'exam';
  if (hay.includes('zdalne') || form.includes('remote')) return 'remote';
  if (hay.includes('zaliczenie') || short.startsWith('zal')) return 'pass';
  return 'class';
}

function eventTypeLabel(typeClass: string, event: Record<string, string>): string {
  const labels: Record<string, string> = {
    lecture: 'Wykład',
    lab: 'Laboratorium',
    auditory: 'Ćwiczenia audytoryjne',
    exam: 'Egzamin',
    remote: 'Zdalne',
    cancelled: 'Odwołane',
    pass: 'Zaliczenie',
    class: 'Zajęcia',
  };
  return labels[typeClass] || event.lessonForm || 'Zajęcia';
}

interface PlanLayoutEvent {
  startMin: number;
  endMin: number;
  leftPct: number;
  widthPct: number;
}

function layoutDayEvents<T extends PlanLayoutEvent>(events: T[]): T[] {
  if (events.length < 2) {
    return events.map((event) => ({ ...event, leftPct: 0, widthPct: 100 }));
  }

  const sorted = events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => a.event.startMin - b.event.startMin || a.event.endMin - b.event.endMin);

  const positioned = events.map((event) => ({ ...event, leftPct: 0, widthPct: 100 }));

  let cursor = 0;
  while (cursor < sorted.length) {
    const clusterStart = cursor;
    let clusterEndMin = sorted[cursor].event.endMin;
    cursor += 1;

    while (cursor < sorted.length && sorted[cursor].event.startMin < clusterEndMin) {
      clusterEndMin = Math.max(clusterEndMin, sorted[cursor].event.endMin);
      cursor += 1;
    }

    const cluster = sorted.slice(clusterStart, cursor);
    const columnEnds: number[] = [];
    const placement: Array<{ index: number; column: number }> = [];

    for (const item of cluster) {
      let column = -1;
      for (let i = 0; i < columnEnds.length; i += 1) {
        if (columnEnds[i] <= item.event.startMin) {
          column = i;
          break;
        }
      }

      if (column === -1) {
        column = columnEnds.length;
        columnEnds.push(item.event.endMin);
      } else {
        columnEnds[column] = item.event.endMin;
      }

      placement.push({ index: item.index, column });
    }

    const columns = Math.max(1, columnEnds.length);
    const widthPct = 100 / columns;

    for (const item of placement) {
      positioned[item.index].leftPct = item.column * widthPct;
      positioned[item.index].widthPct = widthPct;
    }
  }

  return positioned;
}

export async function fetchPlan(
  session: SessionData,
  payload: { viewMode: ViewMode; currentDate: string; studyId: string | null; search: { category: string; query: string } },
): Promise<PlanResult> {
  const viewMode = payload.viewMode;
  const { current, rangeStart, rangeEnd, prev, next } = resolveViewRange(viewMode, payload.currentDate);

  let urlParams: Record<string, string>;
  let album = '';

  if (firstNonEmpty(payload.search.query)) {
    urlParams = {
      [mapSearchCategory(payload.search.category || 'number')]: firstNonEmpty(payload.search.query),
      start: toOffsetIso(new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate(), 0, 0, 0)),
      end: toOffsetIso(new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate(), 23, 59, 59)),
    };
  } else {
    const resolvedStudyId = payload.studyId || session.activeStudyId;
    if (!resolvedStudyId) {
      return {
        viewMode,
        currentDate: formatYmd(current),
        rangeStart: formatYmd(rangeStart),
        rangeEnd: formatYmd(rangeEnd),
        dayColumns: [],
        hasAnyEventsInRange: false,
        monthGrid: [],
        prevDate: formatYmd(prev),
        nextDate: formatYmd(next),
        todayDate: formatYmd(startOfDay(new Date())),
        headerLabel: formatHeaderLabel(viewMode, current, rangeStart, rangeEnd),
        debug: {
          album: '',
          entriesTotal: 0,
          daysWithData: [],
        },
      };
    }

    const study = await proxyMzut<Record<string, unknown>>('getStudy', {
      login: session.userId,
      token: session.authKey,
      przynaleznoscId: resolvedStudyId,
    });

    album = firstNonEmpty(study.album);
    if (!album) throw new Error('Brak numeru albumu.');

    urlParams = {
      number: album,
      start: toOffsetIso(new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate(), 0, 0, 0)),
      end: toOffsetIso(new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate(), 23, 59, 59)),
    };
  }

  const rawEvents = await proxyPlanStudent(urlParams);
  const events = rawEvents.map(parsePlanEventRow).filter((event): event is Record<string, string> => Boolean(event));

  const grouped = new Map<string, Record<string, string>[]>();
  for (const event of events) {
    const eventStart = parseEventDate(event.start);
    if (!eventStart) continue;
    const key = formatYmd(eventStart);
    const list = grouped.get(key) ?? [];
    list.push(event);
    grouped.set(key, list);
  }

  const dayColumns: PlanResult['dayColumns'] = [];
  let hasAnyEventsInRange = false;

  if (viewMode !== 'month') {
    for (let day = new Date(rangeStart); day <= rangeEnd; day = addDays(day, 1)) {
      const key = formatYmd(day);
      const dayEventsBase = (grouped.get(key) ?? []).map((event) => {
        const start = parseEventDate(event.start) as Date;
        const end = parseEventDate(event.end) as Date;
        const startMin = minutesFromMidnight(start);
        const endMin = Math.max(startMin + 15, minutesFromMidnight(end));
        const typeClass = eventTypeClass(event);

        return {
          startMin,
          endMin,
          topPx: Math.max(0, (startMin - 360) * 0.8),
          heightPx: Math.max(36, (endMin - startMin) * 0.8),
          leftPct: 0,
          widthPct: 100,
          title: firstNonEmpty(event.subject, event.title),
          room: firstNonEmpty(event.room, '-'),
          group: firstNonEmpty(event.groupName, event.tokName),
          startStr: formatHm(start),
          endStr: formatHm(end),
          tooltip: firstNonEmpty(event.description, event.subject, event.title),
          typeClass,
          typeLabel: eventTypeLabel(typeClass, event),
          subjectKey: firstNonEmpty(event.subject, event.title),
          teacher: firstNonEmpty(event.workerTitle, event.worker),
        };
      }).sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin || a.title.localeCompare(b.title, 'pl'));

      const dayEvents = layoutDayEvents(dayEventsBase);

      if (dayEvents.length > 0) hasAnyEventsInRange = true;
      dayColumns.push({ date: key, events: dayEvents });
    }
  }

  const monthGrid: PlanResult['monthGrid'] = [];
  if (viewMode === 'month') {
    const first = new Date(current.getFullYear(), current.getMonth(), 1);
    const dow = first.getDay() || 7;
    const gridStart = addDays(first, -(dow - 1));

    for (let row = 0; row < 6; row += 1) {
      const week = [];
      for (let col = 0; col < 7; col += 1) {
        const date = addDays(gridStart, row * 7 + col);
        const ymd = formatYmd(date);
        week.push({
          date: ymd,
          hasPlan: grouped.has(ymd),
          inCurrentMonth: date.getMonth() === current.getMonth(),
        });
      }
      monthGrid.push(week);
    }
  }

  return {
    viewMode,
    currentDate: formatYmd(current),
    rangeStart: formatYmd(rangeStart),
    rangeEnd: formatYmd(rangeEnd),
    dayColumns,
    hasAnyEventsInRange,
    monthGrid,
    prevDate: formatYmd(prev),
    nextDate: formatYmd(next),
    todayDate: formatYmd(startOfDay(new Date())),
    headerLabel: formatHeaderLabel(viewMode, current, rangeStart, rangeEnd),
    debug: {
      album,
      entriesTotal: events.length,
      daysWithData: [...grouped.keys()].sort(),
    },
  };
}

export async function fetchPlanSuggestions(kind: string, query: string): Promise<string[]> {
  const response = await fetch(`${API_BASE}/proxy/plan-suggest?kind=${encodeURIComponent(kind)}&query=${encodeURIComponent(query)}`);
  const body = (await response.json().catch(() => ({}))) as { data: Array<{ item: string }> };
  const rows = ensureArray<{ item: string }>(body.data);
  return rows.map((row) => firstNonEmpty(row.item)).filter(Boolean);
}

export async function fetchNews(): Promise<NewsItem[]> {
  const xml = await proxyRssXml();
  if (!xml.trim()) return [];

  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  const items = Array.from(doc.querySelectorAll('item'));

  return items.map((item, index) => {
    const title = firstNonEmpty(item.querySelector('title')?.textContent ?? '');
    const link = firstNonEmpty(item.querySelector('link')?.textContent ?? '');
    const pubDateRaw = firstNonEmpty(item.querySelector('pubDate')?.textContent ?? '');

    const descriptionHtml = fixImageUrls(firstNonEmpty(item.querySelector('description')?.textContent ?? ''));
    const contentNode = item.getElementsByTagName('content:encoded')[0] ?? item.getElementsByTagName('encoded')[0];
    const contentHtml = fixImageUrls(firstNonEmpty(contentNode?.textContent ?? ''));

    const descriptionText = String(descriptionHtml)
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

    const snippet = descriptionText.length > 220 ? `${descriptionText.slice(0, 217)}...` : descriptionText;

    const imgMatch = contentHtml.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
    let thumbRaw = imgMatch?.[1] ?? '';

    // Convert relative URLs to absolute for thumbnail
    if (thumbRaw && !thumbRaw.startsWith('http') && !thumbRaw.startsWith('data:')) {
      if (thumbRaw.startsWith('/')) {
        thumbRaw = `https://www.zut.edu.pl${thumbRaw}`;
      } else {
        thumbRaw = `https://www.zut.edu.pl/${thumbRaw}`;
      }
    }

    // Use image proxy to avoid CORS issues - rewrite zut.edu.pl URLs through /image-proxy/
    let thumbUrl = thumbRaw;
    if (thumbUrl.includes('zut.edu.pl')) {
      thumbUrl = thumbUrl.replace('https://www.zut.edu.pl/', '/image-proxy/').replace('https://www.zut.edu.pl', '/image-proxy/');
    }

    const parsedDate = new Date(pubDateRaw);
    const date = Number.isFinite(parsedDate.getTime())
      ? new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(parsedDate)
      : pubDateRaw;

    return {
      id: index,
      title,
      date,
      pubDateRaw,
      snippet,
      link,
      descriptionHtml,
      descriptionText,
      contentHtml,
      thumbUrl,
    };
  });
}
