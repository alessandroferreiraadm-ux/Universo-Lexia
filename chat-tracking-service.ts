/**
 * Serviço de rastreamento de conversas do chat IA
 * Salva, analisa e fornece insights sobre interações
 */

import { ChatSession, ChatMessage, ChatInteraction, ChatAnalyticsData } from "./chat-tracking-schema";

interface CreateSessionInput {
  userId?: string;
  platform: "web" | "mobile" | "whatsapp";
  userAgent: string;
  ipAddress: string;
  pageUrl: string;
  context?: Record<string, any>;
}

interface CreateMessageInput {
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  tokens?: number;
  responseTime?: number;
}

interface CreateInteractionInput {
  sessionId: string;
  eventType: "click" | "hover" | "minimize" | "maximize" | "close" | "suggestion_click";
  elementText?: string;
  elementType?: string;
  pageUrl: string;
  metadata?: Record<string, any>;
}

/**
 * Classe para gerenciar rastreamento de conversas
 */
export class ChatTrackingService {
  private db: any; // Será injetado

  constructor(database: any) {
    this.db = database;
  }

  /**
   * Criar nova sessão de chat
   */
  async createSession(input: CreateSessionInput): Promise<ChatSession> {
    const session: ChatSession = {
      id: this.generateId(),
      userId: input.userId,
      startTime: new Date(),
      messageCount: 0,
      platform: input.platform,
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
      pageUrl: input.pageUrl,
      context: input.context,
      status: "active",
    };

    // Salvar no banco de dados
    await this.db.insert("chat_sessions", session);

    return session;
  }

  /**
   * Fechar sessão de chat
   */
  async closeSession(sessionId: string, rating?: number, feedback?: string): Promise<void> {
    const endTime = new Date();
    const session = await this.db.query("chat_sessions", { id: sessionId });

    if (session) {
      const duration = Math.floor(
        (endTime.getTime() - session.startTime.getTime()) / 1000
      );

      await this.db.update("chat_sessions", sessionId, {
        endTime,
        duration,
        status: "closed",
        rating,
        feedback,
      });
    }
  }

  /**
   * Marcar sessão como abandonada
   */
  async markAsAbandoned(sessionId: string): Promise<void> {
    const endTime = new Date();
    const session = await this.db.query("chat_sessions", { id: sessionId });

    if (session) {
      const duration = Math.floor(
        (endTime.getTime() - session.startTime.getTime()) / 1000
      );

      await this.db.update("chat_sessions", sessionId, {
        endTime,
        duration,
        status: "abandoned",
      });
    }
  }

  /**
   * Adicionar mensagem à sessão
   */
  async addMessage(input: CreateMessageInput): Promise<ChatMessage> {
    const message: ChatMessage = {
      id: this.generateId(),
      sessionId: input.sessionId,
      role: input.role,
      content: input.content,
      timestamp: new Date(),
      tokens: input.tokens,
      responseTime: input.responseTime,
    };

    // Analisar sentimento e intenção
    message.sentiment = await this.analyzeSentiment(input.content);
    message.intent = await this.detectIntent(input.content);

    // Salvar no banco de dados
    await this.db.insert("chat_messages", message);

    // Atualizar contagem de mensagens na sessão
    await this.db.update("chat_sessions", input.sessionId, {
      messageCount: (await this.db.query("chat_messages", { sessionId: input.sessionId })).length,
    });

    return message;
  }

  /**
   * Registrar interação do usuário
   */
  async trackInteraction(input: CreateInteractionInput): Promise<ChatInteraction> {
    const interaction: ChatInteraction = {
      id: this.generateId(),
      sessionId: input.sessionId,
      timestamp: new Date(),
      eventType: input.eventType,
      elementText: input.elementText,
      elementType: input.elementType,
      pageUrl: input.pageUrl,
      metadata: input.metadata,
    };

    // Salvar no banco de dados
    await this.db.insert("chat_interactions", interaction);

    return interaction;
  }

  /**
   * Obter histórico de uma sessão
   */
  async getSessionHistory(sessionId: string) {
    const session = await this.db.query("chat_sessions", { id: sessionId });
    const messages = await this.db.query("chat_messages", { sessionId });
    const interactions = await this.db.query("chat_interactions", { sessionId });

    return {
      session,
      messages,
      interactions,
    };
  }

  /**
   * Gerar analytics diárias
   */
  async generateDailyAnalytics(date: Date): Promise<ChatAnalyticsData> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Buscar sessões do dia
    const sessions = await this.db.query("chat_sessions", {
      startTime: { $gte: startOfDay, $lte: endOfDay },
    });

    // Buscar mensagens do dia
    const messages = await this.db.query("chat_messages", {
      timestamp: { $gte: startOfDay, $lte: endOfDay },
    });

    // Calcular métricas
    const totalSessions = sessions.length;
    const totalMessages = messages.length;
    const closedSessions = sessions.filter((s: any) => s.status === "closed").length;
    const abandonedSessions = sessions.filter((s: any) => s.status === "abandoned").length;

    const averageSessionDuration =
      sessions.length > 0
        ? sessions.reduce((sum: number, s: any) => sum + (s.duration || 0), 0) / sessions.length
        : 0;

    const averageMessagesPerSession =
      sessions.length > 0 ? totalMessages / sessions.length : 0;

    // Analisar intents
    const intents = messages.reduce(
      (acc: Record<string, number>, msg: any) => {
        if (msg.intent) {
          acc[msg.intent] = (acc[msg.intent] || 0) + 1;
        }
        return acc;
      },
      {}
    );

    const topIntents = Object.entries(intents)
      .map(([intent, count]) => ({ intent, count: count as number }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Analisar sentimentos
    const sentiments = messages.reduce(
      (acc: Record<string, number>, msg: any) => {
        const sentiment = msg.sentiment || "neutral";
        acc[sentiment] = (acc[sentiment] || 0) + 1;
        return acc;
      },
      { positive: 0, negative: 0, neutral: 0 }
    );

    const sentimentDistribution = {
      positive: messages.length > 0 ? (sentiments.positive / messages.length) * 100 : 0,
      negative: messages.length > 0 ? (sentiments.negative / messages.length) * 100 : 0,
      neutral: messages.length > 0 ? (sentiments.neutral / messages.length) * 100 : 0,
    };

    // Taxa de abandono
    const abandonmentRate =
      sessions.length > 0 ? (abandonedSessions / sessions.length) * 100 : 0;

    // Score de satisfação
    const ratings = sessions.filter((s: any) => s.rating).map((s: any) => s.rating);
    const satisfactionScore =
      ratings.length > 0 ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : 0;

    // Elementos mais clicados
    const interactions = await this.db.query("chat_interactions", {
      timestamp: { $gte: startOfDay, $lte: endOfDay },
      eventType: "click",
    });

    const clickedElements = interactions.reduce(
      (acc: Record<string, number>, inter: any) => {
        const key = inter.elementText || inter.elementType || "unknown";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      {}
    );

    const topClickedElements = Object.entries(clickedElements)
      .map(([element, count]) => ({ element, count: count as number }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Páginas mais acessadas
    const pages = sessions.reduce(
      (acc: Record<string, number>, s: any) => {
        acc[s.pageUrl] = (acc[s.pageUrl] || 0) + 1;
        return acc;
      },
      {}
    );

    const topPages = Object.entries(pages)
      .map(([page, count]) => ({ page, count: count as number }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const analytics: ChatAnalyticsData = {
      id: this.generateId(),
      date: new Date(startOfDay),
      totalSessions,
      totalMessages,
      averageSessionDuration,
      averageMessagesPerSession,
      topIntents,
      sentimentDistribution,
      abandonmentRate,
      satisfactionScore,
      topClickedElements,
      topPages,
    };

    // Salvar analytics
    await this.db.insert("chat_analytics", analytics);

    return analytics;
  }

  /**
   * Obter analytics de um período
   */
  async getAnalyticsPeriod(startDate: Date, endDate: Date): Promise<ChatAnalyticsData[]> {
    return await this.db.query("chat_analytics", {
      date: { $gte: startDate, $lte: endDate },
    });
  }

  /**
   * Analisar sentimento de uma mensagem (integrar com Gemini depois)
   */
  private async analyzeSentiment(content: string): Promise<"positive" | "negative" | "neutral"> {
    // TODO: Integrar com Gemini para análise de sentimento
    // Por enquanto, usar análise simples

    const positiveWords = ["obrigado", "ótimo", "excelente", "perfeito", "adorei", "amei"];
    const negativeWords = ["ruim", "péssimo", "horrível", "problema", "erro", "falha"];

    const lowerContent = content.toLowerCase();

    const hasPositive = positiveWords.some((word) => lowerContent.includes(word));
    const hasNegative = negativeWords.some((word) => lowerContent.includes(word));

    if (hasPositive && !hasNegative) return "positive";
    if (hasNegative && !hasPositive) return "negative";
    return "neutral";
  }

  /**
   * Detectar intenção da mensagem (integrar com Gemini depois)
   */
  private async detectIntent(content: string): Promise<string> {
    // TODO: Integrar com Gemini para detecção de intenção
    // Por enquanto, usar palavras-chave

    const lowerContent = content.toLowerCase();

    if (
      lowerContent.includes("faq") ||
      lowerContent.includes("pergunta") ||
      lowerContent.includes("como")
    ) {
      return "faq";
    }
    if (
      lowerContent.includes("problema") ||
      lowerContent.includes("erro") ||
      lowerContent.includes("ajuda")
    ) {
      return "support";
    }
    if (
      lowerContent.includes("cadastro") ||
      lowerContent.includes("registrar") ||
      lowerContent.includes("inscrever")
    ) {
      return "signup";
    }
    if (
      lowerContent.includes("preço") ||
      lowerContent.includes("carro") ||
      lowerContent.includes("aluguel")
    ) {
      return "product";
    }

    return "general";
  }

  /**
   * Gerar ID único
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Factory para criar instância do serviço
 */
export function createChatTrackingService(database: any): ChatTrackingService {
  return new ChatTrackingService(database);
}
