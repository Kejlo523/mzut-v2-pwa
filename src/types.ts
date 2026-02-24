export type ViewMode = 'day' | 'week' | 'month';

export interface UsosSessionData {
  accessToken: string;
  accessTokenSecret: string;
}

export interface SessionData {
  userId: string;
  username: string;
  authKey: string;
  imageUrl: string;
  tokenJpg?: string;
  activeStudyId: string | null;
  usos?: UsosSessionData;
}

export interface UsosGrade {
  courseId: string;
  courseName: string;
  grade: string;
  date: string;
  term: number;
}

export interface Study {
  przynaleznoscId: string;
  label: string;
}

export interface Semester {
  listaSemestrowId: string;
  nrSemestru: string;
  pora: string;
  rokAkademicki: string;
  status: string;
}

export interface Grade {
  subjectName: string;
  grade: string;
  weight: number;
  type: string;
  teacher: string;
  date: string;
}

export interface ElsCard {
  id: string;
  expirationDate: string;
  isActive: boolean;
}

export interface CalendarEvent {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  type: string;
  isDayOff: boolean;
}

export interface StudyDetails {
  album: string;
  wydzial: string;
  kierunek: string;
  forma: string;
  poziom: string;
  specjalnosc: string;
  specjalizacja: string;
  status: string;
  rokAkademicki: string;
  semestrLabel: string;
}

export interface StudyHistoryItem {
  label: string;
  status: string;
}

export interface NewsItem {
  id: number;
  title: string;
  date: string;
  pubDateRaw: string;
  snippet: string;
  link: string;
  descriptionHtml: string;
  descriptionText: string;
  contentHtml: string;
  thumbUrl: string;
}

export interface PlanEventUi {
  startMin: number;
  endMin: number;
  topPx: number;
  heightPx: number;
  leftPct: number;
  widthPct: number;
  title: string;
  room: string;
  group: string;
  startStr: string;
  endStr: string;
  tooltip: string;
  typeClass: string;
  typeLabel: string;
  subjectKey: string;
  teacher: string;
}

export interface PlanDayColumn {
  date: string;
  events: PlanEventUi[];
}

export interface PlanMonthCell {
  date: string;
  hasPlan: boolean;
  inCurrentMonth: boolean;
}

export interface SessionPeriod {
  key: string;  // e.g. 'sesja_zimowa', 'przerwa_dydaktyczna_letnia'
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

export interface PlanResult {
  viewMode: ViewMode;
  currentDate: string;
  rangeStart: string;
  rangeEnd: string;
  dayColumns: PlanDayColumn[];
  hasAnyEventsInRange: boolean;
  monthGrid: PlanMonthCell[][];
  prevDate: string;
  nextDate: string;
  todayDate: string;
  headerLabel: string;
  sessionPeriods: SessionPeriod[];
  debug: {
    album: string;
    entriesTotal: number;
    daysWithData: string[];
  };
}

export interface UsefulLink {
  id: string;
  title: string;
  description: string;
  url: string;
  scope: 'GLOBAL' | 'FACULTY';
  facultyCode?: string;
}

export type ScreenKey =
  | 'login'
  | 'home'
  | 'plan'
  | 'grades'
  | 'info'
  | 'news'
  | 'news-detail'
  | 'links'
  | 'settings'
  | 'about';
