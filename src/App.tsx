import { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';
import type {
  AttendanceItem,
  Grade,
  NewsItem,
  PlanDayColumn,
  PlanResult,
  ScreenKey,
  Semester,
  SessionData,
  Study,
  StudyDetails,
  StudyHistoryItem,
  ViewMode,
} from './types';
import {
  fetchGrades,
  fetchInfo,
  fetchNews,
  fetchPlan,
  fetchSemesters,
  fetchStudies,
  login,
} from './services/api';
import {
  loadAttendanceMap,
  loadSession,
  loadSettings,
  saveAttendanceMap,
  saveSession,
  saveSettings,
  type AppSettings,
} from './services/storage';
import { sortUsefulLinks } from './constants/usefulLinks';
import { useAppNavigation, useExitAttemptToast } from './hooks/useAppNavigation';
import { useSwipeBack } from './hooks/useSwipeBack';

interface NewsDetailParams {
  item: NewsItem;
}

function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateLabel(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: '2-digit', weekday: 'short' }).format(date);
}

function gradeTone(grade: string): 'ok' | 'warn' | 'bad' | 'neutral' {
  const value = Number.parseFloat(grade.replace(',', '.'));
  if (!Number.isFinite(value)) return 'neutral';
  if (value >= 4.5) return 'ok';
  if (value >= 3.0) return 'warn';
  return 'bad';
}

function App() {
  const [session, setSession] = useState<SessionData | null>(() => loadSession());
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [studies, setStudies] = useState<Study[]>([]);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [toast, setToast] = useState('');

  const navigation = useAppNavigation<ScreenKey>(session ? 'home' : 'login');
  const swipeBack = useSwipeBack(navigation.canGoBack, navigation.goBack);

  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [planViewMode, setPlanViewMode] = useState<ViewMode>('week');
  const [planDate, setPlanDate] = useState(todayYmd());
  const [planResult, setPlanResult] = useState<PlanResult | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planSearchCategory, setPlanSearchCategory] = useState('number');
  const [planSearchQuery, setPlanSearchQuery] = useState('');

  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState('');
  const [grades, setGrades] = useState<Grade[]>([]);
  const [gradesLoading, setGradesLoading] = useState(false);

  const [details, setDetails] = useState<StudyDetails | null>(null);
  const [history, setHistory] = useState<StudyHistoryItem[]>([]);
  const [infoLoading, setInfoLoading] = useState(false);

  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);

  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceItem>>(() => loadAttendanceMap());

  const activeStudyId = session?.activeStudyId ?? studies[0]?.przynaleznoscId ?? null;
  const currentScreen = navigation.current.key;

  useExitAttemptToast(() => {
    setToast('Gest cofania jest przejety przez aplikacje.');
  });

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(''), 2100);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    saveAttendanceMap(attendanceMap);
  }, [attendanceMap]);

  useEffect(() => {
    saveSession(session);
    if (!session && currentScreen !== 'login') {
      navigation.reset('login');
    }
    if (session && currentScreen === 'login') {
      navigation.reset('home');
    }
  }, [session, currentScreen, navigation]);

  const applySession = useCallback((next: SessionData | null) => {
    setSession(next);
  }, []);

  const updateActiveStudy = useCallback((studyId: string | null) => {
    setSession((prev) => {
      if (!prev) return prev;
      return { ...prev, activeStudyId: studyId };
    });
  }, []);

  const loadStudiesData = useCallback(async (currentSession: SessionData) => {
    setGlobalLoading(true);
    setGlobalError('');
    try {
      const fetchedStudies = await fetchStudies(currentSession);
      setStudies(fetchedStudies);
      if (!currentSession.activeStudyId && fetchedStudies[0]?.przynaleznoscId) {
        updateActiveStudy(fetchedStudies[0].przynaleznoscId);
      }
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : 'Nie mozna pobrac studiow.');
    } finally {
      setGlobalLoading(false);
    }
  }, [updateActiveStudy]);

  useEffect(() => {
    if (!session) {
      setStudies([]);
      return;
    }
    void loadStudiesData(session);
  }, [session, loadStudiesData]);

  const loadPlanData = useCallback(async (search?: { category: string; query: string }) => {
    if (!session) return;
    setPlanLoading(true);
    setGlobalError('');
    try {
      const result = await fetchPlan(session, {
        viewMode: planViewMode,
        currentDate: planDate,
        studyId: activeStudyId,
        search,
      });
      setPlanResult(result);
      if (!search && result.currentDate) {
        setPlanDate(result.currentDate);
      }
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : 'Nie mozna pobrac planu.');
    } finally {
      setPlanLoading(false);
    }
  }, [session, planViewMode, planDate, activeStudyId]);

  const loadGradesData = useCallback(async () => {
    if (!session) return;
    setGradesLoading(true);
    setGlobalError('');
    try {
      const fetchedSemesters = await fetchSemesters(session, activeStudyId);
      setSemesters(fetchedSemesters);
      const currentSemesterId = selectedSemesterId || fetchedSemesters[0]?.listaSemestrowId;
      if (!currentSemesterId) {
        setGrades([]);
        setSelectedSemesterId('');
        return;
      }
      setSelectedSemesterId(currentSemesterId);
      const fetchedGrades = await fetchGrades(session, currentSemesterId);
      setGrades(fetchedGrades);
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : 'Nie mozna pobrac ocen.');
    } finally {
      setGradesLoading(false);
    }
  }, [session, activeStudyId, selectedSemesterId]);

  const loadInfoData = useCallback(async () => {
    if (!session) return;
    setInfoLoading(true);
    setGlobalError('');
    try {
      const payload = await fetchInfo(session, activeStudyId);
      setDetails(payload.details);
      setHistory(payload.history);
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : 'Nie mozna pobrac danych o studiach.');
    } finally {
      setInfoLoading(false);
    }
  }, [session, activeStudyId]);

  const loadNewsData = useCallback(async () => {
    setNewsLoading(true);
    setGlobalError('');
    try {
      const items = await fetchNews();
      setNews(items);
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : 'Nie mozna pobrac aktualnosci.');
    } finally {
      setNewsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    if (currentScreen === 'plan') void loadPlanData();
    if (currentScreen === 'grades') void loadGradesData();
    if (currentScreen === 'info') void loadInfoData();
    if (currentScreen === 'news') void loadNewsData();
  }, [currentScreen, session, loadPlanData, loadGradesData, loadInfoData, loadNewsData]);

  const groupedGrades = useMemo(() => {
    const groups = new Map<string, Grade[]>();
    for (const grade of grades) {
      const key = grade.subjectName || 'Przedmiot';
      const list = groups.get(key) ?? [];
      list.push(grade);
      groups.set(key, list);
    }
    return [...groups.entries()].map(([subject, items]) => ({ subject, items }));
  }, [grades]);

  const attendanceItems = useMemo(() => {
    const subjects = new Map<string, AttendanceItem>();

    const dayColumns: PlanDayColumn[] = planResult?.dayColumns ?? [];
    for (const dayColumn of dayColumns) {
      for (const event of dayColumn.events) {
        const key = event.subjectKey || event.title;
        if (!key) continue;
        if (!subjects.has(key)) {
          subjects.set(key, {
            key,
            subjectName: event.title,
            subjectType: event.typeLabel,
            absenceCount: 0,
            totalHours: 0,
          });
        }
      }
    }

    for (const [key, stored] of Object.entries(attendanceMap)) {
      const base = subjects.get(key) ?? {
        key,
        subjectName: stored.subjectName,
        subjectType: stored.subjectType,
        absenceCount: 0,
        totalHours: 0,
      };
      subjects.set(key, {
        ...base,
        absenceCount: stored.absenceCount,
        totalHours: stored.totalHours,
      });
    }

    return [...subjects.values()].sort((a, b) => a.subjectName.localeCompare(b.subjectName, 'pl'));
  }, [planResult?.dayColumns, attendanceMap]);

  const links = useMemo(() => sortUsefulLinks(studies), [studies]);

  const totalAbsences = useMemo(() => attendanceItems.reduce((acc, item) => acc + item.absenceCount, 0), [attendanceItems]);

  const updateAttendance = useCallback((key: string, patch: Partial<AttendanceItem>) => {
    setAttendanceMap((prev) => {
      const current = prev[key] ?? {
        key,
        subjectName: patch.subjectName ?? key,
        subjectType: patch.subjectType ?? 'Zajecia',
        absenceCount: 0,
        totalHours: 0,
      };
      return {
        ...prev,
        [key]: {
          ...current,
          ...patch,
          absenceCount: Math.max(0, patch.absenceCount ?? current.absenceCount),
          totalHours: Math.max(
            0,
            Number.isFinite(patch.totalHours ?? current.totalHours)
              ? (patch.totalHours ?? current.totalHours)
              : current.totalHours,
          ),
        },
      };
    });
  }, []);

  async function onLoginSubmit() {
    if (!loginValue || !password) {
      setGlobalError('Wpisz login i haslo.');
      return;
    }

    setLoginLoading(true);
    setGlobalError('');
    try {
      const nextSession = await login(loginValue, password);
      applySession(nextSession);
      setPassword('');
      setToast('Zalogowano poprawnie.');
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : 'Logowanie nieudane.');
    } finally {
      setLoginLoading(false);
    }
  }

  const screen = currentScreen;

  const topBar = screen !== 'login' && screen !== 'home' ? (
    <header className="top-bar">
      <button className="ghost" type="button" onClick={navigation.goBack}>Wstecz</button>
      <h1>{screen === 'news-detail' ? 'Aktualnosc' : screen.toUpperCase()}</h1>
      <button className="ghost" type="button" onClick={() => setGlobalError('')}>Wyczysc</button>
    </header>
  ) : null;

  const renderMain = () => {
    if (screen === 'login') {
      return (
        <section className="screen login-screen">
          <div className="logo-badge">mZUT</div>
          <h2>mzutv2 PWA</h2>
          <p>Wersja instalowalna, monolityczna i app-like.</p>
          <input value={loginValue} onChange={(e) => setLoginValue(e.target.value)} placeholder="Login" autoComplete="username" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Haslo" type="password" autoComplete="current-password" />
          <button type="button" onClick={onLoginSubmit} disabled={loginLoading}>{loginLoading ? 'Logowanie...' : 'Zaloguj'}</button>
        </section>
      );
    }

    if (screen === 'home') {
      return (
        <section className="screen home-screen">
          <div className="home-header">
            <h2>Czesc, {session?.username || 'Studencie'}</h2>
            <button className="ghost" type="button" onClick={() => applySession(null)}>Wyloguj</button>
          </div>

          {studies.length > 0 ? (
            <select value={activeStudyId ?? ''} onChange={(e) => updateActiveStudy(e.target.value || null)}>
              {studies.map((study) => (
                <option key={study.przynaleznoscId} value={study.przynaleznoscId}>{study.label}</option>
              ))}
            </select>
          ) : null}

          <div className="tile-grid">
            <button type="button" className="tile" onClick={() => navigation.push('plan')}>Plan zajec</button>
            <button type="button" className="tile" onClick={() => navigation.push('grades')}>Oceny</button>
            <button type="button" className="tile" onClick={() => navigation.push('info')}>Informacje</button>
            <button type="button" className="tile" onClick={() => navigation.push('news')}>Aktualnosci</button>
          </div>

          <div className="list-menu">
            <button type="button" onClick={() => navigation.push('attendance')}>Obecnosci</button>
            <button type="button" onClick={() => navigation.push('links')}>Przydatne strony</button>
            <button type="button" onClick={() => navigation.push('settings')}>Ustawienia</button>
          </div>
        </section>
      );
    }

    if (screen === 'plan') {
      return (
        <section className="screen">
          <div className="row between">
            <h2>Plan</h2>
            <button type="button" className="ghost" onClick={() => setPlanDate(todayYmd())}>Dzis</button>
          </div>

          <div className="segmented">
            {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
              <button key={mode} type="button" className={planViewMode === mode ? 'active' : ''} onClick={() => setPlanViewMode(mode)}>
                {mode === 'day' ? 'Dzien' : mode === 'week' ? 'Tydzien' : 'Miesiac'}
              </button>
            ))}
          </div>

          <div className="row plan-nav">
            <button type="button" onClick={() => setPlanDate(planResult?.prevDate ?? planDate)}>&lt;</button>
            <div>{planResult?.headerLabel || planDate}</div>
            <button type="button" onClick={() => setPlanDate(planResult?.nextDate ?? planDate)}>&gt;</button>
          </div>

          <div className="search-row">
            <select value={planSearchCategory} onChange={(e) => setPlanSearchCategory(e.target.value)}>
              <option value="number">Album</option>
              <option value="teacher">Prowadzacy</option>
              <option value="group">Grupa</option>
              <option value="room">Sala</option>
              <option value="subject">Przedmiot</option>
            </select>
            <input value={planSearchQuery} onChange={(e) => setPlanSearchQuery(e.target.value)} placeholder="Szukaj w planie" />
            <button type="button" onClick={() => void loadPlanData({ category: planSearchCategory, query: planSearchQuery })}>Szukaj</button>
          </div>

          {planLoading ? <p className="muted">Ladowanie planu...</p> : null}

          {!planLoading && planViewMode !== 'month' ? (
            <div className="plan-list">
              {(planResult?.dayColumns ?? []).map((column) => (
                <article key={column.date} className="card">
                  <h3>{formatDateLabel(column.date)}</h3>
                  {column.events.length === 0 ? <p className="muted">Brak zajec</p> : null}
                  {column.events.map((event) => (
                    <div key={`${column.date}-${event.startMin}-${event.title}`} className={`event event-${event.typeClass}`}>
                      <div className="event-time">{event.startStr} - {event.endStr}</div>
                      <div className="event-title">{event.title}</div>
                      <div className="event-meta">{event.room} | {event.typeLabel}</div>
                    </div>
                  ))}
                </article>
              ))}
            </div>
          ) : null}

          {!planLoading && planViewMode === 'month' ? (
            <div className="month-grid">
              {(planResult?.monthGrid ?? []).flat().map((cell) => (
                <div key={cell.date} className={`month-cell ${cell.inCurrentMonth ? '' : 'out'} ${cell.hasPlan ? 'has' : ''}`}>
                  <span>{cell.date.slice(-2)}</span>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      );
    }

    if (screen === 'grades') {
      return (
        <section className="screen">
          <h2>Oceny</h2>

          <div className="row wrap">
            <select value={activeStudyId ?? ''} onChange={(e) => updateActiveStudy(e.target.value || null)}>
              {studies.map((study) => (
                <option key={study.przynaleznoscId} value={study.przynaleznoscId}>{study.label}</option>
              ))}
            </select>

            <select value={selectedSemesterId} onChange={(e) => setSelectedSemesterId(e.target.value)}>
              {semesters.map((semester) => (
                <option key={semester.listaSemestrowId} value={semester.listaSemestrowId}>
                  Semestr {semester.nrSemestru} ({semester.pora}) {semester.rokAkademicki}
                </option>
              ))}
            </select>

            <button type="button" onClick={() => void loadGradesData()}>Odswiez</button>
          </div>

          {gradesLoading ? <p className="muted">Ladowanie ocen...</p> : null}

          <div className="list-stack">
            {groupedGrades.map((group) => (
              <article key={group.subject} className="card">
                <h3>{group.subject}</h3>
                {group.items.map((grade) => (
                  <div key={`${grade.subjectName}-${grade.grade}-${grade.date}`} className="grade-row">
                    <span className={`grade-pill ${gradeTone(grade.grade)}`}>{grade.grade || '-'}</span>
                    <span>{grade.date || 'Brak daty'}</span>
                    <span>{grade.weight > 0 ? `${grade.weight} ECTS` : ''}</span>
                  </div>
                ))}
              </article>
            ))}
          </div>
        </section>
      );
    }

    if (screen === 'info') {
      return (
        <section className="screen">
          <h2>Informacje</h2>
          <button type="button" onClick={() => void loadInfoData()}>Odswiez</button>
          {infoLoading ? <p className="muted">Ladowanie danych...</p> : null}
          {details ? (
            <article className="card table-card">
              <div><span>Album</span><strong>{details.album}</strong></div>
              <div><span>Wydzial</span><strong>{details.wydzial}</strong></div>
              <div><span>Kierunek</span><strong>{details.kierunek}</strong></div>
              <div><span>Forma</span><strong>{details.forma}</strong></div>
              <div><span>Poziom</span><strong>{details.poziom}</strong></div>
              <div><span>Specjalnosc</span><strong>{details.specjalnosc}</strong></div>
              <div><span>Status</span><strong>{details.status}</strong></div>
              <div><span>Rok</span><strong>{details.rokAkademicki}</strong></div>
              <div><span>Semestr</span><strong>{details.semestrLabel}</strong></div>
            </article>
          ) : null}

          <article className="card">
            <h3>Przebieg studiow</h3>
            {history.map((item) => (
              <div key={item.label} className="history-row">
                <span>{item.label}</span>
                <strong>{item.status}</strong>
              </div>
            ))}
          </article>
        </section>
      );
    }

    if (screen === 'news') {
      return (
        <section className="screen">
          <div className="row between">
            <h2>Aktualnosci</h2>
            <button type="button" onClick={() => void loadNewsData()}>Odswiez</button>
          </div>
          {newsLoading ? <p className="muted">Ladowanie RSS...</p> : null}
          <div className="list-stack">
            {news.map((item) => (
              <button key={item.id} type="button" className="card left" onClick={() => navigation.push('news-detail', { item } as unknown as NewsDetailParams)}>
                <h3>{item.title}</h3>
                <p className="muted small">{item.date}</p>
                <p>{item.snippet}</p>
              </button>
            ))}
          </div>
        </section>
      );
    }

    if (screen === 'news-detail') {
      const params = (navigation.current.params ?? {}) as NewsDetailParams;
      const item = params.item;
      if (!item) {
        return <section className="screen"><p>Brak tresci.</p></section>;
      }
      return (
        <section className="screen">
          <h2>{item.title}</h2>
          <p className="muted">{item.date}</p>
          <p>{item.descriptionText || item.snippet}</p>
          <a href={item.link} target="_blank" rel="noreferrer">Otworz zrodlo</a>
        </section>
      );
    }

    if (screen === 'attendance') {
      return (
        <section className="screen">
          <h2>Obecnosci</h2>
          <p className="muted">Lacznie nieobecnosci: {totalAbsences}</p>
          <div className="list-stack">
            {attendanceItems.map((item) => (
              <article key={item.key} className="card">
                <h3>{item.subjectName}</h3>
                <p className="muted">{item.subjectType}</p>
                <div className="row between">
                  <button type="button" onClick={() => updateAttendance(item.key, { ...item, absenceCount: item.absenceCount - 1 })}>-</button>
                  <strong>{item.absenceCount}</strong>
                  <button type="button" onClick={() => updateAttendance(item.key, { ...item, absenceCount: item.absenceCount + 1 })}>+</button>
                </div>
                <label>
                  Godzin:
                  <input
                    type="number"
                    min={0}
                    value={item.totalHours}
                    onChange={(e) => updateAttendance(item.key, { ...item, totalHours: Number(e.target.value) })}
                  />
                </label>
              </article>
            ))}
          </div>
        </section>
      );
    }

    if (screen === 'links') {
      return (
        <section className="screen">
          <h2>Przydatne strony</h2>
          <div className="list-stack">
            {links.map((link) => (
              <a key={link.id} className="card link-card" href={link.url} target="_blank" rel="noreferrer">
                <h3>{link.title}</h3>
                <p>{link.description}</p>
              </a>
            ))}
          </div>
        </section>
      );
    }

    return (
      <section className="screen">
        <h2>Ustawienia</h2>
        <article className="card table-card">
          <div><span>Jezyk</span>
            <select value={settings.language} onChange={(e) => setSettings((prev) => ({ ...prev, language: e.target.value === 'en' ? 'en' : 'pl' }))}>
              <option value="pl">Polski</option>
              <option value="en">English</option>
            </select>
          </div>
          <div><span>Powiadomienia</span><input type="checkbox" checked={settings.notificationsEnabled} onChange={(e) => setSettings((prev) => ({ ...prev, notificationsEnabled: e.target.checked }))} /></div>
          <div><span>Odswiezanie</span>
            <select value={settings.refreshMinutes} onChange={(e) => setSettings((prev) => ({ ...prev, refreshMinutes: Number(e.target.value) as 30 | 60 | 120 }))}>
              <option value={30}>30 min</option>
              <option value={60}>60 min</option>
              <option value={120}>120 min</option>
            </select>
          </div>
          <div><span>Kompaktowy plan</span><input type="checkbox" checked={settings.compactPlan} onChange={(e) => setSettings((prev) => ({ ...prev, compactPlan: e.target.checked }))} /></div>
        </article>
      </section>
    );
  };

  return (
    <div className="app-shell" {...swipeBack}>
      {topBar}
      {globalLoading ? <div className="banner">Ladowanie...</div> : null}
      {globalError ? <div className="banner error">{globalError}</div> : null}
      {toast ? <div className="toast">{toast}</div> : null}
      <main>{renderMain()}</main>

      {screen !== 'login' && screen !== 'news-detail' ? (
        <nav className="bottom-nav">
          <button type="button" className={screen === 'home' ? 'active' : ''} onClick={() => navigation.reset('home')}>Home</button>
          <button type="button" className={screen === 'plan' ? 'active' : ''} onClick={() => navigation.reset('plan')}>Plan</button>
          <button type="button" className={screen === 'grades' ? 'active' : ''} onClick={() => navigation.reset('grades')}>Oceny</button>
          <button type="button" className={screen === 'news' ? 'active' : ''} onClick={() => navigation.reset('news')}>News</button>
          <button type="button" className={screen === 'settings' ? 'active' : ''} onClick={() => navigation.reset('settings')}>Ustaw.</button>
        </nav>
      ) : null}
    </div>
  );
}

export default App;
