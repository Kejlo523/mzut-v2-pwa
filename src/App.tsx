import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import type {
  Grade,
  NewsItem,
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
  fetchPlanSuggestions,
  fetchSemesters,
  fetchStudies,
  login,
} from './services/api';
import {
  cache,
  loadSession,
  loadSettings,
  saveSession,
  saveSettings,
  type AppSettings,
} from './services/storage';
import { sortUsefulLinks } from './constants/usefulLinks';
import { useAppNavigation, useExitAttemptToast } from './hooks/useAppNavigation';
import { useSwipeGestures } from './hooks/useSwipeBack';

const APP_BASE = import.meta.env.BASE_URL;
const LOGO_SRC = `${APP_BASE}icons/mzutv2-logo.png`;

// Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬ helpers Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDateLabel(v: string): string {
  const d = new Date(`${v}T00:00:00`);
  if (!Number.isFinite(d.getTime())) return v;
  return new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: '2-digit', weekday: 'short' }).format(d);
}

function fmtWeekdayShort(v: string): string {
  const d = new Date(`${v}T00:00:00`);
  if (!Number.isFinite(d.getTime())) return v;
  return new Intl.DateTimeFormat('pl-PL', { weekday: 'short' }).format(d);
}

function fmtDayMonth(v: string): string {
  const d = new Date(`${v}T00:00:00`);
  if (!Number.isFinite(d.getTime())) return v;
  return new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: '2-digit' }).format(d);
}

function fmtHour(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

function isWeekendDate(dateYmd: string): boolean {
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

function isFinalGradeType(type: string): boolean {
  const t = normalizeMatch(type);
  return (
    t.includes('ocena koncowa') ||
    t.includes('koncowa') ||
    t.includes('final') ||
    t.includes('abschluss')
  );
}

function screenTitle(s: ScreenKey): string {
  const m: Record<ScreenKey, string> = {
    login: 'mzutv2',
    home: 'Strona gÄąâ€šÄ‚Ĺ‚wna',
    plan: 'Plan zajĂ„â„˘Ă„â€ˇ',
    grades: 'Oceny',
    info: 'Dane studenta',
    news: 'AktualnoÄąâ€şci',
    'news-detail': 'AktualnoÄąâ€şĂ„â€ˇ',
    links: 'Przydatne strony',
    settings: 'Ustawienia',
    about: 'O aplikacji',
  };
  return m[s];
}


function gradeTone(g: string): 'ok' | 'warn' | 'bad' | 'neutral' {
  const normalized = g.trim().toLowerCase();
  if (normalized === '-' || normalized === '') return 'neutral';
  if (normalized === 'zal' || normalized === 'zaliczone') return 'ok';
  if (normalized === 'niezal' || normalized === 'niezaliczone') return 'bad';

  const v = Number.parseFloat(g.replace(',', '.'));
  if (!Number.isFinite(v)) return 'neutral';
  if (v > 2) return 'ok';
  return 'bad';
}

function parseGradeNum(g: string): number | null {
  const v = Number.parseFloat(g.replace(',', '.'));
  return Number.isFinite(v) ? v : null;
}

function fmtDec(v: number, d: number): string {
  if (!Number.isFinite(v)) return '-';
  return v.toFixed(d).replace('.', ',');
}

function initials(name: string): string {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return 'S';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function planCacheKey(viewMode: ViewMode, date: string, studyId: string | null | undefined): string {
  return `${viewMode}_${date}_${studyId ?? 'nostudy'}`;
}

function sumUniqueEcts(items: Grade[]): number {
  const bySubject = new Map<string, number>();
  for (const g of items) {
    const ects = Number.isFinite(g.weight) && g.weight > 0 ? g.weight : 0;
    if (!ects) continue;
    const subject = g.subjectName || 'przedmiot';
    const prev = bySubject.get(subject) ?? 0;
    if (ects > prev) bySubject.set(subject, ects);
  }
  let total = 0;
  for (const value of bySubject.values()) total += value;
  return total;
}

// Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬ SVG icons Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬

const SV = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

function Ic({ n }: { n: string }) {
  if (n === 'menu')     return <svg viewBox="0 0 24 24" aria-hidden><path {...SV} d="M3 6h18M3 12h18M3 18h18"/></svg>;
  if (n === 'back')     return <svg viewBox="0 0 24 24" aria-hidden><path {...SV} d="M19 12H5M12 5l-7 7 7 7"/></svg>;
  if (n === 'search')   return <svg viewBox="0 0 24 24" aria-hidden><circle {...SV} cx="11" cy="11" r="7"/><path {...SV} d="m21 21-4.35-4.35"/></svg>;
  if (n === 'refresh')  return <svg viewBox="0 0 24 24" aria-hidden><path {...SV} d="M1 4v6h6M23 20v-6h-6"/><path {...SV} d="M20.49 9A9 9 0 0 0 5.64 5.64M3.51 15A9 9 0 0 0 18.36 18.36"/></svg>;
  if (n === 'more')     return <svg viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="5" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="19" r="1.5" fill="currentColor"/></svg>;
  if (n === 'chevL')    return <svg viewBox="0 0 24 24" aria-hidden><path {...SV} d="M15 18l-6-6 6-6"/></svg>;
  if (n === 'chevR')    return <svg viewBox="0 0 24 24" aria-hidden><path {...SV} d="M9 18l6-6-6-6"/></svg>;
  if (n === 'minus')    return <svg viewBox="0 0 24 24" aria-hidden><path {...SV} d="M5 12h14"/></svg>;
  if (n === 'plus')     return <svg viewBox="0 0 24 24" aria-hidden><path {...SV} d="M12 5v14M5 12h14"/></svg>;
  if (n === 'home')     return <svg viewBox="0 0 24 24" aria-hidden><path {...SV} d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline {...SV} points="9 22 9 12 15 12 15 22"/></svg>;
  if (n === 'calendar') return <svg viewBox="0 0 24 24" aria-hidden><rect {...SV} x="3" y="4" width="18" height="18" rx="2"/><line {...SV} x1="16" y1="2" x2="16" y2="6"/><line {...SV} x1="8" y1="2" x2="8" y2="6"/><line {...SV} x1="3" y1="10" x2="21" y2="10"/></svg>;
  if (n === 'grade')    return <svg viewBox="0 0 24 24" aria-hidden><path {...SV} d="M22 10v6M2 10l10-5 10 5-10 5z"/><path {...SV} d="M6 12v5c3 3 9 3 12 0v-5"/></svg>;
  if (n === 'group')    return <svg viewBox="0 0 24 24" aria-hidden><path {...SV} d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle {...SV} cx="9" cy="7" r="4"/><path {...SV} d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>;
  if (n === 'user')     return <svg viewBox="0 0 24 24" aria-hidden><path {...SV} d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle {...SV} cx="12" cy="7" r="4"/></svg>;
  if (n === 'news')     return <svg viewBox="0 0 24 24" aria-hidden><path {...SV} d="M4 22h16a2 2 0 002-2V4a2 2 0 00-2-2H8a2 2 0 00-2 2v16a2 2 0 01-2 2zm0 0a2 2 0 01-2-2v-9c0-1.1.9-2 2-2h2"/><path {...SV} d="M18 14h-8M15 18h-5M10 6h8v4h-8z"/></svg>;
  if (n === 'present')  return <svg viewBox="0 0 24 24" aria-hidden><polyline {...SV} points="9 11 12 14 22 4"/><path {...SV} d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>;
  if (n === 'link')     return <svg viewBox="0 0 24 24" aria-hidden><path {...SV} d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path {...SV} d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>;
  if (n === 'lock')  return <svg viewBox="0 0 24 24" aria-hidden><rect {...SV} x="3" y="11" width="18" height="11" rx="2" ry="2"/><path {...SV} d="M7 11V7a5 5 0 0110 0v4"/></svg>;
  if (n === 'eye')   return <svg viewBox="0 0 24 24" aria-hidden><path {...SV} d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle {...SV} cx="12" cy="12" r="3"/></svg>;
  if (n === 'settings') return <svg viewBox="0 0 24 24" aria-hidden><circle {...SV} cx="12" cy="12" r="3"/><path {...SV} d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>;
  if (n === 'info')     return <svg viewBox="0 0 24 24" aria-hidden><circle {...SV} cx="12" cy="12" r="10"/><line {...SV} x1="12" y1="8" x2="12" y2="12"/><line {...SV} x1="12" y1="16" x2="12.01" y2="16"/></svg>;
  if (n === 'logout')   return <svg viewBox="0 0 24 24" aria-hidden><path {...SV} d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline {...SV} points="16 17 21 12 16 7"/><line {...SV} x1="21" y1="12" x2="9" y2="12"/></svg>;
  if (n === 'wifi-off') return <svg viewBox="0 0 24 24" aria-hidden><line {...SV} x1="1" y1="1" x2="23" y2="23"/><path {...SV} d="M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.56 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01"/></svg>;
  if (n === 'about')    return <svg viewBox="0 0 24 24" aria-hidden><circle {...SV} cx="12" cy="12" r="10"/><path {...SV} d="M12 16v-4M12 8h.01"/></svg>;
  if (n === 'clock')    return <svg viewBox="0 0 24 24" aria-hidden><circle {...SV} cx="12" cy="12" r="10"/><polyline {...SV} points="12 6 12 12 16 14"/></svg>;
  if (n === 'location') return <svg viewBox="0 0 24 24" aria-hidden><path {...SV} d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle {...SV} cx="12" cy="10" r="3"/></svg>;
  // fallback
  return <svg viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>;
}

// Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬ Spinner Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬

function Spinner({ text }: { text: string }) {
  return (
    <div className="spinner-wrap">
      <div className="spinner" />
      {text && <span>{text}</span>}
    </div>
  );
}

// Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬ Toggle Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="settings-toggle">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="settings-toggle-track" />
    </label>
  );
}

// Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬ App Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬

interface NewsDetailParams { item: NewsItem; }
interface SelectedPlanEvent {
  date: string;
  event: PlanResult['dayColumns'][number]['events'][number];
}

const MONTH_WEEKDAYS = ['Pon', 'Wt', 'ÄąĹˇr', 'Czw', 'Pt', 'Sob', 'Nd'];

function App() {
  const [session, setSession]           = useState<SessionData | null>(() => loadSession());
  const [settings, setSettings]         = useState<AppSettings>(() => loadSettings());
  const [studies, setStudies]           = useState<Study[]>([]);
  const [isOnline, setIsOnline]         = useState(() => navigator.onLine);
  const [globalLoading, setGlobalLoad]  = useState(false);
  const [globalError, setGlobalError]   = useState('');
  const [toast, setToast]               = useState('');

  const nav   = useAppNavigation<ScreenKey>(session ? 'home' : 'login');
  const screen = nav.current.key;

  const [drawerOpen, setDrawerOpen]     = useState(false);

  // Plan
  const [planViewMode, setPlanViewMode] = useState<ViewMode>('week');
  const [planDate, setPlanDate]         = useState(todayYmd);
  const [planResult, setPlanResult]     = useState<PlanResult | null>(null);
  const [planLoading, setPlanLoading]   = useState(false);
  const [planSearchOpen, setPlanSearchOpen] = useState(false);
  const [planSearchCat, setPlanSearchCat]   = useState('album');
  const [planSearchQ, setPlanSearchQ]       = useState('');
  const [planSearchSuggestions, setPlanSearchSuggestions] = useState<string[]>([]);
  const [planSearchLoading, setPlanSearchLoading] = useState(false);
  const [selectedPlanEvent, setSelectedPlanEvent] = useState<SelectedPlanEvent | null>(null);
  const planSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Plan swipe (touch only, strict horizontal detection)
  const [planFading, setPlanFading] = useState(false);
  const planTouchRef = useRef<{ x: number; y: number; t: number } | null>(null);

  // Now line Ă˘â‚¬â€ť current time indicator
  const [nowMinute, setNowMinute] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });

  // Grades
  const [semesters, setSemesters]       = useState<Semester[]>([]);
  const [selSemId, setSelSemId]         = useState('');
  const [grades, setGrades]             = useState<Grade[]>([]);
  const [gradesLoading, setGradesLoad]  = useState(false);
  const [totalEctsAll, setTotalEctsAll] = useState(0);
  const [expandedGradeSubjects, setExpandedGradeSubjects] = useState<Record<string, boolean>>({});
  const selSemPrev = useRef('');
  const planRequestIdRef = useRef<string>('');

  // Info
  const [details, setDetails]           = useState<StudyDetails | null>(null);
  const [history, setHistory]           = useState<StudyHistoryItem[]>([]);
  const [infoLoading, setInfoLoading]   = useState(false);
  const [studentPhotoError, setStudentPhotoError] = useState(false);

  // News
  const [news, setNews]                 = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading]   = useState(false);

  const activeStudyId = session?.activeStudyId ?? studies[0]?.przynaleznoscId ?? null;

  // Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬ Online/offline tracking Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬
  useEffect(() => {
    const on  = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬ Toast auto-clear Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(''), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬ Now line timer (update every minute) Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬
  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setNowMinute(n.getHours() * 60 + n.getMinutes());
    };
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  // Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬ Session inactivity timeout (30 minutes) Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬
  useEffect(() => {
    if (!session) return;
    let inactivityTimer: ReturnType<typeof setTimeout>;
    const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

    const resetTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        setSession(null);
        showToast('Sesja wygasÄąâ€ša, zaloguj siĂ„â„˘ ponownie');
      }, SESSION_TIMEOUT);
    };

    // Reset timer on user activity
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(event => window.addEventListener(event, resetTimer));

    // Initial timer
    resetTimer();

    return () => {
      clearTimeout(inactivityTimer);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [session]);

  // Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬ Student photo loading via fetch (avoids CORS / cache issues) Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬
  const [studentPhotoBlobUrl, setStudentPhotoBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    setStudentPhotoError(false);
        setStudentPhotoBlobUrl(null);

    const url = session?.imageUrl;
    if (!url) return;

    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(url);
        if (cancelled) return;
        if (!resp.ok) { setStudentPhotoError(true); return; }
        const blob = await resp.blob();
        if (cancelled) return;
        if (blob.size === 0) { setStudentPhotoError(true); return; }
        const blobUrl = URL.createObjectURL(blob);
        setStudentPhotoBlobUrl(blobUrl);
      } catch {
        if (!cancelled) setStudentPhotoError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [session?.imageUrl]);

  const showToast = useCallback((msg: string) => setToast(msg), []);

  // Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬ Keyboard drawer close Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬
  useEffect(() => {
    if (!drawerOpen) return;
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [drawerOpen]);

  useEffect(() => {
    if (!selectedPlanEvent) return;
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedPlanEvent(null); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [selectedPlanEvent]);

  // Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬ Sync settings Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬
  useEffect(() => { saveSettings(settings); }, [settings]);

  // Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬ Session Ă˘â€ â€™ navigation sync Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬
  useEffect(() => {
    saveSession(session);
    if (!session && screen !== 'login') nav.reset('login', undefined);
    if (session && screen === 'login') nav.reset('home', undefined);
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬ Close drawer on screen change Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬
  useEffect(() => {
    setDrawerOpen(false);
    if (screen !== 'plan') {
      setPlanSearchOpen(false);
      setSelectedPlanEvent(null);
    }
  }, [screen]);

  // Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬ Exit toast Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬
  useExitAttemptToast(() => showToast('NaciÄąâ€şnij ponownie, aby wyjÄąâ€şĂ„â€ˇ'));

  // Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬ Swipe gestures Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬
  const swipe = useSwipeGestures({
    canGoBack: false,
    onBack: () => {},
    canOpenDrawer: !drawerOpen && screen !== 'login',
    onOpenDrawer: () => setDrawerOpen(true),
  });

  // Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬ Session management Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬
  const applySession = useCallback((s: SessionData | null) => setSession(s), []);

  const updateActiveStudy = useCallback((id: string | null) => {
    setSession(prev => (prev ? { ...prev, activeStudyId: id } : prev));
  }, []);

  // Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬ Data loading with cache-first strategy Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬

  const loadStudiesData = useCallback(async (sess: SessionData) => {
    // Show cached first
    const cached = cache.loadStudiesForce() ?? [];
    if (cached.length) {
      setStudies(cached);
      if (!sess.activeStudyId && cached[0].przynaleznoscId) {
        updateActiveStudy(cached[0].przynaleznoscId);
      }
    }
    // Fresh if TTL expired or no cache
    if (!cache.loadStudies()) {
      setGlobalLoad(true);
      setGlobalError('');
      try {
        const fresh = await fetchStudies(sess);
        cache.saveStudies(fresh);
        setStudies(fresh);
        if (!sess.activeStudyId && fresh[0].przynaleznoscId) {
          updateActiveStudy(fresh[0].przynaleznoscId);
        }
      } catch (e) {
        if (!cached.length) setGlobalError(e instanceof Error ? e.message : 'Nie moÄąÄ˝na pobraĂ„â€ˇ kierunkÄ‚Ĺ‚w.');
      } finally {
        setGlobalLoad(false);
      }
    }
  }, [updateActiveStudy]);

  useEffect(() => {
    if (!session) { setStudies([]); return; }
    void loadStudiesData(session);
  }, [session, loadStudiesData]);

  const loadPlanData = useCallback(async (search?: { category: string; query: string }, forceRefresh = false, newDate?: string) => {
    if (!session) return;
    const dateToUse = newDate || planDate;
    const cacheKey = planCacheKey(planViewMode, dateToUse, activeStudyId);
    const isSearch = !!(search?.query?.trim());
    const searchParam = isSearch && search ? search : { category: 'album', query: '' };

    // Create unique request ID to cancel old requests
    const requestId = Math.random().toString(36).substr(2, 9);
    planRequestIdRef.current = requestId;

    // Show cached immediately without spinner (but not if forcing refresh)
    let hasCached = false;
    if (!isSearch && !forceRefresh) {
      const cached = cache.loadPlanForce(cacheKey);
      if (cached) {
        setPlanResult(cached);
        hasCached = true;
      }
    }

    // Only show spinner if no cache or searching
    if (!hasCached) {
      setPlanLoading(true);
    }
    setGlobalError('');
    try {
      const result = await fetchPlan(session, { viewMode: planViewMode, currentDate: dateToUse, studyId: activeStudyId, search: searchParam });

      // Check if this request is still current (not cancelled by newer request)
      if (planRequestIdRef.current !== requestId) {
        return; // Newer request is in progress, discard this result
      }

      if (!isSearch) cache.savePlan(cacheKey, result);
      setPlanResult(result);
      if (!isSearch && result.currentDate && !newDate) setPlanDate(result.currentDate);
    } catch (e) {
      if (planRequestIdRef.current === requestId) {
        const errorMsg = e instanceof Error ? e.message : 'Nie moÄąÄ˝na pobraĂ„â€ˇ planu.';
        // Check if session expired (401 Unauthorized)
        if (errorMsg.includes('Unauthorized') || errorMsg.includes('401')) {
          applySession(null);
          showToast('Sesja wygasÄąâ€ša, zaloguj siĂ„â„˘ ponownie');
        } else if (!planResult) {
          setGlobalError(errorMsg);
        }
      }
    } finally {
      if (planRequestIdRef.current === requestId) {
        setPlanLoading(false);
      }
    }
  }, [session, planViewMode, planDate, activeStudyId, planResult]);

  // Fetch plan search suggestions with debouncing (300ms)
  const fetchPlanSearchSuggestions = useCallback(async (category: string, query: string) => {
    if (!query.trim()) {
      setPlanSearchSuggestions([]);
      setPlanSearchLoading(false);
      return;
    }

    setPlanSearchLoading(true);
    try {
      const suggestions = await fetchPlanSuggestions(category, query);
      setPlanSearchSuggestions(suggestions);
    } catch (e) {
      setPlanSearchSuggestions([]);
    } finally {
      setPlanSearchLoading(false);
    }
  }, []);

  const loadGradesData = useCallback(async (resetSemId = false, forceRefresh = false) => {
    if (!session || !activeStudyId) {
      setSemesters([]);
      setSelSemId('');
      setGrades([]);
      setTotalEctsAll(0);
      return;
    }

    const cachedSem = cache.loadSemestersForce(activeStudyId) ?? [];
    if (cachedSem.length && !forceRefresh) setSemesters(cachedSem);

    const activeSemId = resetSemId ? '' : selSemId;
    const semId = activeSemId || cachedSem?.[cachedSem.length - 1]?.listaSemestrowId;
    if (semId && !forceRefresh) {
      const cachedG = cache.loadGradesForce(semId);
      if (cachedG) setGrades(cachedG);
    }

    setGradesLoad(true);
    setGlobalError('');
    try {
      let sems = cachedSem;
      if (!cache.loadSemesters(activeStudyId)) {
        sems = await fetchSemesters(session, activeStudyId);
        cache.saveSemesters(activeStudyId, sems);
        setSemesters(sems);
      }

      const safeSems = sems ?? [];
      const curSemId = activeSemId || safeSems[safeSems.length - 1]?.listaSemestrowId;
      if (!curSemId) {
        setGrades([]);
        setSelSemId('');
        setTotalEctsAll(0);
        return;
      }

      setSelSemId(curSemId);
      if (!cache.loadGrades(curSemId)) {
        const fresh = await fetchGrades(session, curSemId);
        cache.saveGrades(curSemId, fresh);
        setGrades(fresh);
      }

      const semFingerprint = safeSems.map(s => s.listaSemestrowId).join('|');
      const totalEctsCacheKey = `mzutv2_total_ects_${session.userId}_${activeStudyId}`;
      try {
        const cachedRaw = window.localStorage.getItem(totalEctsCacheKey);
        if (cachedRaw) {
          const parsed = JSON.parse(cachedRaw) as { semFingerprint: string; value: number };
          if (parsed.semFingerprint === semFingerprint && Number.isFinite(parsed.value)) {
            setTotalEctsAll(Math.max(0, Number(parsed.value)));
          }
        }
      } catch {
        // noop
      }

      let total = 0;
      for (const sem of safeSems) {
        if (!sem.listaSemestrowId) continue;
        let semGrades = cache.loadGradesForce(sem.listaSemestrowId);
        if (!semGrades) {
          try {
            semGrades = await fetchGrades(session, sem.listaSemestrowId);
            cache.saveGrades(sem.listaSemestrowId, semGrades);
          } catch {
            semGrades = cache.loadGradesForce(sem.listaSemestrowId) ?? [];
          }
        }
        total += sumUniqueEcts(semGrades ?? []);
      }

      setTotalEctsAll(total);
      try {
        window.localStorage.setItem(totalEctsCacheKey, JSON.stringify({ semFingerprint, value: total }));
      } catch {
        // noop
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Nie moÄąÄ˝na pobraĂ„â€ˇ ocen.';
      // Check if session expired (401 Unauthorized)
      if (errorMsg.includes('Unauthorized') || errorMsg.includes('401')) {
        applySession(null);
        showToast('Sesja wygasÄąâ€ša, zaloguj siĂ„â„˘ ponownie');
      } else if (!grades.length) {
        setGlobalError(errorMsg);
      }
    } finally {
      setGradesLoad(false);
    }
  }, [session, activeStudyId, selSemId, grades.length]);

  const loadInfoData = useCallback(async (forceRefresh = false) => {
    if (!session || !activeStudyId) return;
    const forceCached = cache.loadInfoForce(activeStudyId);
    if (forceCached && !forceRefresh) { setDetails(forceCached.details); setHistory(forceCached.history); }
    if (cache.loadInfo(activeStudyId) && !forceRefresh) return; // fresh cache, skip fetch
    setInfoLoading(true);
    setGlobalError('');
    try {
      const payload = await fetchInfo(session, activeStudyId);
      cache.saveInfo(activeStudyId, payload);
      setDetails(payload.details);
      setHistory(payload.history);
    } catch (e) {
      if (!forceCached) setGlobalError(e instanceof Error ? e.message : 'Nie moÄąÄ˝na pobraĂ„â€ˇ danych.');
    } finally {
      setInfoLoading(false);
    }
  }, [session, activeStudyId]);

  const loadNewsData = useCallback(async (forceRefresh = false) => {
    const forced = cache.loadNewsForce() ?? [];
    if (forced.length && !forceRefresh) setNews(forced);
    if (cache.loadNews() && !forceRefresh) return;
    setNewsLoading(true);
    setGlobalError('');
    try {
      const items = await fetchNews();
      cache.saveNews(items);
      setNews(items);
    } catch (e) {
      if (!forced.length) setGlobalError(e instanceof Error ? e.message : 'Nie moÄąÄ˝na pobraĂ„â€ˇ aktualnoÄąâ€şci.');
    } finally {
      setNewsLoading(false);
    }
  }, []);

  // Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬ Load on screen enter Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬
  const prevScreen = useRef<ScreenKey | null>(null);
  useEffect(() => {
    if (!session || screen === prevScreen.current) return;
    prevScreen.current = screen;
    if (screen === 'plan')       void loadPlanData();
    if (screen === 'grades')     void loadGradesData();
    if (screen === 'info')       void loadInfoData();
    if (screen === 'news')       void loadNewsData();
  }, [screen, session]); // eslint-disable-line react-hooks/exhaustive-deps

  const prevStudyId = useRef<string | null>(null);
  useEffect(() => {
    if (!session) {
      prevStudyId.current = null;
      return;
    }
    if (prevStudyId.current === null) {
      prevStudyId.current = activeStudyId;
      return;
    }
    if (prevStudyId.current === activeStudyId) return;

    prevStudyId.current = activeStudyId;
    setSelSemId('');
    selSemPrev.current = '';
    setSemesters([]);
    setGrades([]);
    setTotalEctsAll(0);
    setDetails(null);
    setHistory([]);
    setPlanResult(null);
    setSelectedPlanEvent(null);

    if (screen === 'plan')   void loadPlanData();
    if (screen === 'grades') void loadGradesData(true);
    if (screen === 'info')   void loadInfoData();
  }, [session, activeStudyId, screen, loadPlanData, loadGradesData, loadInfoData]);

  // Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬ Refresh when plan date/view changes Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬
  useEffect(() => {
    if (screen === 'plan' && session) void loadPlanData();
  }, [planViewMode, planDate, activeStudyId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬ Refresh grades when semester selected changes Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬
  useEffect(() => {
    if (screen === 'grades' && session && selSemId && selSemId !== selSemPrev.current) {
      selSemPrev.current = selSemId;
      if (!cache.loadGrades(selSemId)) {
        setGradesLoad(true);
        fetchGrades(session, selSemId)
          .then(g => { cache.saveGrades(selSemId, g); setGrades(g); })
          .catch(() => {/* use cached */})
          .finally(() => setGradesLoad(false));
      } else {
        const cached = cache.loadGradesForce(selSemId);
        if (cached) setGrades(cached);
      }
    }
  }, [selSemId, screen, session]);

  // Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬ Computed values Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬

  const groupedGrades = useMemo(() => {
    const bySubject = new Map<string, Grade[]>();
    for (const g of grades) {
      const subject = (g.subjectName || 'Przedmiot').trim();
      bySubject.set(subject, [...(bySubject.get(subject) ?? []), g]);
    }

    return [...bySubject.entries()]
      .map(([subject, rawItems]) => {
        const items = [...rawItems].sort((a, b) => {
          const aOrder = isFinalGradeType(a.type) ? 0 : 1;
          const bOrder = isFinalGradeType(b.type) ? 0 : 1;
          if (aOrder !== bOrder) return aOrder - bOrder;
          return (a.type || '').localeCompare(b.type || '', 'pl');
        });

        const finalItem = items.find(item => isFinalGradeType(item.type));
        const finalGrade = finalItem?.grade?.trim() ? finalItem.grade : 'Ă˘â‚¬â€ś';

        const ects = items.reduce((max, item) => (item.weight > max ? item.weight : max), 0);
        return {
          subject,
          items,
          finalGrade,
          ects,
        };
      })
      .sort((a, b) => a.subject.localeCompare(b.subject, 'pl'));
  }, [grades]);

  useEffect(() => {
    setExpandedGradeSubjects(prev => {
      const visibleSubjects = new Set(groupedGrades.map(group => group.subject));
      const next: Record<string, boolean> = {};
      let changed = false;

      for (const [subject, isOpen] of Object.entries(prev)) {
        if (isOpen && visibleSubjects.has(subject)) {
          next[subject] = true;
        } else {
          changed = true;
        }
      }

      if (!changed && Object.keys(next).length === Object.keys(prev).length) {
        return prev;
      }
      return next;
    });
  }, [groupedGrades]);

  const gradesSummary = useMemo(() => {
    let total = 0;
    let count = 0;
    for (const g of grades) {
      const v = parseGradeNum(g.grade);
      if (v !== null) { total += v; count++; }
    }
    const ects = sumUniqueEcts(grades);
    return { avg: count > 0 ? fmtDec(total / count, 2) : '-', ects: fmtDec(ects, 1) };
  }, [grades]);

  const links = useMemo(() => sortUsefulLinks(studies), [studies]);

  const weekLayout = useMemo(() => {
    let minS = Infinity, maxE = 0;
    for (const col of planResult?.dayColumns ?? []) {
      for (const ev of col.events) { minS = Math.min(minS, ev.startMin); maxE = Math.max(maxE, ev.endMin); }
    }
    const s0 = Number.isFinite(minS) ? minS : 7 * 60;
    const e0 = maxE > 0 ? maxE : 21 * 60;
    const startMin = Math.max(6 * 60, Math.floor((s0 - 30) / 60) * 60);
    const endMin   = Math.max(startMin + 60, Math.min(23 * 60, Math.ceil((e0 + 30) / 60) * 60));
    const hh = settings.compactPlan ? 44 : 56;
    const slots: number[] = [];
    for (let m = startMin; m < endMin; m += 60) slots.push(m);
    if (!slots.length) slots.push(startMin);
    return { startMin, endMin, hourHeight: hh, slots };
  }, [planResult?.dayColumns, settings.compactPlan]);

  const weekVisibleColumns = useMemo(() => {
    const cols = planResult?.dayColumns ?? [];
    const weekendCols = cols.filter(col => isWeekendDate(col.date));
    const hideWeekend = weekendCols.length === 2 && weekendCols.every(col => col.events.length === 0);
    if (!hideWeekend) return cols;
    const workweekCols = cols.filter(col => !isWeekendDate(col.date));
    return workweekCols.length > 0 ? workweekCols : cols;
  }, [planResult?.dayColumns]);

  const weekTrackH   = weekLayout.slots.length * weekLayout.hourHeight;
  const min2px       = weekLayout.hourHeight / 60;

  const openScreen = useCallback((s: Exclude<ScreenKey, 'login' | 'news-detail'>) => {
    if (s === screen) {
      setDrawerOpen(false);
      return;
    }
    if (s === 'home') {
      nav.reset('home', undefined);
    } else {
      nav.push(s, undefined);
    }
    setDrawerOpen(false);
  }, [nav, screen]);

  // Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬ Login Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬
  const [loginVal, setLoginVal]         = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  async function onLoginSubmit() {
    if (!loginVal || !password) { setGlobalError('Wpisz login i hasÄąâ€šo.'); return; }
    setLoginLoading(true);
    setGlobalError('');
    try {
      const s = await login(loginVal, password);
      applySession(s);
      setPassword('');
      showToast('Zalogowano poprawnie');
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : 'Logowanie nieudane.');
    } finally {
      setLoginLoading(false);
    }
  }

  // Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬ AppBar logic Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬
  const onNavIcon = () => setDrawerOpen(true);

  // Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬ Drawer items Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬
  type DrawerKey = Exclude<ScreenKey, 'login' | 'news-detail'>;
  const drawerItems: Array<{ key: DrawerKey; label: string; icon: string }> = [
    { key: 'home',       label: 'Strona gÄąâ€šÄ‚Ĺ‚wna',    icon: 'home'     },
    { key: 'plan',       label: 'Plan zajĂ„â„˘Ă„â€ˇ',        icon: 'calendar' },
    { key: 'grades',     label: 'Oceny',             icon: 'grade'    },
    { key: 'info',       label: 'Dane studenta',      icon: 'user'     },
    { key: 'news',       label: 'AktualnoÄąâ€şci',        icon: 'news'     },
    { key: 'links',      label: 'Przydatne strony',   icon: 'link'     },
    { key: 'settings',   label: 'Ustawienia',         icon: 'settings' },
    { key: 'about',      label: 'O aplikacji',        icon: 'about'    },
  ];

  // Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬ Plan touch swipe handlers (strict horizontal) Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬
  const onPlanTouchStart = (e: React.TouchEvent) => {
    planTouchRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      t: Date.now(),
    };
  };

  const onPlanTouchEnd = (e: React.TouchEvent) => {
    const start = planTouchRef.current;
    if (!start || !planResult || planLoading) return;
    planTouchRef.current = null;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const dt = Math.max(1, Date.now() - start.t);
    const velocity = absDx / dt; // px/ms

    // Reduce accidental week changes while user scrolls vertically.
    const horizontalDominant = absDx > absDy * 1.6;
    const longSwipe = absDx >= 96 && horizontalDominant;
    const quickSwipe = absDx >= 68 && velocity >= 0.6 && horizontalDominant && absDy <= 42;
    if (!longSwipe && !quickSwipe) return;

    const targetDate = dx > 0 ? planResult.prevDate : planResult.nextDate;
    if (!targetDate) return;

    setPlanFading(true);
    setTimeout(() => {
      const isSearch = !!(planSearchQ?.trim());
      if (isSearch) {
        void loadPlanData({ category: planSearchCat, query: planSearchQ.trim() }, false, targetDate);
      } else {
        setPlanDate(targetDate);
      }
      setPlanFading(false);
    }, 150);
  };

  // Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬ render screens Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬

  function renderLogin() {
    return (
      <section className="screen login-screen">
        <div className="login-header">
          <img src={LOGO_SRC} alt="mZUT v2" className="login-logo" />
          <h1 className="login-title">mzutv2</h1>
        </div>

        <div className="login-card">
          <div className="login-card-title">Zaloguj siĂ„â„˘ kontem ZUT</div>

          <div className="login-form">
            <div className="login-field">
              <label htmlFor="login-input" className="login-field-label">
                <Ic n="user" />
              </label>
              <input
                id="login-input"
                type="text"
                value={loginVal}
                onChange={e => setLoginVal(e.target.value)}
                placeholder="s12345 lub email"
                autoComplete="username"
                onKeyDown={e => e.key === 'Enter' && void onLoginSubmit()}
                className="login-field-input"
              />
            </div>

            <div className="login-field">
              <label htmlFor="password-input" className="login-field-label">
                <Ic n="lock" />
              </label>
              <input
                id="password-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="HasÄąâ€šo"
                autoComplete="current-password"
                onKeyDown={e => e.key === 'Enter' && void onLoginSubmit()}
                className="login-field-input"
              />
              <button
                type="button"
                className="login-field-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Ukryj hasÄąâ€šo' : 'PokaÄąÄ˝ hasÄąâ€šo'}
              >
                <Ic n="eye" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => void onLoginSubmit()}
              disabled={loginLoading}
              className="login-button"
            >
              {loginLoading ? 'LogowanieĂ˘â‚¬Â¦' : 'Zaloguj siĂ„â„˘'}
            </button>

            <p className="login-info-text">
              Zaloguj siĂ„â„˘ swoimi danymi z systemu ZUT. Aplikacja nie przechowuje haseÄąâ€š - logowanie odbywa siĂ„â„˘ bezpoÄąâ€şrednio na serwerach uczelni.
            </p>
          </div>
        </div>
      </section>
    );
  }

  function renderHome() {
    return (
      <section className="screen home-screen">
        <div className="home-scroll-content">
          <div className="home-hero-container">
            <div className="home-hero-label">mZUT v2</div>
            <div className="home-hero-greeting">CzeÄąâ€şĂ„â€ˇ{session?.username ? `, ${session.username.split(' ')[0]}` : ''} Ä‘Ĺşâ€â€ą</div>
            <div className="home-hero-sub">Wybierz moduÄąâ€š, aby przejÄąâ€şĂ„â€ˇ dalej</div>
            {!isOnline && <span className="offline-badge" style={{marginTop: 8}}><Ic n="wifi-off"/>Tryb offline</span>}
          </div>

          <div className="home-section-title">SkrÄ‚Ĺ‚ty</div>
          <div className="tile-grid">
          {([
            { key: 'plan'  as DrawerKey, label: 'Plan zajĂ„â„˘Ă„â€ˇ',    desc: 'DzieÄąâ€ž, tydzieÄąâ€ž, miesiĂ„â€¦c', icon: 'calendar' },
            { key: 'grades'as DrawerKey, label: 'Oceny',          desc: 'ÄąĹˇrednia i punkty ECTS',   icon: 'grade'    },
            { key: 'info'  as DrawerKey, label: 'Dane studenta',  desc: 'Kierunek i przebieg',      icon: 'user'     },
            { key: 'news'  as DrawerKey, label: 'AktualnoÄąâ€şci',    desc: 'Komunikaty uczelni',       icon: 'news'     },
          ] as const).map(t => (
            <button key={t.key} type="button" className="tile" onClick={() => openScreen(t.key)}>
              <div className="tile-icon"><Ic n={t.icon}/></div>
              <span className="tile-label">{t.label}</span>
              <span className="tile-desc">{t.desc}</span>
            </button>
          ))}
        </div>

        <div className="home-footer-card">
          <p>mZUT v2 zostaÄąâ€š stworzony jako nieoficjalna, lekka alternatywa do szybkiego podglĂ„â€¦du planu, ocen i informacji o studiach na ZUT.</p>
        </div>
        </div>
      </section>
    );
  }

  function renderPlan() {
    const cols = planResult?.dayColumns ?? [];
    const weekCols = weekVisibleColumns;
    const today = todayYmd();
    const activeFilter = planSearchQ.trim();
    const viewLabel = planViewMode === 'day' ? 'Widok dnia' : planViewMode === 'week' ? 'Widok tygodnia' : 'Widok miesiaca';

    return (
      <section className="screen plan-screen">
        <aside className="plan-control-pane">
          {/* Sticky Header */}
          <div className="plan-sticky-header">
            <button type="button" className="plan-nav-btn-compact" onClick={() => {
              const newDate = planResult?.prevDate ?? planDate;
              const isSearch = !!(planSearchQ?.trim());
              if (isSearch) {
                void loadPlanData({ category: planSearchCat, query: planSearchQ.trim() }, false, newDate);
              } else {
                setPlanDate(newDate);
              }
            }} aria-label="Poprzedni">
              <Ic n="chevL"/>
            </button>
            <div className="plan-header-center">
              <div className="plan-date-label-compact">{planResult?.headerLabel || planDate}</div>
              <div className="plan-header-sub">{viewLabel}{activeFilter ? ` | Filtr: ${activeFilter}` : ''}</div>
            </div>
            <button type="button" className="plan-nav-btn-compact" onClick={() => {
              const newDate = planResult?.nextDate ?? planDate;
              const isSearch = !!(planSearchQ?.trim());
              if (isSearch) {
                void loadPlanData({ category: planSearchCat, query: planSearchQ.trim() }, false, newDate);
              } else {
                setPlanDate(newDate);
              }
            }} aria-label="NastĂ„â„˘pny">
              <Ic n="chevR"/>
            </button>
          </div>

          <div className="plan-floating-toolbar">
            {(['day', 'week', 'month'] as ViewMode[]).map(m => (
              <button key={m} type="button" className={`plan-mode-btn-floating ${planViewMode === m ? 'active' : ''}`} onClick={() => setPlanViewMode(m)}>
                {m === 'day' ? 'DzieÄąâ€ž' : m === 'week' ? 'TydzieÄąâ€ž' : 'MiesiĂ„â€¦c'}
              </button>
            ))}
          </div>
        </aside>

        {/* Calendar Content */}
        <div className="plan-content">
          <div className="plan-content-surface">
            <div
          className={`plan-container${planFading ? ' fading' : ''}`}
          onTouchStart={onPlanTouchStart}
          onTouchEnd={onPlanTouchEnd}
        >
          {planLoading && <Spinner text="Pobieranie planuĂ˘â‚¬Â¦"/>}

        {!planLoading && planViewMode === 'day' && (
          <div className="list-stack">
            {cols.map(col => (
              <div key={col.date} className="card day-tl-card">
                <div className="day-tl-head">
                  <div className="day-tl-head-date">{fmtDateLabel(col.date)}</div>
                  {col.date === today && <span className="day-tl-today-badge">DziÄąâ€ş</span>}
                </div>

                {col.events.length === 0 ? (
                  <div className="day-empty">Brak zajĂ„â„˘Ă„â€ˇ</div>
                ) : (
                  <div className="day-tl-body">
                    <div className="day-time-col">
                      {weekLayout.slots.map(m => (
                        <div key={`${col.date}-${m}`} className="day-time-cell" style={{ height: weekLayout.hourHeight }}>
                          {fmtHour(m)}
                        </div>
                      ))}
                    </div>

                    <div className="day-events-col" style={{ height: weekTrackH }}>
                      {weekLayout.slots.map((m, idx) => (
                        <div key={`${col.date}-line-${m}`} className="day-hour-line" style={{ top: idx * weekLayout.hourHeight }} />
                      ))}
                      {col.date === today && nowMinute >= weekLayout.startMin && nowMinute <= weekLayout.endMin && (
                        <div className="now-line" style={{ top: (nowMinute - weekLayout.startMin) * min2px }} />
                      )}
                      {col.events.map(ev => {
                        const top = Math.max(0, (ev.startMin - weekLayout.startMin) * min2px);
                        const h = Math.max(32, (ev.endMin - ev.startMin) * min2px);
                        const left = `calc(${ev.leftPct}% + 2px)`;
                        const width = `max(calc(${ev.widthPct}% - 4px), 8px)`;
                        const open = () => setSelectedPlanEvent({ date: col.date, event: ev });
                        return (
                          <div
                            key={`${col.date}-${ev.startMin}-${ev.endMin}-${ev.title}`}
                            className={`day-event ev-${ev.typeClass}`}
                            style={{ top, height: h, left, width }}
                            role="button"
                            tabIndex={0}
                            onClick={open}
                            onKeyDown={e => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                open();
                              }
                            }}
                            title={`${ev.startStr} - ${ev.endStr} ${ev.title}`}
                          >
                            <div className="day-event-title">{ev.title}</div>
                            <div className="day-event-meta">{ev.startStr}-{ev.endStr} Ă‚Â· {ev.room}{ev.group ? ` Ă‚Â· ${ev.group}` : ''}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {cols.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">Ä‘Ĺşâ€śâ€¦</div>
                <p>Brak zajĂ„â„˘Ă„â€ˇ w wybranym dniu</p>
              </div>
            )}
          </div>
        )}

        {!planLoading && planViewMode === 'week' && (
          <div className="card week-card">
            {weekCols.length > 0 ? (
              <>
                <div className="week-grid week-head-row" style={{ gridTemplateColumns: `44px repeat(${weekCols.length}, 1fr)` }}>
                  <div className="week-head-time">Godz.</div>
                  {weekCols.map(col => (
                    <div key={`h-${col.date}`} className={`week-head-day ${col.date === today ? 'today' : ''}`}>
                      <strong>{fmtWeekdayShort(col.date)}</strong>
                      <span>{fmtDayMonth(col.date)}</span>
                    </div>
                  ))}
                </div>

                <div className="week-grid" style={{ gridTemplateColumns: `44px repeat(${weekCols.length}, 1fr)` }}>
                  <div className="week-time-col">
                    {weekLayout.slots.map(m => (
                      <div key={`w-time-${m}`} className="week-time-cell" style={{ height: weekLayout.hourHeight }}>
                        {fmtHour(m)}
                      </div>
                    ))}
                  </div>

                  {weekCols.map(col => (
                    <div key={`w-col-${col.date}`} className="week-day-col" style={{ height: weekTrackH }}>
                      {weekLayout.slots.map((m, idx) => (
                        <div key={`${col.date}-week-line-${m}`} className="week-hour-line" style={{ top: idx * weekLayout.hourHeight }} />
                      ))}
                      {col.date === today && nowMinute >= weekLayout.startMin && nowMinute <= weekLayout.endMin && (
                        <div className="now-line" style={{ top: (nowMinute - weekLayout.startMin) * min2px }} />
                      )}
                      {col.events.map(ev => {
                        const top = Math.max(0, (ev.startMin - weekLayout.startMin) * min2px);
                        const h = Math.max(26, (ev.endMin - ev.startMin) * min2px);
                        const left = `calc(${ev.leftPct}% + 2px)`;
                        const width = `max(calc(${ev.widthPct}% - 4px), 8px)`;
                        const open = () => setSelectedPlanEvent({ date: col.date, event: ev });
                        return (
                          <div
                            key={`w-${col.date}-${ev.startMin}-${ev.endMin}-${ev.title}`}
                            className={`week-event ev-${ev.typeClass}`}
                            style={{ top, height: h, left, width }}
                            role="button"
                            tabIndex={0}
                            onClick={open}
                            onKeyDown={e => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                open();
                              }
                            }}
                            title={`${ev.startStr} - ${ev.endStr} ${ev.title}`}
                          >
                            <div className="week-event-time">{ev.startStr}</div>
                            <div className="week-event-title">{ev.title}</div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="day-empty">Brak danych tygodnia</div>
            )}
          </div>
        )}

        {!planLoading && planViewMode === 'month' && (
          <div className="month-shell">
            <div className="month-weekdays">{MONTH_WEEKDAYS.map(d => <span key={d}>{d}</span>)}</div>
            <div className="month-grid">
              {(planResult?.monthGrid ?? []).flat().map(cell => (
                <div
                  key={cell.date}
                  className={`month-cell ${cell.inCurrentMonth ? '' : 'out'} ${cell.hasPlan ? 'has' : ''} ${cell.date === today ? 'today' : ''}`}
                  onClick={() => {
                    setPlanDate(cell.date);
                    setPlanViewMode('day');
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setPlanDate(cell.date);
                      setPlanViewMode('day');
                    }
                  }}
                >
                  <span className="month-cell-num">{cell.date.slice(-2)}</span>
                  {cell.hasPlan && <span className="month-dot" />}
                </div>
              ))}
            </div>
          </div>
        )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  function renderGrades() {
    return (
      <section className="screen grades-screen">
        <div className="grades-hero">
          <div className="metrics-row">
            <div className="metric-card"><div className="metric-label">ÄąĹˇrednia</div><div className="metric-value">{gradesSummary.avg}</div></div>
            <div className="metric-card"><div className="metric-label">ECTS semestr</div><div className="metric-value">{gradesSummary.ects}</div></div>
            <div className="metric-card"><div className="metric-label">ECTS Äąâ€šĂ„â€¦cznie</div><div className="metric-value">{fmtDec(totalEctsAll, 1)}</div></div>
          </div>
        </div>

        <div className="grades-filters-container">
          <div className="grades-filters">
            {studies.length > 0 && (
              <label className="field-label">
                Kierunek
                <select value={activeStudyId ?? ''} onChange={e => updateActiveStudy(e.target.value || null)}>
                  {studies.map(s => <option key={s.przynaleznoscId} value={s.przynaleznoscId}>{s.label}</option>)}
                </select>
              </label>
            )}
            {semesters.length > 0 && (
              <label className="field-label">
                Semestr
                <select value={selSemId} onChange={e => setSelSemId(e.target.value)}>
                  {semesters.map(s => (
                    <option key={s.listaSemestrowId} value={s.listaSemestrowId}>
                      Sem. {s.nrSemestru} ({s.pora}) {s.rokAkademicki}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>

        <div className="grades-surface">
          {gradesLoading && <Spinner text="Pobieranie ocenĂ˘â‚¬Â¦"/>}
          {!gradesLoading && grades.length === 0 && (
            <div className="empty-state"><div className="empty-state-icon">Ä‘ĹşĹ˝â€ś</div><p>Brak ocen dla wybranego semestru</p></div>
          )}

          <div className="list-stack">
          {settings.gradesGrouping ? (
            groupedGrades.map(({ subject, items, finalGrade, ects }) => {
              const isOpen = !!expandedGradeSubjects[subject];
              return (
                <div key={subject} className="grade-group">
                  <button
                    type="button"
                    className="grade-group-head"
                    onClick={() => setExpandedGradeSubjects(prev => ({ ...prev, [subject]: !prev[subject] }))}
                    aria-expanded={isOpen}
                  >
                    <div className="grade-group-icon"><Ic n="grade"/></div>
                    <div className="grade-group-name-wrap">
                      <div className="grade-group-name">{subject}</div>
                      <div className="grade-group-sub">
                        Ocena koÄąâ€žcowa{ects > 0 ? ` Ă‚Â· ${fmtDec(ects, 1)} ECTS` : ''}
                      </div>
                    </div>
                    <div className={`grade-group-pill ${gradeTone(finalGrade)}`}>{finalGrade || 'Ă˘â‚¬â€ś'}</div>
                    <div className={`grade-group-chevron ${isOpen ? 'open' : ''}`}><Ic n="chevR"/></div>
                  </button>

                  {isOpen && (
                    <div className="grade-group-items">
                      {items.map((g, i) => (
                        <div key={`${subject}-${i}`} className="grade-row">
                          <span className={`grade-pill ${gradeTone(g.grade)}`}>{g.grade || 'Ă˘â‚¬â€ś'}</span>
                          <div className="grade-info">
                            <div className="grade-type-chip">{isFinalGradeType(g.type) ? 'Ocena koÄąâ€žcowa' : (g.type || 'SkÄąâ€šadowa')}</div>
                            <div className="grade-date-teacher">
                              {g.date || 'Ă˘â‚¬â€ś'}{g.teacher ? ` Ă‚Â· ${g.teacher}` : ''}
                            </div>
                          </div>
                          <div className="grade-ects">{g.weight > 0 ? `${fmtDec(g.weight, 1)} ECTS` : 'Ă˘â‚¬â€ś'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="grade-group">
              {grades.map((g, i) => (
                <div key={`flat-${i}-${g.subjectName}`} className="grade-row">
                  <span className={`grade-pill ${gradeTone(g.grade)}`}>{g.grade || 'Ă˘â‚¬â€ś'}</span>
                  <div className="grade-info">
                    <div>{g.subjectName || 'Przedmiot'}</div>
                    <div className="grade-date-teacher">
                      {g.date || 'Ă˘â‚¬â€ś'}{g.teacher ? ` Ă‚Â· ${g.teacher}` : ''}
                    </div>
                  </div>
                  <div className="grade-ects">{g.weight > 0 ? `${fmtDec(g.weight, 1)} ECTS` : 'Ă˘â‚¬â€ś'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>
      </section>
    );
  }

  function renderInfo() {
    const hasSideColumn = !!session || studies.length > 0;

    return (
      <section className={`screen info-screen${hasSideColumn ? '' : ' info-screen-full'}`}>
        {hasSideColumn && (
          <aside className="info-side">
            {session && (
              <div className="info-profile-card">
                {studentPhotoBlobUrl && !studentPhotoError ? (
                  <img
                    src={studentPhotoBlobUrl}
                    alt="ZdjĂ„â„˘cie studenta"
                    className="info-profile-photo"
                  />
                ) : (
                  <div className="info-profile-fallback">{initials(session.username || 'S')}</div>
                )}
                <div className="info-profile-meta">
                  <div className="info-profile-name">{session.username || 'Student'}</div>
                  <div className="info-profile-id">ID uÄąÄ˝ytkownika: {session.userId || '-'}</div>
                </div>
              </div>
            )}

            {studies.length > 0 && (
              <label className="field-label info-study-select">
                Kierunek
                <select value={activeStudyId ?? ''} onChange={e => updateActiveStudy(e.target.value || null)}>
                  {studies.map(s => <option key={s.przynaleznoscId} value={s.przynaleznoscId}>{s.label}</option>)}
                </select>
              </label>
            )}
          </aside>
        )}

        <div className="info-main">
          {infoLoading && <Spinner text="ÄąÂadowanie danychĂ˘â‚¬Â¦"/>}
          {details && (
            <div className="info-card">
              {([
                { l: 'Album',         v: details.album },
                { l: 'WydziaÄąâ€š',       v: details.wydzial },
                { l: 'Kierunek',      v: details.kierunek },
                { l: 'Forma',         v: details.forma },
                { l: 'Poziom',        v: details.poziom },
                { l: 'SpecjalnoÄąâ€şĂ„â€ˇ',   v: details.specjalnosc },
                { l: 'Specjalizacja', v: details.specjalizacja },
                { l: 'Status',        v: details.status },
                { l: 'Rok akadem.',   v: details.rokAkademicki },
                { l: 'Semestr',       v: details.semestrLabel },
              ].filter(r => r.v)).map(r => (
                <div key={r.l} className="info-row">
                  <div className="info-row-label">{r.l}</div>
                  <div className="info-row-value">{r.v}</div>
                </div>
              ))}
            </div>
          )}
          {history.length > 0 && (
            <div className="info-card info-history-card">
              <div className="info-card-head">Przebieg studiÄ‚Ĺ‚w</div>
              {history.map((h, i) => (
                <div key={i} className="history-row">
                  <span className="history-label">{h.label}</span>
                  <span className="history-status">{h.status}</span>
                </div>
              ))}
            </div>
          )}
          {!infoLoading && !details && (
            <div className="empty-state"><div className="empty-state-icon">Ä‘Ĺşâ€Â¤</div><p>Brak danych studenta</p></div>
          )}
        </div>
      </section>
    );
  }
  function renderNews() {
    return (
      <section className="screen news-screen">
        {newsLoading && <Spinner text="Pobieranie aktualnoÄąâ€şciĂ˘â‚¬Â¦"/>}
        {!newsLoading && news.length === 0 && (
          <div className="empty-state"><div className="empty-state-icon">Ä‘Ĺşâ€śÂ°</div><p>Brak aktualnoÄąâ€şci</p></div>
        )}
        <div className="list-stack">
          {news.map(item => (
            <button key={item.id} type="button" className="news-card" onClick={() => nav.push('news-detail', { item } as unknown as NewsDetailParams)}>
              {item.thumbUrl ? (
                <img src={item.thumbUrl} alt="" className="news-thumb" loading="lazy" onError={e => { (e.target as HTMLImageElement).replaceWith(Object.assign(document.createElement('div'), { className: 'news-thumb-placeholder', innerHTML: '<svg viewBox="0 0 24 24" aria-hidden><path fill="currentColor" d="M4 22h16a2 2 0 002-2V4a2 2 0 00-2-2H4a2 2 0 00-2 2v16a2 2 0 002 2zm0 0a2 2 0 01-2-2v-9c0-1.1.9-2 2-2h2"/><path fill="currentColor" d="M18 14h-8M15 18h-5M10 6h8v4h-8z"/></svg>' })); }} />
              ) : (
                <div className="news-thumb-placeholder"><Ic n="news"/></div>
              )}
              <div className="news-content">
                <div className="news-title">{item.title}</div>
                <div className="news-date">{item.date}</div>
                <div className="news-snippet">{item.snippet}</div>
              </div>
            </button>
          ))}
        </div>
      </section>
    );
  }

  function renderNewsDetail() {
    const p = (nav.current.params ?? {}) as NewsDetailParams;
    const item = p.item;
    if (!item) return <section className="screen news-detail-screen"><div className="empty-state"><p>Brak treÄąâ€şci</p></div></section>;
    const fullHtml = item.contentHtml || item.descriptionHtml;

    return (
      <section className="screen news-detail-screen">
        <div className="card">
          <div className="news-detail-title">{item.title}</div>
          <div className="news-detail-date">{item.date}</div>
          {item.thumbUrl && <img src={item.thumbUrl} alt="" className="news-detail-img" loading="lazy" decoding="async" crossOrigin="anonymous" />}
          {fullHtml ? (
            <div className="news-detail-body" dangerouslySetInnerHTML={{ __html: fullHtml }} />
          ) : (
            <div className="news-detail-body">{item.descriptionText || item.snippet}</div>
          )}
        </div>
        {item.link && (
          <a href={item.link} target="_blank" rel="noreferrer" className="news-source-btn">
            OtwÄ‚Ĺ‚rz w przeglĂ„â€¦darce Ă˘â€ â€”
          </a>
        )}
      </section>
    );
  }

  function renderLinks() {
    const globals  = links.filter(l => l.scope === 'GLOBAL');
    const faculties = links.filter(l => l.scope === 'FACULTY');
    return (
      <section className="screen links-screen">
        {faculties.length > 0 && <div className="link-category">TwÄ‚Ĺ‚j wydziaÄąâ€š</div>}
        {faculties.map(l => (
          <a key={l.id} href={l.url} target="_blank" rel="noreferrer" className="link-card">
            <div className="link-card-title">{l.title}</div>
            <div className="link-card-desc">{l.description}</div>
          </a>
        ))}
        <div className="link-category">Zasoby uczelni</div>
        {globals.map(l => (
          <a key={l.id} href={l.url} target="_blank" rel="noreferrer" className="link-card">
            <div className="link-card-title">{l.title}</div>
            <div className="link-card-desc">{l.description}</div>
          </a>
        ))}
      </section>
    );
  }

  function renderSettings() {
    return (
      <section className="screen settings-screen">
        <div className="settings-card">
          <div className="settings-row">
            <div>
              <div className="settings-row-label">JĂ„â„˘zyk</div>
              <div className="settings-row-sub">JĂ„â„˘zyk interfejsu</div>
            </div>
            <select value={settings.language} onChange={e => setSettings(p => ({ ...p, language: e.target.value === 'en' ? 'en' : 'pl' }))}>
              <option value="pl">Polski</option>
              <option value="en">English</option>
            </select>
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-row-label">Powiadomienia</div>
              <div className="settings-row-sub">WÄąâ€šĂ„â€¦cz push notifications</div>
            </div>
            <Toggle checked={settings.notificationsEnabled} onChange={v => setSettings(p => ({ ...p, notificationsEnabled: v }))} />
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-row-label">OdÄąâ€şwieÄąÄ˝anie</div>
              <div className="settings-row-sub">InterwaÄąâ€š synchronizacji</div>
            </div>
            <select value={settings.refreshMinutes} onChange={e => setSettings(p => ({ ...p, refreshMinutes: Number(e.target.value) as 30|60|120 }))}>
              <option value={30}>30 min</option>
              <option value={60}>60 min</option>
              <option value={120}>120 min</option>
            </select>
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-row-label">Kompaktowy plan</div>
              <div className="settings-row-sub">Mniejsza wysokoÄąâ€şĂ„â€ˇ godzin</div>
            </div>
            <Toggle checked={settings.compactPlan} onChange={v => setSettings(p => ({ ...p, compactPlan: v }))} />
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-row-label">Grupowanie ocen</div>
              <div className="settings-row-sub">Widok ocen pogrupowany po przedmiocie</div>
            </div>
            <Toggle checked={settings.gradesGrouping} onChange={v => setSettings(p => ({ ...p, gradesGrouping: v }))} />
          </div>
        </div>
      </section>
    );
  }

  function renderAbout() {
    return (
      <section className="screen about-screen">
        <div className="about-hero card">
          <img src={LOGO_SRC} alt="Logo mZUT v2" className="about-logo-img" />
          <div className="about-app-name">mZUT v2</div>
          <div className="about-version">v1.2.0 (PWA)</div>
          <div className="about-note">Wersja progresywnej aplikacji webowej</div>
        </div>

        <div className="about-actions">
          <a href="https://play.google.com/store/apps/details?id=pl.kejlo.mzutv2" target="_blank" rel="noreferrer" className="about-action-card">
            <div className="about-action-icon" style={{ background: '#26FFA000' }}>Ă˘Â­Â</div>
            <div className="about-action-content">
              <div className="about-action-title">OceÄąâ€ž aplikacjĂ„â„˘</div>
              <div className="about-action-desc">Twoja opinia pomaga nam rozwijaĂ„â€ˇ mZUT!</div>
            </div>
            <div className="about-action-arrow">Ă˘â€ â€™</div>
          </a>

          <a href="https://github.com/Kejlo523/mzut-v2" target="_blank" rel="noreferrer" className="about-action-card">
            <div className="about-action-icon" style={{ background: 'var(--mz-border-soft)', color: 'var(--mz-text)' }}>Ä‘Ĺşâ€śĹĄ</div>
            <div className="about-action-content">
              <div className="about-action-title">Kod ÄąĹźrÄ‚Ĺ‚dÄąâ€šowy</div>
              <div className="about-action-desc">SprawdÄąĹź projekt na GitHubie</div>
            </div>
            <div className="about-action-arrow">Ă˘â€ â€™</div>
          </a>
        </div>

        <div className="about-links">
          <a href="https://mzut.endozero.pl" target="_blank" rel="noreferrer" className="about-link-item">
            <span className="about-link-icon">Ă˘â€žÄ…ÄŹÂ¸Ĺą</span>
            <span className="about-link-text">Strona projektu: mzut.endozero.pl</span>
            <span className="about-link-arrow">Ă˘â€ â€™</span>
          </a>

          <a href="https://endozero.pl" target="_blank" rel="noreferrer" className="about-link-item">
            <span className="about-link-icon">Ä‘Ĺşâ€Â¤</span>
            <span className="about-link-text">Strona autora: endozero.pl</span>
            <span className="about-link-arrow">Ă˘â€ â€™</span>
          </a>

          <a href="https://mzut.endozero.pl/privacy_policy.html" target="_blank" rel="noreferrer" className="about-link-item">
            <span className="about-link-icon">Ä‘Ĺşâ€ťâ€™</span>
            <span className="about-link-text">Polityka prywatnoÄąâ€şci</span>
            <span className="about-link-arrow">Ă˘â€ â€™</span>
          </a>

          <a href="mailto:kejlo@endozero.pl" className="about-link-item">
            <span className="about-link-icon">Ä‘Ĺşâ€śÂ§</span>
            <span className="about-link-text">E-mail: kejlo@endozero.pl</span>
            <span className="about-link-arrow">Ă˘â€ â€™</span>
          </a>
        </div>

        <div className="about-description">
          <p>mZUT v2 zostaÄąâ€š stworzony jako nieoficjalna, lekka alternatywa do szybkiego podglĂ„â€¦du planu, ocen i informacji o studiach na ZUT, bez koniecznoÄąâ€şci przeklikiwania siĂ„â„˘ przez ciĂ„â„˘ÄąÄ˝kie panele www.</p>
          <p style={{ marginTop: '12px', opacity: 0.8, fontSize: '12px' }}>Made with Ă˘ĹĄÂ¤ÄŹÂ¸Ĺą by Kejlo</p>
        </div>
      </section>
    );
  }

  function renderPlanEventSheet() {
    if (!selectedPlanEvent) return null;
    const { date, event } = selectedPlanEvent;

    return (
      <div className="event-sheet-overlay" onClick={() => setSelectedPlanEvent(null)}>
        <div className="event-sheet" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="SzczegÄ‚Ĺ‚Äąâ€šy zajĂ„â„˘Ă„â€ˇ">
          <div className="event-sheet-handle" />
          <div className={`event-sheet-type-badge ev-${event.typeClass}`}>{event.typeLabel || 'ZajĂ„â„˘cia'}</div>
          <div className="event-sheet-title">{event.title}</div>
          <div className="event-sheet-row">
            <Ic n="clock" />
            <span>{fmtDateLabel(date)} Ă‚Â· {event.startStr} - {event.endStr}</span>
          </div>
          {!!event.room && (
            <div className="event-sheet-row">
              <Ic n="location" />
              <span>Sala: {event.room}</span>
            </div>
          )}
          {!!event.group && (
            <div className="event-sheet-row">
              <Ic n="group" />
              <span>Grupa: {event.group}</span>
            </div>
          )}
          {!!event.teacher && (
            <div className="event-sheet-row">
              <Ic n="user" />
              <span>{event.teacher}</span>
            </div>
          )}
          <button type="button" className="event-sheet-close" onClick={() => setSelectedPlanEvent(null)}>
            Zamknij
          </button>
        </div>
      </div>
    );
  }

  function renderPlanSearchSheet() {
    if (!planSearchOpen) return null;

    const handleQueryChange = (value: string) => {
      setPlanSearchQ(value);

      // Clear existing debounce timer
      if (planSearchDebounceRef.current) {
        clearTimeout(planSearchDebounceRef.current);
      }

      // For album category, don't fetch suggestions
      if (planSearchCat === 'album') {
        setPlanSearchSuggestions([]);
        return;
      }

      // Debounce suggestion fetching (300ms)
      planSearchDebounceRef.current = setTimeout(() => {
        if (value.trim()) {
          void fetchPlanSearchSuggestions(planSearchCat, value.trim());
        } else {
          setPlanSearchSuggestions([]);
        }
      }, 300);
    };

    const handleCategoryChange = (newCat: string) => {
      setPlanSearchCat(newCat);
      setPlanSearchSuggestions([]);
      if (planSearchQ.trim() && newCat !== 'album') {
        if (planSearchDebounceRef.current) {
          clearTimeout(planSearchDebounceRef.current);
        }
        planSearchDebounceRef.current = setTimeout(() => {
          void fetchPlanSearchSuggestions(newCat, planSearchQ.trim());
        }, 300);
      }
    };

    const handleSuggestionClick = (suggestion: string) => {
      setPlanSearchQ(suggestion);
      setPlanSearchSuggestions([]);
    };

    const handleSearch = () => {
      if (planSearchQ.trim()) {
        void loadPlanData({ category: planSearchCat, query: planSearchQ.trim() });
        setPlanSearchOpen(false);
      }
    };

    const handleClear = () => {
      setPlanSearchQ('');
      setPlanSearchSuggestions([]);
      void loadPlanData();
      setPlanSearchOpen(false);
    };

    return (
      <div className="event-sheet-overlay" onClick={() => setPlanSearchOpen(false)}>
        <div className="event-sheet search-sheet" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Szukaj w planie">
          <div className="event-sheet-handle" />
          <div className="search-container">
            <h2 className="search-title">Szukaj w planie</h2>

            {/* Category row */}
            <div className="search-field-group">
              <label className="search-label">Kategoria</label>
              <select
                value={planSearchCat}
                onChange={e => handleCategoryChange(e.target.value)}
                className="search-select"
              >
                <option value="album">Album</option>
                <option value="teacher">ProwadzĂ„â€¦cy</option>
                <option value="group">Grupa</option>
                <option value="room">Sala</option>
                <option value="subject">Przedmiot</option>
              </select>
            </div>

            {/* Query row with spinner */}
            <div className="search-field-group">
              <label className="search-label">Wyszukaj</label>
              <div className="search-input-wrapper">
                <input
                  type="text"
                  value={planSearchQ}
                  onChange={e => handleQueryChange(e.target.value)}
                  placeholder="Wpisz aby szukaĂ„â€ˇ..."
                  className="search-input"
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
                {planSearchLoading && <span className="search-spinner-inline" />}
              </div>
            </div>

            {/* Suggestions list */}
            {(planSearchSuggestions.length > 0 || (!planSearchQ.trim() && planSearchCat !== 'album')) && (
              <div className="search-suggestions-container">
                {planSearchSuggestions.length > 0 ? (
                  planSearchSuggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="search-suggestion-item"
                      onClick={() => handleSuggestionClick(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))
                ) : planSearchCat !== 'album' && !planSearchQ.trim() ? (
                  <div className="search-placeholder">Wpisz aby szukaĂ„â€ˇ</div>
                ) : null}
              </div>
            )}

            {/* Action buttons */}
            <div className="search-actions">
              <button
                type="button"
                className="search-btn-primary"
                onClick={handleSearch}
                disabled={!planSearchQ.trim()}
              >
                Szukaj
              </button>
              <button
                type="button"
                className="search-btn-secondary"
                onClick={handleClear}
              >
                WyczyÄąâ€şĂ„â€ˇ
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderScreen() {
    switch (screen) {
      case 'login':       return renderLogin();
      case 'home':        return renderHome();
      case 'plan':        return renderPlan();
      case 'grades':      return renderGrades();
      case 'info':        return renderInfo();
      case 'news':        return renderNews();
      case 'news-detail': return renderNewsDetail();
      case 'links':       return renderLinks();
      case 'settings':    return renderSettings();
      case 'about':       return renderAbout();
      default:            return null;
    }
  }

  // Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬ AppBar action buttons Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬
  function renderAppBarActions() {
    if (screen === 'login') return null;
    const actions: Array<{ key: string; icon: string; label: string; onClick: () => void; active: boolean }> = [];

    if (screen === 'plan') {
      actions.push({ key: 'search', icon: 'search', label: 'Szukaj w planie', onClick: () => setPlanSearchOpen(p => !p), active: planSearchOpen });
      actions.push({ key: 'refresh', icon: 'refresh', label: 'OdÄąâ€şwieÄąÄ˝', onClick: () => void loadPlanData(undefined, true), active: false });
    } else if (screen === 'grades') {
      actions.push({ key: 'refresh', icon: 'refresh', label: 'OdÄąâ€şwieÄąÄ˝', onClick: () => void loadGradesData(false, true), active: false });
    } else if (screen === 'info') {
      actions.push({ key: 'refresh', icon: 'refresh', label: 'OdÄąâ€şwieÄąÄ˝', onClick: () => void loadInfoData(true), active: false });
    } else if (screen === 'news') {
      actions.push({ key: 'refresh', icon: 'refresh', label: 'OdÄąâ€şwieÄąÄ˝', onClick: () => void loadNewsData(true), active: false });
    }

    return (
      <div className="appbar-actions">
        {screen === 'grades' && (
          <div className="grades-grouping-toggle">
            <button
              type="button"
              className={`grades-toggle-compact ${settings.gradesGrouping ? 'active' : ''}`}
              onClick={() => setSettings(prev => ({ ...prev, gradesGrouping: !prev.gradesGrouping }))}
              title={settings.gradesGrouping ? 'WyÄąâ€šĂ„â€¦cz grupowanie' : 'WÄąâ€šĂ„â€¦cz grupowanie'}
              aria-label="Grupowanie przedmiotÄ‚Ĺ‚w"
            >
              <Ic n="group"/>
            </button>
          </div>
        )}
        {actions.map(a => (
          <button key={a.key} type="button" className={`icon-btn ${a.active ? 'active' : ''}`} onClick={a.onClick} aria-label={a.label} title={a.label}>
            <Ic n={a.icon}/>
          </button>
        ))}
      </div>
    );
  }

  // Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬ render Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬
  return (
    <div
      className="app-shell"
      onPointerDown={swipe.onPointerDown}
      onPointerMove={swipe.onPointerMove}
      onPointerUp={swipe.onPointerUp}
      onPointerCancel={swipe.onPointerCancel}
    >
      {/* AppBar */}
      {screen !== 'login' && (
        <header className="android-appbar">
          <button type="button" className="icon-btn" onClick={screen === 'news-detail' ? nav.goBack : onNavIcon} aria-label={screen === 'news-detail' ? 'WrÄ‚Ĺ‚Ă„â€ˇ' : 'OtwÄ‚Ĺ‚rz menu'}>
            <Ic n={screen === 'news-detail' ? 'back' : 'menu'}/>
          </button>
          <h1>{screenTitle(screen)}</h1>
          {renderAppBarActions()}
        </header>
      )}

      {/* Global loading / error banners */}
      {globalLoading && (
        <div className="banner">
          <div className="spinner" style={{width:16,height:16,borderWidth:2}}/>
          ÄąÂadowanie danychĂ˘â‚¬Â¦
        </div>
      )}
      {globalError && (
        <div className="banner error">
          <Ic n="info"/>
          <span style={{flex:1}}>{globalError}</span>
          <button type="button" className="banner-retry" onClick={() => setGlobalError('')}>OK</button>
        </div>
      )}

      {/* Main content */}
      <main>
        {renderScreen()}
      </main>

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}

      {renderPlanEventSheet()}
      {renderPlanSearchSheet()}

      {/* Navigation Drawer */}
      {screen !== 'login' && (
        <div className={`app-drawer ${drawerOpen ? 'open' : ''}`} aria-hidden={!drawerOpen} aria-modal={drawerOpen}>
          <button type="button" className="drawer-backdrop" onClick={() => setDrawerOpen(false)} aria-label="Zamknij menu"/>
          <aside className="drawer-panel" role="navigation" aria-label="Nawigacja gÄąâ€šÄ‚Ĺ‚wna">
            <div className="drawer-header">
              <img src={LOGO_SRC} alt="mZUT v2" className="drawer-header-logo" />
              <div className="drawer-header-info">
                <div className="drawer-header-title">mZUT v2</div>
                <div className="drawer-header-user">{session?.username || 'Student'}</div>
              </div>
            </div>

            <div className="drawer-divider"/>

            <div className="drawer-list">
              {drawerItems.map(item => (
                <button key={item.key} type="button" className={`drawer-item ${screen === item.key ? 'active' : ''}`} onClick={() => openScreen(item.key)}>
                  <span className="drawer-item-icon"><Ic n={item.icon}/></span>
                  {item.label}
                </button>
              ))}
            </div>

            <div className="drawer-footer">
              <button type="button" className="drawer-logout" onClick={() => { if (window.confirm('Czy na pewno chcesz siĂ„â„˘ wylogowaĂ„â€ˇ?')) { applySession(null); setDrawerOpen(false); } }}>
                <Ic n="logout"/>
                Wyloguj siĂ„â„˘
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

export default App;
