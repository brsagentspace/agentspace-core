/**
 * @file RulesDrawer.tsx
 * @description Right-hand slide-over hosting the Blueprint RulesPanel.
 *
 * Replaces the permanent right rail: rules appear on demand from the
 * TopBar toggle and slide away when dismissed, giving the terminal
 * workspace full width.
 *
 * @module components/panels
 */

import { X } from 'lucide-react';
import { RulesPanel } from './RulesPanel';
import './RulesDrawer.css';

interface RulesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RulesDrawer({ isOpen, onClose }: RulesDrawerProps) {
  return (
    <>
      {isOpen && <div className="rules-drawer-overlay" onClick={onClose} />}
      <aside className={`rules-drawer ${isOpen ? 'open' : ''}`} aria-hidden={!isOpen}>
        <div className="rules-drawer-header">
          <span>| BLUEPRINT RULES</span>
          <button className="rules-drawer-close" onClick={onClose} aria-label="Close rules">
            <X size={16} />
          </button>
        </div>
        <div className="rules-drawer-body">
          <RulesPanel />
        </div>
      </aside>
    </>
  );
}
