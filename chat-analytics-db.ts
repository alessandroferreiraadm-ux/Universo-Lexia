/**
 * Serviço de persistência de analytics de chat no banco de dados
 * Salva e recupera dados de conversas para análise de UX
 */

import mysql from "mysql2/promise";

interface ChatSession {
  id: string;
  user_id?: string;
  start_time: Date;
  end_time?: Date;
  duration?: number;
  message_count: number;
  platform: "web" | "mobile" | "whatsapp";
  user_agent: string;
  ip_address: string;
  page_url: string;
  context?: Record<string, any>;
  status: "active" | "closed" | "abandoned";
  rating?: number;
  feedback?: string;
}

interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  tokens?: number;
  sentiment?: "positive" | "negative" | "neutral";
  intent?: string;
  response_time?: number;
  is_follow_up?: boolean;
}

interface ChatInteraction {
  id: string;
  session_id: string;
  timestamp: Date;
  event_type: "click" | "hover" | "minimize" | "maximize" | "close" | "suggestion_click";
  element_text?: string;
  element_type?: string;
  page_url: string;
  metadata?: Record<string, any>;
}

/**
 * Classe para gerenciar persistência de analytics
 */
export class ChatAnalyticsDB {
  private pool: mysql.Pool;

  constructor(connectionConfig: mysql.PoolOptions) {
    this.pool = mysql.createPool(connectionConfig);
  }

  /**
   * Salvar sessão de chat
   */
  async saveSession(session: ChatSession): Promise<void> {
    const connection = await this.pool.getConnection();
    try {
      await connection.execute(
        `INSERT INTO chat_sessions 
        (id, user_id, start_time, end_time, duration, message_count, platform, user_agent, ip_address, page_url, context, status, rating, feedback)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          session.id,
          session.user_id || null,
          session.start_time,
          session.end_time || null,
          session.duration || null,
          session.message_count,
          session.platform,
          session.user_agent,
          session.ip_address,
          session.page_url,
          session.context ? JSON.stringify(session.context) : null,
          session.status,
          session.rating || null,
          session.feedback || null,
        ]
      );
    } finally {
      connection.release();
    }
  }

  /**
   * Atualizar sessão de chat
   */
  async updateSession(sessionId: string, updates: Partial<ChatSession>): Promise<void> {
    const connection = await this.pool.getConnection();
    try {
      const fields: string[] = [];
      const values: any[] = [];

      if (updates.end_time !== undefined) {
        fields.push("end_time = ?");
        values.push(updates.end_time);
      }
      if (updates.duration !== undefined) {
        fields.push("duration = ?");
        values.push(updates.duration);
      }
      if (updates.message_count !== undefined) {
        fields.push("message_count = ?");
        values.push(updates.message_count);
      }
      if (updates.status !== undefined) {
        fields.push("status = ?");
        values.push(updates.status);
      }
      if (updates.rating !== undefined) {
        fields.push("rating = ?");
        values.push(updates.rating);
      }
      if (updates.feedback !== undefined) {
        fields.push("feedback = ?");
        values.push(updates.feedback);
      }

      if (fields.length === 0) return;

      values.push(sessionId);

      await connection.execute(
        `UPDATE chat_sessions SET ${fields.join(", ")} WHERE id = ?`,
        values
      );
    } finally {
      connection.release();
    }
  }

  /**
   * Salvar mensagem
   */
  async saveMessage(message: ChatMessage): Promise<void> {
    const connection = await this.pool.getConnection();
    try {
      await connection.execute(
        `INSERT INTO chat_messages 
        (id, session_id, role, content, timestamp, tokens, sentiment, intent, response_time, is_follow_up)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          message.id,
          message.session_id,
          message.role,
          message.content,
          message.timestamp,
          message.tokens || null,
          message.sentiment || null,
          message.intent || null,
          message.response_time || null,
          message.is_follow_up ? 1 : 0,
        ]
      );
    } finally {
      connection.release();
    }
  }

  /**
   * Salvar interação
   */
  async saveInteraction(interaction: ChatInteraction): Promise<void> {
    const connection = await this.pool.getConnection();
    try {
      await connection.execute(
        `INSERT INTO chat_interactions 
        (id, session_id, timestamp, event_type, element_text, element_type, page_url, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          interaction.id,
          interaction.session_id,
          interaction.timestamp,
          interaction.event_type,
          interaction.element_text || null,
          interaction.element_type || null,
          interaction.page_url,
          interaction.metadata ? JSON.stringify(interaction.metadata) : null,
        ]
      );
    } finally {
      connection.release();
    }
  }

  /**
   * Obter histórico de uma sessão
   */
  async getSessionHistory(sessionId: string): Promise<{
    session: ChatSession | null;
    messages: ChatMessage[];
    interactions: ChatInteraction[];
  }> {
    const connection = await this.pool.getConnection();
    try {
      // Buscar sessão
      const [sessionRows] = await connection.execute(
        "SELECT * FROM chat_sessions WHERE id = ?",
        [sessionId]
      );
      const session = (sessionRows as any[])[0] || null;

      // Buscar mensagens
      const [messageRows] = await connection.execute(
        "SELECT * FROM chat_messages WHERE session_id = ? ORDER BY timestamp ASC",
        [sessionId]
      );
      const messages = (messageRows as any[]).map((row) => ({
        ...row,
        context: row.context ? JSON.parse(row.context) : undefined,
      }));

      // Buscar interações
      const [interactionRows] = await connection.execute(
        "SELECT * FROM chat_interactions WHERE session_id = ? ORDER BY timestamp ASC",
        [sessionId]
      );
      const interactions = (interactionRows as any[]).map((row) => ({
        ...row,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      }));

      return { session, messages, interactions };
    } finally {
      connection.release();
    }
  }

  /**
   * Obter analytics de um período
   */
  async getAnalyticsPeriod(startDate: Date, endDate: Date): Promise<any> {
    const connection = await this.pool.getConnection();
    try {
      // Total de sessões
      const [sessionStats] = await connection.execute(
        `SELECT 
          COUNT(*) as total_sessions,
          SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed_sessions,
          SUM(CASE WHEN status = 'abandoned' THEN 1 ELSE 0 END) as abandoned_sessions,
          AVG(duration) as average_duration,
          AVG(rating) as average_rating
        FROM chat_sessions 
        WHERE start_time BETWEEN ? AND ?`,
        [startDate, endDate]
      );

      // Total de mensagens
      const [messageStats] = await connection.execute(
        `SELECT 
          COUNT(*) as total_messages,
          SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as user_messages,
          SUM(CASE WHEN role = 'assistant' THEN 1 ELSE 0 END) as assistant_messages
        FROM chat_messages 
        WHERE timestamp BETWEEN ? AND ?`,
        [startDate, endDate]
      );

      // Distribuição de sentimentos
      const [sentimentStats] = await connection.execute(
        `SELECT 
          sentiment,
          COUNT(*) as count
        FROM chat_messages 
        WHERE sentiment IS NOT NULL 
          AND timestamp BETWEEN ? AND ?
        GROUP BY sentiment`,
        [startDate, endDate]
      );

      // Top intents
      const [topIntents] = await connection.execute(
        `SELECT 
          intent,
          COUNT(*) as count
        FROM chat_messages 
        WHERE intent IS NOT NULL 
          AND timestamp BETWEEN ? AND ?
        GROUP BY intent
        ORDER BY count DESC
        LIMIT 10`,
        [startDate, endDate]
      );

      // Top elementos clicados
      const [topClicks] = await connection.execute(
        `SELECT 
          element_text,
          element_type,
          COUNT(*) as count
        FROM chat_interactions 
        WHERE event_type = 'click' 
          AND element_text IS NOT NULL
          AND timestamp BETWEEN ? AND ?
        GROUP BY element_text, element_type
        ORDER BY count DESC
        LIMIT 10`,
        [startDate, endDate]
      );

      // Top páginas
      const [topPages] = await connection.execute(
        `SELECT 
          page_url,
          COUNT(DISTINCT session_id) as session_count,
          COUNT(*) as interaction_count
        FROM chat_interactions 
        WHERE timestamp BETWEEN ? AND ?
        GROUP BY page_url
        ORDER BY session_count DESC
        LIMIT 10`,
        [startDate, endDate]
      );

      return {
        sessionStats: (sessionStats as any[])[0],
        messageStats: (messageStats as any[])[0],
        sentimentDistribution: sentimentStats,
        topIntents,
        topClickedElements: topClicks,
        topPages,
      };
    } finally {
      connection.release();
    }
  }

  /**
   * Gerar e salvar analytics diárias
   */
  async generateDailyAnalytics(date: Date): Promise<void> {
    const connection = await this.pool.getConnection();
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const analytics = await this.getAnalyticsPeriod(startOfDay, endOfDay);

      const sentimentDist = (analytics.sentimentDistribution as any[]).reduce(
        (acc, row) => {
          acc[row.sentiment] = row.count;
          return acc;
        },
        {}
      );

      const topIntentsData = (analytics.topIntents as any[]).map((row) => ({
        intent: row.intent,
        count: row.count,
      }));

      const topClicksData = (analytics.topClickedElements as any[]).map((row) => ({
        element: row.element_text,
        count: row.count,
      }));

      const topPagesData = (analytics.topPages as any[]).map((row) => ({
        page: row.page_url,
        count: row.session_count,
      }));

      const sessionStats = analytics.sessionStats;
      const messageStats = analytics.messageStats;

      const abandonmentRate =
        sessionStats.total_sessions > 0
          ? (sessionStats.abandoned_sessions / sessionStats.total_sessions) * 100
          : 0;

      const avgMessagesPerSession =
        sessionStats.total_sessions > 0
          ? messageStats.total_messages / sessionStats.total_sessions
          : 0;

      await connection.execute(
        `INSERT INTO chat_analytics_daily 
        (id, date, total_sessions, total_messages, average_session_duration, 
         average_messages_per_session, top_intents, sentiment_distribution, 
         abandonment_rate, satisfaction_score, top_clicked_elements, top_pages)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        total_sessions = VALUES(total_sessions),
        total_messages = VALUES(total_messages),
        average_session_duration = VALUES(average_session_duration),
        average_messages_per_session = VALUES(average_messages_per_session),
        top_intents = VALUES(top_intents),
        sentiment_distribution = VALUES(sentiment_distribution),
        abandonment_rate = VALUES(abandonment_rate),
        satisfaction_score = VALUES(satisfaction_score),
        top_clicked_elements = VALUES(top_clicked_elements),
        top_pages = VALUES(top_pages)`,
        [
          `analytics-${date.toISOString().split("T")[0]}`,
          date,
          sessionStats.total_sessions || 0,
          messageStats.total_messages || 0,
          sessionStats.average_duration || 0,
          avgMessagesPerSession,
          JSON.stringify(topIntentsData),
          JSON.stringify(sentimentDist),
          abandonmentRate,
          sessionStats.average_rating || 0,
          JSON.stringify(topClicksData),
          JSON.stringify(topPagesData),
        ]
      );
    } finally {
      connection.release();
    }
  }

  /**
   * Obter analytics diárias
   */
  async getDailyAnalytics(date: Date): Promise<any> {
    const connection = await this.pool.getConnection();
    try {
      const dateStr = date.toISOString().split("T")[0];

      const [rows] = await connection.execute(
        "SELECT * FROM chat_analytics_daily WHERE date = ?",
        [dateStr]
      );

      const row = (rows as any[])[0];

      if (!row) {
        return null;
      }

      return {
        ...row,
        top_intents: JSON.parse(row.top_intents),
        sentiment_distribution: JSON.parse(row.sentiment_distribution),
        top_clicked_elements: JSON.parse(row.top_clicked_elements),
        top_pages: JSON.parse(row.top_pages),
      };
    } finally {
      connection.release();
    }
  }

  /**
   * Fechar pool de conexões
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}

/**
 * Factory para criar instância do serviço
 */
export function createChatAnalyticsDB(connectionConfig: mysql.PoolOptions): ChatAnalyticsDB {
  return new ChatAnalyticsDB(connectionConfig);
}
