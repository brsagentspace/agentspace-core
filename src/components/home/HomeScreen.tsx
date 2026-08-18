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
import { Plus, Trash2, FolderGit2 } from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';
import { createProject, openProject } from '../../services/projectController';
import './HomeScreen.css';

const BLUEPRINTS = [
  'web-nextjs-fullstack',
  'backend-node-microservice',
  'backend-rust-service',
  'ml-python-pipeline',
  'mobile-react-native',
  'marketing-gtm-agent',
];

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
  const { projects, agentsByProject, deleteProject } = useProjectStore();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [blueprint, setBlueprint] = useState(BLUEPRINTS[0]);
  const [starterTeam, setStarterTeam] = useState(true);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    createProject(trimmed, blueprint, starterTeam);
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
                  <FolderGit2 size={15} />
                  <span className="home-card-name">{p.name}</span>
                  <button
                    className="home-card-delete"
                    title={t('home.delete_tooltip')}
                    onClick={(e) => { e.stopPropagation(); deleteProject(p.id); }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <span className="home-card-blueprint">{p.blueprint}</span>
                <div className="home-card-meta">
                  <span>{t('home.agents_count', { count: (agentsByProject[p.id] ?? []).length })}</span>
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

            <label className="home-label">{t('home.blueprint_label')}</label>
            <div className="home-blueprints">
              {BLUEPRINTS.map(bp => (
                <button
                  key={bp}
                  className={`home-bp ${bp === blueprint ? 'selected' : ''}`}
                  onClick={() => setBlueprint(bp)}
                >
                  {bp}
                </button>
              ))}
            </div>

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
