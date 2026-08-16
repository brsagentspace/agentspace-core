import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TopBar } from "./components/layout/TopBar";
import { StatusBar } from "./components/layout/StatusBar";
import { OfficeCanvas } from "./components/phaser/OfficeCanvas";
import { TerminalPanel } from "./components/terminal/TerminalPanel";
import { RulesPanel } from "./components/panels/RulesPanel";
import "./App.css";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="app">
        {/* Top navigation bar */}
        <TopBar />

        {/* Main 3-panel workspace */}
        <div className="workspace">
          {/* Left: 2D Office simulation (Phaser.js) */}
          <div className="workspace__office">
            <OfficeCanvas />
          </div>

          {/* Right: Rules panel (top) + Terminals (bottom) */}
          <div className="workspace__right">
            <div className="workspace__rules">
              <RulesPanel />
            </div>
            <div className="workspace__terminal">
              <TerminalPanel />
            </div>
          </div>
        </div>

        {/* Bottom status bar */}
        <StatusBar />
      </div>
    </QueryClientProvider>
  );
}

export default App;
