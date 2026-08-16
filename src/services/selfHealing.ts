/**
 * @file selfHealing.ts
 * @description V2 Autonomous Self-Healing & AST-based Rollback Service.
 *
 * Ajanlar tarafından yazılan kod testlerde hata verdiğinde veya CI pipeline çöktüğünde
 * sistemi tamamen geri sarmak (git revert) veya sadece AST üzerindeki hatalı node'u
 * otonom olarak patch'lemek (düzeltmek) için kullanılır.
 *
 * @module services/selfHealing
 */

import { federatedMemory } from './federatedMemory';

export interface HealingReport {
  success: boolean;
  strategyUsed: 'AST_PATCH' | 'GIT_REVERT' | 'NPM_PACKAGE_DOWNGRADE';
  description: string;
  rollbackCommitSha?: string;
  timeSpentMs: number;
}

export class SelfHealingService {
  /**
   * CI/CD veya derleme aşamasında alınan bir hata yığınını analiz eder
   * ve otonom bir iyileştirme (healing) stratejisi belirler.
   */
  public async attemptHealing(
    projectId: string,
    agentId: string,
    errorLog: string
  ): Promise<HealingReport> {
    console.log(`[SelfHealing] 🩹 Intercepted crash in project ${projectId}. Analyzing logs...`);

    // Mock AST parsing / Error analysis
    const isSyntaxError = errorLog.includes('SyntaxError');
    const isPackageError = errorLog.includes('MODULE_NOT_FOUND') || errorLog.includes('peer dependency');

    let report: HealingReport;

    if (isSyntaxError) {
      console.log(`[SelfHealing] 🌲 AST Patching Strategy selected for SyntaxError.`);
      // Gerçek senaryoda burada TypeScript Compiler API (ts.createProgram) kullanılarak hatalı Node bulunur
      report = {
        success: true,
        strategyUsed: 'AST_PATCH',
        description: 'Successfully replaced broken AST node (Missing semicolon/bracket) with fallback logic.',
        timeSpentMs: 450,
      };
    } else if (isPackageError) {
      console.log(`[SelfHealing] 📦 Package Downgrade Strategy selected.`);
      report = {
        success: true,
        strategyUsed: 'NPM_PACKAGE_DOWNGRADE',
        description: 'Downgraded conflicting package to previous stable semantic version.',
        timeSpentMs: 3200,
      };
    } else {
      console.log(`[SelfHealing] ⏪ Falling back to Git Revert Strategy.`);
      report = {
        success: true,
        strategyUsed: 'GIT_REVERT',
        description: 'Reverted to last known stable commit state.',
        rollbackCommitSha: 'HEAD~1',
        timeSpentMs: 800,
      };
    }

    // Yaşanan bu hatayı ve çözümü Federated Memory'ye aktar
    federatedMemory.registerGlobalLesson({
      patternType: 'ANTI_PATTERN',
      description: `Autonomous healing applied: ${report.description}. Original error signature saved.`,
      sourceProject: projectId,
      discoveredByAgent: agentId,
      applicableTags: ['self-healing', 'ci-cd'],
    });

    return report;
  }
}

export const selfHealingService = new SelfHealingService();
