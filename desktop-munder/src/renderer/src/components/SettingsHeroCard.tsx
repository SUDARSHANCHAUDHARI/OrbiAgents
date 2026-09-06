/**
 * The hero card at the top of Settings → General.
 *
 * One card that answers "what is this install, and what can I do about it" —
 * the running version, its local operating model, and the handful of actions
 * that do not belong to any individual setting below (release notes, source,
 * and issue reporting).
 *
 * The identity copy is compiled into the application so Settings remains local,
 * deterministic, and free from remote promotions or sponsorship changes.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PixelButton } from './PixelButton';
import { Icon } from './Icon';
import { DEFAULT_HERO } from '@shared/heroPayload';
import { manualDownloadUrl, pendingVersion, reduceStatus, type UpdateStatus } from '@shared/updateState';

const GITHUB_REPO_URL = 'https://github.com/SUDARSHANCHAUDHARI/OrbiAgents';
// No upstream promotion or community-advertising destinations belong here.

export function SettingsHeroCard() {
  const { t } = useTranslation();
  const [version, setVersion] = useState<string | null>(null);
  const hero = DEFAULT_HERO;
  /** Whatever release the updater knows about, so the card can offer the
   *  manual download right where the version is shown. */
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  useEffect(() => {
    const off = window.cth.onUpdateStatus?.((next) => setStatus((prev) => reduceStatus(prev, next)));
    void window.cth.updateCurrent?.().then((cur) => {
      if (cur) setStatus((prev) => reduceStatus(prev, cur));
    }).catch(() => { /* push channel still works */ });
    return off;
  }, []);
  const pending = version ? pendingVersion(status, version) : null;
  const downloadManually = () => {
    if (!status) return;
    const url = manualDownloadUrl(status, window.cth.platform, window.cth.arch);
    if (url) void window.cth.updateOpenRelease(url);
  };

  useEffect(() => {
    let alive = true;
    window.cth.appInfo()
      .then((i) => { if (alive) setVersion(i.version); })
      .catch(() => { /* the card is still useful without it */ });
    // Product identity stays compiled-in and does not fetch promotional copy.
    return () => { alive = false; };
  }, []);

  const PLAN = hero.plan;

  /** Re-show the release notes. UpdateToast owns that surface — it holds the
   *  last status and the drop renderer — so this asks rather than duplicating
   *  it, via the same CustomEvent convention App uses for opening Settings. */
  const showReleaseNotes = () => {
    window.dispatchEvent(new CustomEvent('cth:show-release-notes'));
  };

  const INK = 'var(--cth-ink-900)';
  const MONO = 'var(--cth-font-mono, monospace)';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      background: 'var(--cth-paper-100)',
      border: `2px solid ${INK}`
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 14 }}>
        {/* Identity: name, the running version in plain sight, the plan. */}
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: 'var(--cth-font-display)', fontSize: 13, lineHeight: '20px', color: INK
            }}>ORBIAGENTS</span>
            {version && (
              <span style={{
                fontFamily: MONO, fontSize: 15, fontWeight: 700, color: INK
              }}>v{version}</span>
            )}
            <span style={{
              fontFamily: MONO, fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase',
              padding: '2px 7px', background: 'var(--cth-mint-light)',
              boxShadow: 'inset 0 0 0 1px var(--cth-mint)', color: INK
            }}>{PLAN.label}</span>
            {pending && (
              <>
                <span style={{ flex: 1 }} />
                <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--cth-ink-700)' }}>
                  v{pending} is out
                </span>
                <PixelButton variant="primary" size="sm" onClick={downloadManually}
                  title="Download the installer and replace the app yourself. Auto-update is in Updates below.">
                  download v{pending}
                </PixelButton>
              </>
            )}
          </div>
          <div style={{ marginTop: 6, fontSize: 12.5, lineHeight: 1.5, color: 'var(--cth-ink-700)', maxWidth: '64ch' }}>
            {PLAN.blurb}
          </div>
        </div>

        {/* A one-line notice (an incident, a migration heads-up), when set. */}
        {hero.notice && (
          <div style={{
            padding: '8px 10px', fontSize: 12, lineHeight: 1.5, color: INK,
            background: 'var(--cth-lemon-light)', border: `2px solid ${INK}`
          }}>{hero.notice}</div>
        )}

        {/* OrbiAgents ships without paid-plan, founder, or sponsor promotions. */}
        {/* Actions that belong to the app rather than to any setting below. */}
        <div style={{
          display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
          paddingTop: 12, borderTop: `2px solid ${INK}`
        }}>
          <PixelButton variant="secondary" size="sm" onClick={showReleaseNotes}>
            <span title={t('settingsHero.whatsNewTitle')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Icon name="sparkle" /> {t('settingsHero.whatsNew')}
            </span>
          </PixelButton>
          <PixelButton variant="secondary" size="sm" onClick={() => void window.cth.openExternal(GITHUB_REPO_URL)}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              ⭐ {t('settingsHero.starOnGitHub')}
            </span>
          </PixelButton>
          {/* Community links are added only when OrbiAgents owns the destination. */}
          <PixelButton
            variant="ghost"
            size="sm"
            onClick={() => void window.cth.openExternal(`${GITHUB_REPO_URL}/issues/new`)}
          >{t('settingsHero.reportProblem')}</PixelButton>
          <span style={{ flex: 1 }} />
          <a
            href={`${GITHUB_REPO_URL}/blob/main/CHANGELOG.md`}
            onClick={(e) => { e.preventDefault(); void window.cth.openExternal(`${GITHUB_REPO_URL}/blob/main/CHANGELOG.md`); }}
            style={{ fontSize: 12, color: 'var(--cth-ink-500)' }}
          >{t('settingsHero.fullChangelog')}</a>
        </div>
      </div>
    </div>
  );
}
