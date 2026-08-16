/**
 * @file sandbox.ts
 * @description V2 MicroVM / WebAssembly Sandbox Execution Engine.
 *
 * Ajanların otonom olarak terminal komutları çalıştırmasını (npm install, cargo build)
 * güvenli bir şekilde izole eder. Host sistemin dosya yapısına zarar gelmesini engeller.
 *
 * @module services/sandbox
 */

export interface SandboxExecutionConfig {
  agentId: string;
  projectId: string;
  timeoutMs: number;
  networkAccess: boolean;  // 'false' ise npm install vs yapılamaz
  maxMemoryMb: number;
}

export interface SandboxExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTimeMs: number;
  wasKilled: boolean;
  error?: string;
}

export class WasmSandboxService {
  private activeSandboxes: Map<string, SandboxExecutionConfig> = new Map();

  /**
   * Güvenli, izole bir WasmEdge veya Firecracker container başlatır.
   */
  public async createSandbox(config: SandboxExecutionConfig): Promise<string> {
    const sandboxId = `sbx_${config.projectId}_${config.agentId}_${Date.now()}`;
    this.activeSandboxes.set(sandboxId, config);
    console.log(`[Sandbox] 🛡️ Created isolated environment: ${sandboxId}`);
    return sandboxId;
  }

  /**
   * Belirtilen sandbox içerisinde komut çalıştırır. (AST veya CLI komutu).
   * Host makineye (gerçek FS) erişim sadece sanal bir Volume (VFS) üzerinden sağlanır.
   */
  public async executeCommand(sandboxId: string, command: string): Promise<SandboxExecutionResult> {
    const config = this.activeSandboxes.get(sandboxId);
    if (!config) {
      throw new Error(`Sandbox ${sandboxId} not found or terminated.`);
    }

    console.log(`[Sandbox] 💻 Executing: "${command}" inside ${sandboxId}`);

    // Mock Execution for Phase 11 V2 Architectural Draft
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          stdout: `Successfully executed "${command}" in isolated VFS.`,
          stderr: '',
          exitCode: 0,
          executionTimeMs: 1450,
          wasKilled: false,
        });
      }, 1500);
    });
  }

  /**
   * İşlem bitince belleği temizler.
   */
  public destroySandbox(sandboxId: string): void {
    this.activeSandboxes.delete(sandboxId);
    console.log(`[Sandbox] 🗑️ Destroyed sandbox: ${sandboxId}`);
  }
}

export const sandboxService = new WasmSandboxService();
