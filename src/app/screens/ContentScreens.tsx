import type { Dispatch, SetStateAction } from 'react';

import type { NewsItem, UsefulLink } from '../../types';
import type { AppSettings } from '../../services/storage';
import type { TranslateFn } from '../viewTypes';
import { LOGO_SRC } from '../constants';
import { Ic, Spinner, Toggle } from '../ui';

interface NewsScreenProps {
  newsLoading: boolean;
  news: NewsItem[];
  t: TranslateFn;
  onOpenDetail: (item: NewsItem) => void;
}

export function NewsScreen({ newsLoading, news, t, onOpenDetail }: NewsScreenProps) {
  return (
    <section className="screen news-screen">
      {newsLoading && <Spinner text={t('news.loading')} />}
      {!newsLoading && news.length === 0 && (
        <div className="empty-state"><div className="empty-state-icon">📰</div><p>{t('news.empty')}</p></div>
      )}
      <div className="list-stack">
        {news.map((item) => (
          <button key={item.id} type="button" className="news-card" onClick={() => onOpenDetail(item)}>
            {item.thumbUrl ? (
              <img src={item.thumbUrl} alt="" className="news-thumb" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).replaceWith(Object.assign(document.createElement('div'), { className: 'news-thumb-placeholder', innerHTML: '<svg viewBox="0 0 24 24" aria-hidden><path fill="currentColor" d="M4 22h16a2 2 0 002-2V4a2 2 0 00-2-2H4a2 2 0 00-2 2v16a2 2 0 002 2zm0 0a2 2 0 01-2-2v-9c0-1.1.9-2 2-2h2"/><path fill="currentColor" d="M18 14h-8M15 18h-5M10 6h8v4h-8z"/></svg>' })); }} />
            ) : (
              <div className="news-thumb-placeholder"><Ic n="news" /></div>
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

interface NewsDetailScreenProps {
  item?: NewsItem;
  t: TranslateFn;
}

export function NewsDetailScreen({ item, t }: NewsDetailScreenProps) {
  if (!item) {
    return <section className="screen news-detail-screen"><div className="empty-state"><p>{t('newsDetail.noContent')}</p></div></section>;
  }

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
          {t('newsDetail.openBrowser')} ↗
        </a>
      )}
    </section>
  );
}

interface LinksScreenProps {
  links: UsefulLink[];
  t: TranslateFn;
}

export function LinksScreen({ links, t }: LinksScreenProps) {
  const globals = links.filter((l) => l.scope === 'GLOBAL');
  const faculties = links.filter((l) => l.scope === 'FACULTY');

  return (
    <section className="screen links-screen">
      {faculties.length > 0 && <div className="link-category">{t('links.faculty')}</div>}
      {faculties.map((l) => (
        <a key={l.id} href={l.url} target="_blank" rel="noreferrer" className="link-card">
          <div className="link-card-title">{l.title}</div>
          <div className="link-card-desc">{l.description}</div>
        </a>
      ))}
      <div className="link-category">{t('links.university')}</div>
      {globals.map((l) => (
        <a key={l.id} href={l.url} target="_blank" rel="noreferrer" className="link-card">
          <div className="link-card-title">{l.title}</div>
          <div className="link-card-desc">{l.description}</div>
        </a>
      ))}
    </section>
  );
}

interface SettingsScreenProps {
  settings: AppSettings;
  setSettings: Dispatch<SetStateAction<AppSettings>>;
  t: TranslateFn;
}

export function SettingsScreen({ settings, setSettings, t }: SettingsScreenProps) {
  return (
    <section className="screen settings-screen">
      <div className="settings-card">
        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t('settings.language')}</div>
            <div className="settings-row-sub">{t('settings.languageSub')}</div>
          </div>
          <select value={settings.language} onChange={(e) => setSettings((p) => ({ ...p, language: e.target.value as 'pl' | 'en' }))}>
            <option value="pl">Polski</option>
            <option value="en">English</option>
          </select>
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t('settings.refresh')}</div>
            <div className="settings-row-sub">{t('settings.refreshSub')}</div>
          </div>
          <select value={settings.refreshMinutes} onChange={(e) => setSettings((p) => ({ ...p, refreshMinutes: Number(e.target.value) as 30 | 60 | 120 }))}>
            <option value={30}>30 min</option>
            <option value={60}>60 min</option>
            <option value={120}>120 min</option>
          </select>
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t('settings.compactPlan')}</div>
            <div className="settings-row-sub">{t('settings.compactPlanSub')}</div>
          </div>
          <Toggle checked={settings.compactPlan} onChange={(v) => setSettings((p) => ({ ...p, compactPlan: v }))} />
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t('settings.gradeGroup')}</div>
            <div className="settings-row-sub">{t('settings.gradeGroupSub')}</div>
          </div>
          <Toggle checked={settings.gradesGrouping} onChange={(v) => setSettings((p) => ({ ...p, gradesGrouping: v }))} />
        </div>
      </div>
    </section>
  );
}

interface AboutScreenProps {
  canOfferInstall: boolean;
  handleInstallPwa: () => Promise<void> | void;
  isIosSafari: boolean;
  t: TranslateFn;
}

export function AboutScreen({ canOfferInstall, handleInstallPwa, isIosSafari, t }: AboutScreenProps) {
  return (
    <section className="screen about-screen">
      <div className="about-hero card">
        <img src={LOGO_SRC} alt="Logo mZUT v2" className="about-logo-img" />
        <div className="about-app-name">mZUT v2</div>
        <div className="about-version">v1.2.0 (PWA)</div>
        <div className="about-note">{t('about.pwaNote')}</div>
      </div>

      {canOfferInstall && (
        <button type="button" className="about-action-card about-install-card" onClick={() => void handleInstallPwa()}>
          <div className="about-action-icon" style={{ background: '#1976d2', color: '#fff' }}>📲</div>
          <div className="about-action-content">
            <div className="about-action-title">{t('about.installApp')}</div>
            <div className="about-action-desc">
              {isIosSafari ? t('about.installIos') : t('about.installAndroid')}
            </div>
          </div>
          <div className="about-action-arrow">→</div>
        </button>
      )}

      <div className="about-actions">
        <a href="https://play.google.com/store/apps/details?id=pl.kejlo.mzutv2" target="_blank" rel="noreferrer" className="about-action-card">
          <div className="about-action-icon" style={{ background: '#26FFA000' }}>⭐</div>
          <div className="about-action-content">
            <div className="about-action-title">{t('about.rateApp')}</div>
            <div className="about-action-desc">{t('about.rateDesc')}</div>
          </div>
          <div className="about-action-arrow">→</div>
        </a>

        <a href="https://github.com/Kejlo523/mzut-v2" target="_blank" rel="noreferrer" className="about-action-card">
          <div className="about-action-icon" style={{ background: 'var(--mz-border-soft)', color: 'var(--mz-text)' }}>📝</div>
          <div className="about-action-content">
            <div className="about-action-title">{t('about.sourceCode')}</div>
            <div className="about-action-desc">{t('about.sourceDesc')}</div>
          </div>
          <div className="about-action-arrow">→</div>
        </a>
      </div>

      <div className="about-links">
        <a href="https://mzut.endozero.pl" target="_blank" rel="noreferrer" className="about-link-item">
          <span className="about-link-icon">ℹ️</span>
          <span className="about-link-text">{t('about.projectSite')}</span>
          <span className="about-link-arrow">→</span>
        </a>

        <a href="https://endozero.pl" target="_blank" rel="noreferrer" className="about-link-item">
          <span className="about-link-icon">👤</span>
          <span className="about-link-text">{t('about.authorSite')}</span>
          <span className="about-link-arrow">→</span>
        </a>

        <a href="https://mzut.endozero.pl/privacy_policy.html" target="_blank" rel="noreferrer" className="about-link-item">
          <span className="about-link-icon">🔒</span>
          <span className="about-link-text">{t('about.privacyPolicy')}</span>
          <span className="about-link-arrow">→</span>
        </a>

        <a href="mailto:kejlo@endozero.pl" className="about-link-item">
          <span className="about-link-icon">📧</span>
          <span className="about-link-text">E-mail: kejlo@endozero.pl</span>
          <span className="about-link-arrow">→</span>
        </a>
      </div>

      <div className="about-description">
        <p>{t('about.description')}</p>
        <p style={{ marginTop: '12px', opacity: 0.8, fontSize: '12px' }}>Made with ❤️ by Kejlo</p>
      </div>
    </section>
  );
}
