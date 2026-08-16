import { useAgentSpaceStore } from "../../store";
import "./TopBar.css";

const BLUEPRINTS = [
  { id: "mobile-react-native", label: "Mobile (React Native)" },
  { id: "web-nextjs-fullstack", label: "Web (Next.js)" },
  { id: "backend-node-microservice", label: "Backend (Node.js)" },
  { id: "backend-rust-service", label: "Backend (Rust)" },
  { id: "ml-python-pipeline", label: "ML Pipeline" },
];

export function TopBar() {
  const activeBlueprint = useAgentSpaceStore((s) => s.activeBlueprint);
  const setActiveBlueprint = useAgentSpaceStore((s) => s.setActiveBlueprint);
  const activeProject = useAgentSpaceStore((s) => s.activeProject);

  return (
    <header className="top-bar">
      {/* Logo */}
      <div className="top-bar__logo">
        <span className="top-bar__logo-icon">⬡</span>
        <span className="top-bar__logo-text">AgentSpace</span>
      </div>

      <div className="top-bar__divider" />

      {/* Project name */}
      <div className="top-bar__project">
        <span className="top-bar__label">Proje</span>
        <span className="top-bar__value">
          {activeProject?.name ?? "—"}
        </span>
      </div>

      <div className="top-bar__divider" />

      {/* Blueprint selector */}
      <div className="top-bar__blueprint">
        <span className="top-bar__label">Blueprint</span>
        <select
          className="top-bar__select"
          value={activeBlueprint ?? ""}
          onChange={(e) => setActiveBlueprint(e.target.value || null)}
        >
          <option value="">Seç...</option>
          {BLUEPRINTS.map((bp) => (
            <option key={bp.id} value={bp.id}>
              {bp.label}
            </option>
          ))}
        </select>
      </div>

      <div className="top-bar__spacer" />

      {/* Settings */}
      <button className="top-bar__btn" title="Ayarlar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
        </svg>
      </button>
    </header>
  );
}
