import type { Dispatch, SetStateAction } from 'react';

import type {
  CalendarEvent,
  ElsCard,
  Grade,
  Semester,
  SessionData,
  Study,
  StudyDetails,
  StudyHistoryItem,
} from '../../types';
import type { AppSettings } from '../../services/storage';
import type { GroupedGradeView, TranslateFn } from '../viewTypes';
import { fmtDec, gradeTone, initials, isFinalGradeType } from '../helpers';
import { Ic, Spinner } from '../ui';

interface GradesScreenProps {
  t: TranslateFn;
  gradesSummary: { avg: string; ects: string };
  totalEctsAll: number;
  studies: Study[];
  activeStudyId: string | null;
  updateActiveStudy: (studyId: string | null) => void;
  semesters: Semester[];
  selSemId: string;
  setSelSemId: Dispatch<SetStateAction<string>>;
  gradesLoading: boolean;
  grades: Grade[];
  settings: AppSettings;
  groupedGrades: GroupedGradeView[];
  expandedGradeSubjects: Record<string, boolean>;
  setExpandedGradeSubjects: Dispatch<SetStateAction<Record<string, boolean>>>;
}

export function GradesScreen({
  t,
  gradesSummary,
  totalEctsAll,
  studies,
  activeStudyId,
  updateActiveStudy,
  semesters,
  selSemId,
  setSelSemId,
  gradesLoading,
  grades,
  settings,
  groupedGrades,
  expandedGradeSubjects,
  setExpandedGradeSubjects,
}: GradesScreenProps) {
  return (
    <section className="screen grades-screen">
      <div className="grades-header-wrapper">
        <div className="grades-hero">
          <div className="metrics-row">
            <div className="metric-card"><div className="metric-label">{t('grades.avg')}</div><div className="metric-value">{gradesSummary.avg}</div></div>
            <div className="metric-card"><div className="metric-label">{t('grades.ectsSem')}</div><div className="metric-value">{gradesSummary.ects}</div></div>
            <div className="metric-card"><div className="metric-label">{t('grades.ectsTotal')}</div><div className="metric-value">{Math.round(Math.max(0, totalEctsAll))}</div></div>
          </div>
        </div>

        <div className="grades-filters-container">
          <div className="grades-filters">
            {studies.length > 0 && (
              <label className="field-label">
                {t('grades.studyField')}
                <select value={activeStudyId ?? ''} onChange={(e) => updateActiveStudy(e.target.value || null)}>
                  {studies.map((s) => <option key={s.przynaleznoscId} value={s.przynaleznoscId}>{s.label}</option>)}
                </select>
              </label>
            )}
            {semesters.length > 0 && (
              <label className="field-label">
                {t('grades.semLabel')}
                <select value={selSemId} onChange={(e) => setSelSemId(e.target.value)}>
                  {semesters.map((s) => (
                    <option key={s.listaSemestrowId} value={s.listaSemestrowId}>
                      {t('grades.semOption')} {s.nrSemestru} ({t(`period.${s.pora.toLowerCase()}`) || s.pora}) {s.rokAkademicki}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>
      </div>

      <div className="grades-surface">
        {gradesLoading && <Spinner text={t('grades.loading')} />}
        {!gradesLoading && grades.length === 0 && (
          <div className="empty-state"><div className="empty-state-icon">🎓</div><p>{t('grades.noGrades')}</p></div>
        )}

        <div className="list-stack">
          {settings.gradesGrouping ? (
            groupedGrades.map(({ subject, items, finalGrade, ects }) => {
              const isOpen = !!expandedGradeSubjects[subject];
              const detailItems = items.filter((g) => !isFinalGradeType(g.type, g.subjectName));
              const visibleItems = detailItems.length > 0 ? detailItems : items;
              const previewItems = visibleItems.slice(0, 3);
              const previewOverflow = Math.max(0, visibleItems.length - previewItems.length);
              return (
                <div key={subject} className={`grade-group${isOpen ? ' is-open' : ''}`}>
                  <button
                    type="button"
                    className="grade-group-head"
                    onClick={() => setExpandedGradeSubjects((prev) => ({ ...prev, [subject]: !prev[subject] }))}
                    aria-expanded={isOpen}
                  >
                    <div className="grade-group-head-main">
                      <div className="grade-group-icon"><Ic n="grade" /></div>
                      <div className="grade-group-name-wrap">
                        <div className="grade-group-name">{subject}</div>
                      </div>
                    </div>
                    <div className="grade-group-side">
                      <div className="grade-group-summary">
                        <div className={`grade-group-pill ${gradeTone(finalGrade)}`}>{finalGrade || '–'}</div>
                        <div className="grade-group-summary-copy">
                          <span>{t('grades.finalGrade')}</span>
                          {ects > 0 && <span>{fmtDec(ects, 1)} ECTS</span>}
                        </div>
                      </div>
                      <div className={`grade-group-chevron ${isOpen ? 'open' : ''}`}><Ic n="chevR" /></div>
                    </div>
                  </button>

                  {!isOpen && visibleItems.length > 0 && (
                    <div className="grade-group-preview">
                      {previewItems.map((g, i) => (
                        <span
                          key={`${subject}-preview-${i}`}
                          className={`grade-preview-pill ${gradeTone(g.grade)}`}
                        >
                          {g.grade || '–'}
                        </span>
                      ))}
                      {previewOverflow > 0 && (
                        <span className="grade-preview-pill count">+{previewOverflow}</span>
                      )}
                    </div>
                  )}

                  <div className={`grade-group-items-wrap ${isOpen ? 'open' : ''}`} aria-hidden={!isOpen}>
                    <div className="grade-group-items">
                      {visibleItems.map((g, i) => (
                        <div key={`${subject}-${i}`} className="grade-row">
                          <span className={`grade-pill ${gradeTone(g.grade)}`}>{g.grade || '–'}</span>
                          <div className="grade-info">
                            <div className="grade-type-chip">{isFinalGradeType(g.type) ? t('grades.finalGrade') : (g.type || t('grades.component'))}</div>
                            {g.date && <div className="grade-date-teacher">{g.date}</div>}
                            {g.teacher && <div className="grade-date-teacher grade-date-teacher-secondary">{g.teacher}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="grade-group">
              {grades.map((g, i) => (
                <div key={`flat-${i}-${g.subjectName}`} className="grade-row grade-row-flat">
                  <div className="grade-flat-top">
                    <div className="grade-flat-subject">{g.subjectName || t('grades.subject')}</div>
                    <span className={`grade-pill ${gradeTone(g.grade)}`}>{g.grade || '–'}</span>
                  </div>
                  <div className="grade-flat-meta">
                    <div className="grade-type-chip">{isFinalGradeType(g.type) ? t('grades.finalGrade') : (g.type || t('grades.component'))}</div>
                    <div className="grade-date-teacher">
                      {g.date || '–'}{g.teacher ? ` · ${g.teacher}` : ''}
                    </div>
                    {g.weight > 0 && <div className="grade-ects-chip">{fmtDec(g.weight, 1)} ECTS</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

interface InfoScreenProps {
  session: SessionData | null;
  studies: Study[];
  activeStudyId: string | null;
  updateActiveStudy: (studyId: string | null) => void;
  studentPhotoBlobUrl: string | null;
  studentPhotoError: boolean;
  t: TranslateFn;
  infoLoading: boolean;
  details: StudyDetails | null;
  history: StudyHistoryItem[];
  els: ElsCard | null;
  calendarEvents: CalendarEvent[];
}

export function InfoScreen({
  session,
  studies,
  activeStudyId,
  updateActiveStudy,
  studentPhotoBlobUrl,
  studentPhotoError,
  t,
  infoLoading,
  details,
  history,
  els,
  calendarEvents,
}: InfoScreenProps) {
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
                  alt={t('info.photoAlt')}
                  className="info-profile-photo"
                />
              ) : (
                <div className="info-profile-fallback">{initials(session.username || 'S')}</div>
              )}
              <div className="info-profile-meta">
                <div className="info-profile-name">{session.username || t('info.studentNameFallback')}</div>
                <div className="info-profile-id">{t('info.userId')}: {session.userId || '-'}</div>
              </div>
            </div>
          )}

          {studies.length > 0 && (
            <label className="field-label info-study-select">
              {t('info.studyField')}
              <select value={activeStudyId ?? ''} onChange={(e) => updateActiveStudy(e.target.value || null)}>
                {studies.map((s) => <option key={s.przynaleznoscId} value={s.przynaleznoscId}>{s.label}</option>)}
              </select>
            </label>
          )}
        </aside>
      )}

      <div className="info-main">
        {infoLoading && <Spinner text={t('info.loading')} />}
        {details && (
          <div className="info-card">
            {([
              { l: t('info.detailAlbum'), v: details.album },
              { l: t('info.detailFaculty'), v: details.wydzial },
              { l: t('info.detailField'), v: details.kierunek },
              { l: t('info.detailForm'), v: details.forma },
              { l: t('info.detailLevel'), v: details.poziom },
              { l: t('info.detailSpecialty'), v: details.specjalnosc },
              { l: t('info.detailSpecialization'), v: details.specjalizacja },
              { l: t('info.detailStatus'), v: details.status },
              { l: t('info.detailYear'), v: details.rokAkademicki },
              { l: t('info.detailSem'), v: details.semestrLabel },
            ].filter((r) => r.v)).map((r) => (
              <div key={r.l} className="info-row">
                <div className="info-row-label">{r.l}</div>
                <div className="info-row-value">{r.v}</div>
              </div>
            ))}
          </div>
        )}
        {history.length > 0 && (
          <div className="info-card info-history-card">
            <div className="info-card-head">{t('info.studyHistory')}</div>
            {history.map((h, i) => (
              <div key={i} className="history-row">
                <span className="history-label">{h.label}</span>
                <span className="history-status">{h.status}</span>
              </div>
            ))}
          </div>
        )}

        {els && (
          <div className="info-card">
            <div className="info-card-head">Legitymacja Elektroniczna (ELS)</div>
            <div className="info-row">
              <div className="info-row-label">Status</div>
              <div className="info-row-value">
                <span className={`grade-pill ${els.isActive ? 'ok' : 'bad'}`} style={{ padding: '4px 8px', fontSize: '13px' }}>
                  {els.isActive ? 'Aktywna' : 'Nieaktywna'}
                </span>
              </div>
            </div>
            <div className="info-row">
              <div className="info-row-label">Ważna do</div>
              <div className="info-row-value">{els.expirationDate}</div>
            </div>
          </div>
        )}

        {calendarEvents.length > 0 && (
          <div className="info-card">
            <div className="info-card-head">Kalendarz Akademicki (30 dni)</div>
            {calendarEvents.map((ev, i) => (
              <div key={i} className="history-row" style={{ alignItems: 'flex-start', padding: '12px 16px' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div className="history-label">{ev.name}</div>
                  <div className="history-status" style={{ fontSize: '12px', opacity: 0.8, textAlign: 'left' }}>
                    {ev.startDate === ev.endDate ? ev.startDate : `${ev.startDate} – ${ev.endDate}`}
                  </div>
                </div>
                {ev.isDayOff && (
                  <span className="grade-pill ok" style={{ padding: '2px 6px', fontSize: '11px', alignSelf: 'center' }}>
                    Dzień wolny
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        {!infoLoading && !details && (
          <div className="empty-state"><div className="empty-state-icon">👤</div><p>{t('info.empty')}</p></div>
        )}
      </div>
    </section>
  );
}
