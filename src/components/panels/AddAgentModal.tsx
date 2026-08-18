/**
 * @file AddAgentModal.tsx
 * @description Modal for placing a new agent into the office simulation.
 *
 * Lets the user pick a role, a LimeZu premade character (rendered straight
 * from the spritesheet via CSS, pixel-perfect) and a name, then adds the
 * agent to the Zustand store — the Phaser scene picks it up automatically.
 *
 * @module components/panels
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAgentSpaceStore } from '../../store';
import { useProjectStore } from '../../store/projectStore';
import { recordProjectMemory } from '../../services/memory/projectMemory';
import { persistTeamNow } from '../../services/projectController';
import type { Agent, AgentRole } from '../../types';
import './AddAgentModal.css';

const ROLES: AgentRole[] = ['architect', 'frontend', 'backend', 'qa', 'researcher', 'data', 'ml'];
const CHAR_COUNT = 18;

/** Character sheet geometry: idle-down first frame at (288, 32), 16×32 px, ×3 zoom. */
const SHEET_W = 896;
const SHEET_H = 656;
const FRAME_X = 288;
const FRAME_Y = 32;
const ZOOM = 3;

interface AddAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddAgentModal({ isOpen, onClose }: AddAgentModalProps) {
  const { t } = useTranslation('agents');
  const addAgent = useAgentSpaceStore(s => s.addAgent);

  const [name, setName] = useState('');
  const [role, setRole] = useState<AgentRole>('frontend');
  const [charIdx, setCharIdx] = useState(0);

  if (!isOpen) return null;

  const submit = () => {
    const agent: Agent = {
      id: `agent_${Date.now()}`,
      name: name.trim() || `Agent-${Math.floor(Math.random() * 900) + 100}`,
      role,
      status: 'idle',
      color: 'blue',
      charKey: `c${charIdx + 1}`,
      modelTier: 2,
      currentTask: null,
      tokensUsed: 0,
      position: { x: 0, y: 0 },
    };
    addAgent(agent);
    persistTeamNow(); // survive reloads without a project switch
    // Live ingest: joining the team is the agent's first memory.
    const projectId = useProjectStore.getState().activeProjectId;
    if (projectId) {
      recordProjectMemory(
        projectId, agent.id, 'Task',
        `${agent.name} ekibe katıldı`,
        `${agent.name} (${role}) ekibe dahil oldu ve masasına yerleşti.`,
      );
    }
    setName('');
    onClose();
  };

  return (
    <div className="add-agent-overlay" onClick={onClose}>
      <div className="add-agent-modal" onClick={e => e.stopPropagation()}>
        <div className="add-agent-header">
          <h2>{t('add_agent.title')}</h2>
          <button className="add-agent-close" onClick={onClose}>×</button>
        </div>

        <label className="add-agent-label">{t('add_agent.name_label')}</label>
        <input
          className="add-agent-input"
          value={name}
          placeholder={t('add_agent.name_placeholder')}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
        />

        <label className="add-agent-label">{t('add_agent.role_label')}</label>
        <div className="add-agent-roles">
          {ROLES.map(r => (
            <button
              key={r}
              className={`add-agent-role ${r === role ? 'selected' : ''}`}
              onClick={() => setRole(r)}
            >
              {t(`role.${r}`)}
            </button>
          ))}
        </div>

        <label className="add-agent-label">{t('add_agent.character_label')}</label>
        <div className="add-agent-chars">
          {Array.from({ length: CHAR_COUNT }, (_, i) => {
            const n = String(i + 1).padStart(2, '0');
            return (
              <button
                key={i}
                className={`add-agent-char ${i === charIdx ? 'selected' : ''}`}
                onClick={() => setCharIdx(i)}
                aria-label={`Character ${i + 1}`}
              >
                <span
                  className="add-agent-char-sprite"
                  style={{
                    backgroundImage: `url(/assets/limezu/chars/char_${n}.png)`,
                    backgroundPosition: `-${FRAME_X * ZOOM}px -${FRAME_Y * ZOOM}px`,
                    backgroundSize: `${SHEET_W * ZOOM}px ${SHEET_H * ZOOM}px`,
                  }}
                />
              </button>
            );
          })}
        </div>

        <div className="add-agent-actions">
          <button className="add-agent-cancel" onClick={onClose}>{t('add_agent.cancel')}</button>
          <button className="add-agent-submit" onClick={submit}>{t('add_agent.submit')}</button>
        </div>
      </div>
    </div>
  );
}
