/**
 * @file HomeScreen.tsx
 * @description Project (Space) launcher — the app's entry screen.
 *
 * Shows the project grid (or an empty state with a create CTA) and the
 * new-project dialog. Opening/creating routes through projectController
 * so agent teams and terminals swap correctly.
 *
 * @module components/home
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, FolderGit2, Clapperboard, Code2, FolderOpen, AlertTriangle } from 'lucide-react';
import { useProjectStore, projectDomain } from '../../store/projectStore';
import { createProject, openProject, setProjectRootPath, removeProject } from '../../services/projectController';
import { liveTerminalCount } from '../terminal/terminalRegistry';
import { blueprintsForDomain } from '../../lib/blueprintCatalog';
import { pickDirectory } from '../../services/platform';
import type { SpaceDomain } from '../../types';
import './HomeScreen.css';

const DOMAINS: SpaceDomain[] = ['software', 'media'];

function DomainIcon({ domain, size = 15 }: { domain: SpaceDomain; size?: number }) {
  return domain === 'media' ? <Clapperboard size={size} /> : <Code2 size={size} />;
}

/** Pixel mascot: premade character idle-down frame, CSS-cropped at 3x. */
function PixelMascot() {
  return (
    <span
      className="home-mascot"
      style={{
        backgroundImage: 'url(/assets/limezu/chars/char_05.png)',
        backgroundPosition: '-864px -96px',
        backgroundSize: '2688px 1968px',
      }}
    />
  );
}

export function HomeScreen() {
  const { t } = useTranslation('layout');
  const { projects, agentsByProject } = useProjectStore();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [domain, setDomain] = useState<SpaceDomain>('software');
  const [blueprint, setBlueprint] = useState(blueprintsForDomain('software')[0].id);
  const [rootPath, setRootPath] = useState('');
  const [starterTeam, setStarterTeam] = useState(true);

  const blueprints = blueprintsForDomain(domain);

  const selectDomain = (next: SpaceDomain) => {
    setDomain(next);
    setBlueprint(blueprintsForDomain(next)[0].id);
  };

  const browseRoot = async () => {
    const picked = await pickDirectory(rootPath || undefined);
    if (picked) setRootPath(picked);
  };

  const changeRoot = async (id: string, current?: string) => {
    const picked = await pickDirectory(current || undefined);
    if (picked) setProjectRootPath(id, picked);
  };

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    createProject({ name: trimmed, blueprint, domain, rootPath, withStarterTeam: starterTeam });
  };

  return (
    <div className="home-screen">
      <div className="home-title-row">
        <span className="home-title-line" />
        <h1 className="home-title">{t('home.title')}</h1>
        <span className="home-title-line" />
      </div>

      {projects.length === 0 ? (
        <div className="home-empty">
          <PixelMascot />
          <p className="home-empty-text">{t('home.empty')}</p>
          <p className="home-empty-sub">{t('home.empty_sub')}</p>
          <button className="home-create-btn" onClick={() => setIsCreateOpen(true)}>
            <Plus size={15} /> {t('home.create')}
          </button>
        </div>
      ) : (
        <>
          <div className="home-grid">
            {projects.map(p => (
              <div key={p.id} className="home-card" onClick={() => openProject(p.id)}>
                <div className="home-card-head">
                  {p.rootPath ? <FolderGit2 size={15} /> : <DomainIcon domain={projectDomain(p)} />}
                  <span className="home-card-name">{p.name}</span>
                  <span className={`home-card-domain home-card-domain--${projectDomain(p)}`}>
                    {t(`home.domain_${projectDomain(p)}`)}
                  </span>
                  <button
                    className="home-card-action"
                    title={t('home.root_pick_tooltip')}
                    onClick={(e) => { e.stopPropagation(); void changeRoot(p.id, p.rootPath); }}
                  >
                    <FolderOpen size={13} />
                  </button>
                  <button
                    className="home-card-action home-card-delete"
                    title={t('home.delete_tooltip')}
                    onClick={(e) => { e.stopPropagation(); removeProject(p.id); }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <span className="home-card-blueprint">{p.blueprint}</span>
                {p.rootPath ? (
                  <span className="home-card-path" title={p.rootPath}>{p.rootPath}</span>
                ) : (
                  <button
                    className="home-card-path home-card-path--missing"
                    title={t('home.root_missing_tooltip')}
                    onClick={(e) => { e.stopPropagation(); void changeRoot(p.id); }}
                  >
                    <AlertTriangle size={11} /> {t('home.root_missing')}
                  </button>
                )}
                <div className="home-card-meta">
                  <span>{t('home.agents_count', { count: (agentsByProject[p.id] ?? []).length })}</span>
                  {liveTerminalCount(p.id) > 0 && (
                    <span className="home-card-live" title={t('home.live_terminals_tooltip')}>
                      ● {t('home.live_terminals', { count: liveTerminalCount(p.id) })}
                    </span>
                  )}
                  <span>{t('home.last_opened', { date: p.lastOpenedAt.slice(0, 10) })}</span>
                </div>
              </div>
            ))}
          </div>
          <button className="home-create-btn home-create-btn--floating" onClick={() => setIsCreateOpen(true)}>
            <Plus size={15} /> {t('home.create')}
          </button>
        </>
      )}

      {isCreateOpen && (
        <div className="home-modal-overlay" onClick={() => setIsCreateOpen(false)}>
          <div className="home-modal" onClick={e => e.stopPropagation()}>
            <h2>{t('home.create_title')}</h2>

            <label className="home-label">{t('home.name_label')}</label>
            <input
              className="home-input"
              value={name}
              placeholder={t('home.name_placeholder')}
              autoFocus
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
            />

            <label className="home-label">{t('home.domain_label')}</label>
            <div className="home-domains">
              {DOMAINS.map(d => (
                <button
                  key={d}
                  className={`home-domain ${d === domain ? 'selected' : ''}`}
                  onClick={() => selectDomain(d)}
                >
                  <DomainIcon domain={d} size={14} />
                  <span>{t(`home.domain_${d}`)}</span>
                  <small>{t(`home.domain_${d}_hint`)}</small>
                </button>
              ))}
            </div>

            <label className="home-label">{t('home.blueprint_label')}</label>
            <div className="home-blueprints">
              {blueprints.map(bp => (
                <button
                  key={bp.id}
                  className={`home-bp ${bp.id === blueprint ? 'selected' : ''}`}
                  onClick={() => setBlueprint(bp.id)}
                >
                  {bp.id}
                </button>
              ))}
            </div>

            <label className="home-label">{t('home.root_label')}</label>
            <div className="home-path-row">
              <input
                className="home-input"
                value={rootPath}
                placeholder={t('home.root_placeholder')}
                spellCheck={false}
                onChange={e => setRootPath(e.target.value)}
              />
              <button className="home-path-browse" type="button" onClick={browseRoot} title={t('home.root_browse')}>
                <FolderOpen size={14} />
              </button>
            </div>
            <p className="home-hint">{t('home.root_hint')}</p>

            <label className="home-check">
              <input
                type="checkbox"
                checked={starterTeam}
                onChange={e => setStarterTeam(e.target.checked)}
              />
              {t('home.starter_label')}
            </label>

            <div className="home-modal-actions">
              <button className="home-cancel" onClick={() => setIsCreateOpen(false)}>{t('home.cancel')}</button>
              <button className="home-submit" onClick={submit} disabled={!name.trim()}>{t('home.submit')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
