/**
 * Schema para rastreamento de conversas do chat IA
 * Salva histórico completo para análise de UX
 */

export const chatTrackingSchema = {
  // Tabela de sessões de chat
  chatSessions: {
    id: "string", // UUID
    userId: "string", // ID do usuário (opcional se anônimo)
    startTime: "timestamp",
    endTime: "timestamp",
    duration: "number", // em segundos
    messageCount: "number",
    platform: "string", // "web", "mobile", "whatsapp"
    userAgent: "string",
    ipAddress: "string",
    pageUrl: "string", // URL onde o chat foi aberto
    context: "json", // Contexto inicial (elemento clicado, etc)
    status: "string", // "active", "closed", "abandoned"
    rating: "number", // 1-5 (opcional)
    feedback: "text", // Feedback do usuário
  },

  // Tabela de mensagens
  chatMessages: {
    id: "string", // UUID
    sessionId: "string", // FK para chatSessions
    role: "string", // "user" ou "assistant"
    content: "text",
    timestamp: "timestamp",
    tokens: "number", // Tokens usados (para Gemini)
    sentiment: "string", // "positive", "negative", "neutral" (análise de IA)
    intent: "string", // Intenção detectada (FAQ, Suporte, Cadastro, etc)
    responseTime: "number", // em ms
    isFollowUp: "boolean", // Se é continuação de mensagem anterior
  },

  // Tabela de eventos de interação
  chatInteractions: {
    id: "string", // UUID
    sessionId: "string", // FK para chatSessions
    timestamp: "timestamp",
    eventType: "string", // "click", "hover", "minimize", "maximize", "close", "suggestion_click"
    elementText: "string", // Texto do elemento clicado
    elementType: "string", // Tipo de elemento
    pageUrl: "string",
    metadata: "json", // Dados adicionais
  },

  // Tabela de análise de conversas
  chatAnalytics: {
    id: "string", // UUID
    date: "date",
    totalSessions: "number",
    totalMessages: "number",
    averageSessionDuration: "number",
    averageMessagesPerSession: "number",
    topIntents: "json", // Array com intents mais frequentes
    sentimentDistribution: "json", // {positive: %, negative: %, neutral: %}
    abandonmentRate: "number", // % de sessões abandonadas
    satisfactionScore: "number", // Média de ratings
    topClickedElements: "json", // Array com elementos mais clicados
    topPages: "json", // Array com páginas mais acessadas
  },

  // Tabela de sugestões rápidas
  chatSuggestions: {
    id: "string", // UUID
    sessionId: "string", // FK para chatSessions
    timestamp: "timestamp",
    suggestionType: "string", // "faq", "support", "signup", "product"
    suggestionText: "string",
    wasClicked: "boolean",
    clickTime: "timestamp", // Quando foi clicado (se foi)
  },
};

/**
 * Tipos TypeScript para o rastreamento
 */

export interface ChatSession {
  id: string;
  userId?: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  messageCount: number;
  platform: "web" | "mobile" | "whatsapp";
  userAgent: string;
  ipAddress: string;
  pageUrl: string;
  context?: Record<string, any>;
  status: "active" | "closed" | "abandoned";
  rating?: number;
  feedback?: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  tokens?: number;
  sentiment?: "positive" | "negative" | "neutral";
  intent?: string;
  responseTime?: number;
  isFollowUp?: boolean;
}

export interface ChatInteraction {
  id: string;
  sessionId: string;
  timestamp: Date;
  eventType: "click" | "hover" | "minimize" | "maximize" | "close" | "suggestion_click";
  elementText?: string;
  elementType?: string;
  pageUrl: string;
  metadata?: Record<string, any>;
}

export interface ChatAnalyticsData {
  id: string;
  date: Date;
  totalSessions: number;
  totalMessages: number;
  averageSessionDuration: number;
  averageMessagesPerSession: number;
  topIntents: Array<{ intent: string; count: number }>;
  sentimentDistribution: {
    positive: number;
    negative: number;
    neutral: number;
  };
  abandonmentRate: number;
  satisfactionScore: number;
  topClickedElements: Array<{ element: string; count: number }>;
  topPages: Array<{ page: string; count: number }>;
}

export interface ChatSuggestion {
  id: string;
  sessionId: string;
  timestamp: Date;
  suggestionType: "faq" | "support" | "signup" | "product";
  suggestionText: string;
  wasClicked: boolean;
  clickTime?: Date;
}
