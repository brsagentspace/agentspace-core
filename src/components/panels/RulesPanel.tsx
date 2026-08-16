import { useAgentSpaceStore } from "../../store";
import "./RulesPanel.css";

export function RulesPanel() {
  const activeBlueprint = useAgentSpaceStore((s) => s.activeBlueprint);

  return (
    <div className="rules-panel">
      <div className="rules-panel__header">
        <span className="rules-panel__title">Kurallar Paneli</span>
        {activeBlueprint && (
          <span className="rules-panel__badge">{activeBlueprint}</span>
        )}
      </div>

      <div className="rules-panel__body">
        {!activeBlueprint ? (
          <div className="rules-panel__empty">
            <p>Blueprint seçilmedi.</p>
            <p className="rules-panel__empty-sub">Üst bardan bir şablon seç.</p>
          </div>
        ) : (
          <div className="rules-panel__placeholder">
            <p className="rules-panel__loading">
              <span className="rules-panel__dot-anim" />
              Blueprint yükleniyor...
            </p>
            <p className="rules-panel__sub">LlamaIndex RAG — Faz 5'te aktif olacak</p>
          </div>
        )}
      </div>
    </div>
  );
}
