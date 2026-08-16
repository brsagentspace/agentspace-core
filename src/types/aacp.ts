/**
 * @file aacp.ts
 * @description Agent-to-Agent Communication Protocol (AACP) Veri Modelleri.
 *
 * Bu protokol, ajanların tek yönlü (LangGraph edges) iletilerden çıkarak
 * Peer-to-Peer (P2P) negotiation (pazarlık) ve delegation (alt görev atama)
 * yapabilmesini sağlar.
 *
 * @module types/aacp
 */

/** Ajanlar arası mesajlaşmanın intent (niyet) tipleri */
export type AACPIntent =
  | 'DELEGATE'       // Bir alt ajan (sub-agent) spawn et ve görev bekle
  | 'NEGOTIATE'      // Başka bir ajanın ürettiği karara itiraz et (Örn. API payload'u)
  | 'INFO_REQUEST'   // Başka bir ajandan spesifik bir bağlam iste
  | 'RESOLVED'       // Pazarlık başarıyla sonuçlandı
  | 'REJECTED';      // Pazarlık reddedildi (Orkestratör müdahale etmeli)

/** Ajanlar arası P2P mesaj yapısı */
export interface AACPPacket {
  id: string;
  senderId: string;       // Mesajı gönderen ajan (Örn. 'agent-frontend-01')
  receiverId: string;     // Alıcı ajan (Örn. 'agent-backend-01')
  intent: AACPIntent;
  content: string;        // İletişim metni veya payload
  payload?: any;          // AST Node, JSON Schema vb. opsiyonel veriler
  timestamp: number;
  correlationId?: string; // Hangi task_id veya negotiation serisine ait?
}

/** Pazarlık (Negotiation) sürecinin durum makinesi */
export interface NegotiationSession {
  sessionId: string;
  initiator: string;
  responder: string;
  topic: string;
  status: 'PENDING' | 'ACCEPTED' | 'ESCALATED' | 'COMPLETED';
  history: AACPPacket[];
  resolution?: string;    // Pazarlık sonucunda alınan ortak karar
}
