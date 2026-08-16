/**
 * @file federatedMemory.ts
 * @description V2 Federated Memory & Cross-Project Knowledge Sharing.
 *
 * Farklı projeler veya ajanlar arasında öğrenilen (Lesson) tecrübelerin
 * "global_patterns" namespace'ine kaydedilerek yeni projelerde
 * otonom olarak (RAG ile) hatırlanmasını sağlar.
 *
 * @module services/federatedMemory
 */

import { knowledgeGraph } from '../lib/graphiti/KnowledgeGraphClient';

export interface GlobalPattern {
  id: string;
  patternType: 'ANTI_PATTERN' | 'BEST_PRACTICE' | 'SECURITY_FLAW';
  description: string;
  sourceProject: string;
  discoveredByAgent: string;
  applicableTags: string[]; // Örn: ['react', 'performance', 'useEffect']
  createdAt: string;
}

export class FederatedMemoryService {
  private globalPatterns: Map<string, GlobalPattern> = new Map();

  /**
   * Bir projede yaşanan kritik bir hatayı (Örn: infinite render loop)
   * global Graphiti Knowledge Graph'ine kaydeder.
   */
  public registerGlobalLesson(lesson: Omit<GlobalPattern, 'id' | 'createdAt'>): string {
    const patternId = `pattern_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const newPattern: GlobalPattern = {
      ...lesson,
      id: patternId,
      createdAt: new Date().toISOString(),
    };

    this.globalPatterns.set(patternId, newPattern);

    // Graphiti'ye ekle
    knowledgeGraph.recordDecision({
      agentId: lesson.discoveredByAgent,
      agentName: 'System (Federated)',
      title: `Global Lesson: ${lesson.patternType}`,
      context: `Discovered in project ${lesson.sourceProject}`,
      chosenOption: lesson.description,
      rationale: `To prevent future occurrences of this ${lesson.patternType}.`,
      rejectedAlternatives: [],
    });

    console.log(`[FederatedMemory] 🌐 Global pattern registered: [${lesson.patternType}] ${lesson.description}`);
    return patternId;
  }

  /**
   * Yeni bir projeye başlarken ilgili teknoloji etiketlerine (tags) sahip
   * global pattern'leri sorgular (Cross-Project Memory).
   */
  public queryRelevantPatterns(tags: string[]): GlobalPattern[] {
    const results: GlobalPattern[] = [];
    
    for (const pattern of this.globalPatterns.values()) {
      const hasIntersection = pattern.applicableTags.some(tag => tags.includes(tag));
      if (hasIntersection) {
        results.push(pattern);
      }
    }

    return results;
  }
}

export const federatedMemory = new FederatedMemoryService();
