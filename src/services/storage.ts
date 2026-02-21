import type { AttendanceItem, SessionData } from '../types';

const SESSION_KEY = 'mzutv2_pwa_session';
const SETTINGS_KEY = 'mzutv2_pwa_settings';
const ATTENDANCE_KEY = 'mzutv2_pwa_attendance';

export interface AppSettings {
  language: 'pl' | 'en';
  notificationsEnabled: boolean;
  refreshMinutes: 30 | 60 | 120;
  compactPlan: boolean;
}

const defaultSettings: AppSettings = {
  language: 'pl',
  notificationsEnabled: true,
  refreshMinutes: 30,
  compactPlan: false,
};

export function loadSession(): SessionData | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionData;
    if (!parsed?.userId || !parsed?.authKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session: SessionData | null): void {
  if (!session) {
    window.localStorage.removeItem(SESSION_KEY);
    return;
  }
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function loadSettings(): AppSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...defaultSettings };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      language: parsed.language === 'en' ? 'en' : 'pl',
      notificationsEnabled: typeof parsed.notificationsEnabled === 'boolean' ? parsed.notificationsEnabled : true,
      refreshMinutes: [30, 60, 120].includes(parsed.refreshMinutes ?? 30) ? (parsed.refreshMinutes as 30 | 60 | 120) : 30,
      compactPlan: Boolean(parsed.compactPlan),
    };
  } catch {
    return { ...defaultSettings };
  }
}

export function saveSettings(settings: AppSettings): void {
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadAttendanceMap(): Record<string, AttendanceItem> {
  try {
    const raw = window.localStorage.getItem(ATTENDANCE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, AttendanceItem>;
  } catch {
    return {};
  }
}

export function saveAttendanceMap(items: Record<string, AttendanceItem>): void {
  window.localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(items));
}
