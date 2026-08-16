import "./OfficeCanvas.css";

// Phase 2'de Phaser.js entegrasyonu yapılacak.
// Şimdilik placeholder gösterir.
export function OfficeCanvas() {
  return (
    <div className="office-canvas">
      <div className="office-canvas__placeholder">
        <div className="office-canvas__grid" />
        <div className="office-canvas__message">
          <span className="office-canvas__icon">⬡</span>
          <p>2D Ofis Simülasyonu</p>
          <p className="office-canvas__sub">Phaser.js — Faz 2'de aktif olacak</p>
        </div>
      </div>
    </div>
  );
}
