/**
 * Chat Routes com Persistência no Banco de Dados
 * Integração com Gemini + MySQL para analytics
 */

import express, { Request, Response } from "express";
import { createGeminiChatService } from "./gemini-chat-service";
import { createChatAnalyticsDB } from "./chat-analytics-db";
import mysql from "mysql2/promise";

const router = express.Router();

// Inicializar serviço Gemini
const geminiService = createGeminiChatService(
  process.env.GOOGLE_AI_API_KEY || "AIzaSyBCox-ePn2dPa-Blol2nsHp6KGEYn9803c"
);

// Configurar banco de dados
const dbConfig: mysql.PoolOptions = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "lexia",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

const analyticsDB = createChatAnalyticsDB(dbConfig);

// Armazenar históricos de sessão em memória (cache)
const sessionHistories: Record<string, any[]> = {};

/**
 * POST /api/chat/generate
 * Gerar resposta inteligente com Gemini e salvar no banco
 */
router.post("/generate", async (req: Request, res: Response) => {
  try {
    const { message, context, sessionId, history } = req.body;

    if (!message || !sessionId) {
      return res.status(400).json({
        error: "message e sessionId são obrigatórios",
      });
    }

    // Obter histórico da sessão
    const sessionHistory = sessionHistories[sessionId] || [];

    // Gerar resposta com Gemini
    const response = await geminiService.generateResponse(
      message,
      context,
      sessionHistory
    );

    // Salvar histórico em memória
    sessionHistories[sessionId] = geminiService.getHistory();

    // Salvar mensagem do usuário no banco
    await analyticsDB.saveMessage({
      id: `msg-${Date.now()}-user`,
      session_id: sessionId,
      role: "user",
      content: message,
      timestamp: new Date(),
      intent: response.intent,
    });

    // Salvar mensagem da IA no banco
    await analyticsDB.saveMessage({
      id: `msg-${Date.now()}-assistant`,
      session_id: sessionId,
      role: "assistant",
      content: response.message,
      timestamp: new Date(),
      intent: response.intent,
    });

    res.json(response);
  } catch (error) {
    console.error("[Chat Routes] Erro ao gerar resposta:", error);
    res.status(500).json({
      error: "Erro ao processar mensagem",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/chat/sessions
 * Criar nova sessão de chat
 */
router.post("/sessions", async (req: Request, res: Response) => {
  try {
    const { sessionId, userId, platform, userAgent, ipAddress, pageUrl, context } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        error: "sessionId é obrigatório",
      });
    }

    // Salvar sessão no banco
    await analyticsDB.saveSession({
      id: sessionId,
      user_id: userId,
      start_time: new Date(),
      message_count: 0,
      platform: platform || "web",
      user_agent: userAgent || "",
      ip_address: ipAddress || "",
      page_url: pageUrl || "",
      context,
      status: "active",
    });

    // Inicializar histórico em memória
    sessionHistories[sessionId] = [];
    geminiService.clearHistory();

    res.json({
      sessionId,
      message: "Sessão criada com sucesso",
    });
  } catch (error) {
    console.error("[Chat Routes] Erro ao criar sessão:", error);
    res.status(500).json({
      error: "Erro ao criar sessão",
    });
  }
});

/**
 * POST /api/chat/end-session
 * Finalizar sessão de chat
 */
router.post("/end-session", async (req: Request, res: Response) => {
  try {
    const { sessionId, duration, messageCount, rating, feedback } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        error: "sessionId é obrigatório",
      });
    }

    // Atualizar sessão no banco
    await analyticsDB.updateSession(sessionId, {
      end_time: new Date(),
      duration,
      message_count: messageCount,
      status: "closed",
      rating,
      feedback,
    });

    // Limpar histórico em memória
    delete sessionHistories[sessionId];

    res.json({
      message: "Sessão finalizada com sucesso",
      rating,
      feedback,
    });
  } catch (error) {
    console.error("[Chat Routes] Erro ao finalizar sessão:", error);
    res.status(500).json({
      error: "Erro ao finalizar sessão",
    });
  }
});

/**
 * POST /api/chat/track
 * Rastrear mensagem (para analytics)
 */
router.post("/track", async (req: Request, res: Response) => {
  try {
    const { sessionId, role, content, tokens, responseTime } = req.body;

    // Salvar no banco de dados
    await analyticsDB.saveMessage({
      id: `msg-${Date.now()}`,
      session_id: sessionId,
      role,
      content,
      timestamp: new Date(),
      tokens,
      response_time: responseTime,
    });

    res.json({
      success: true,
      message: "Mensagem rastreada",
    });
  } catch (error) {
    console.error("[Chat Routes] Erro ao rastrear:", error);
    res.status(500).json({
      error: "Erro ao rastrear mensagem",
    });
  }
});

/**
 * POST /api/chat/track-click
 * Rastrear clique em elemento
 */
router.post("/track-click", async (req: Request, res: Response) => {
  try {
    const { sessionId, elementText, elementType, pageUrl } = req.body;

    // Salvar no banco de dados
    await analyticsDB.saveInteraction({
      id: `click-${Date.now()}`,
      session_id: sessionId,
      timestamp: new Date(),
      event_type: "click",
      element_text: elementText,
      element_type: elementType,
      page_url: pageUrl,
    });

    res.json({
      success: true,
      message: "Clique rastreado",
    });
  } catch (error) {
    console.error("[Chat Routes] Erro ao rastrear clique:", error);
    res.status(500).json({
      error: "Erro ao rastrear clique",
    });
  }
});

/**
 * POST /api/chat/mark-abandoned
 * Marcar sessão como abandonada
 */
router.post("/mark-abandoned", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        error: "sessionId é obrigatório",
      });
    }

    // Atualizar no banco de dados
    await analyticsDB.updateSession(sessionId, {
      status: "abandoned",
    });

    res.json({
      success: true,
      message: "Sessão marcada como abandonada",
    });
  } catch (error) {
    console.error("[Chat Routes] Erro ao marcar como abandonada:", error);
    res.status(500).json({
      error: "Erro ao marcar sessão",
    });
  }
});

/**
 * GET /api/chat/analytics
 * Obter analytics de chat
 */
router.get("/analytics", async (req: Request, res: Response) => {
  try {
    const { range = "7days" } = req.query;

    // Calcular datas
    const endDate = new Date();
    const startDate = new Date();

    if (range === "7days") {
      startDate.setDate(startDate.getDate() - 7);
    } else if (range === "30days") {
      startDate.setDate(startDate.getDate() - 30);
    } else if (range === "90days") {
      startDate.setDate(startDate.getDate() - 90);
    }

    // Buscar analytics do banco
    const analytics = await analyticsDB.getAnalyticsPeriod(startDate, endDate);

    res.json(analytics);
  } catch (error) {
    console.error("[Chat Routes] Erro ao obter analytics:", error);
    res.status(500).json({
      error: "Erro ao obter analytics",
    });
  }
});

/**
 * GET /api/chat/analytics/daily/:date
 * Obter analytics de um dia específico
 */
router.get("/analytics/daily/:date", async (req: Request, res: Response) => {
  try {
    const { date } = req.params;

    const analytics = await analyticsDB.getDailyAnalytics(new Date(date));

    if (!analytics) {
      return res.status(404).json({
        error: "Analytics não encontradas para essa data",
      });
    }

    res.json(analytics);
  } catch (error) {
    console.error("[Chat Routes] Erro ao obter analytics diárias:", error);
    res.status(500).json({
      error: "Erro ao obter analytics",
    });
  }
});

/**
 * GET /api/chat/history/:sessionId
 * Obter histórico de uma sessão
 */
router.get("/history/:sessionId", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const history = await analyticsDB.getSessionHistory(sessionId);

    res.json(history);
  } catch (error) {
    console.error("[Chat Routes] Erro ao obter histórico:", error);
    res.status(500).json({
      error: "Erro ao obter histórico",
    });
  }
});

/**
 * POST /api/chat/generate-daily-analytics
 * Gerar analytics diárias (executar via cron job)
 */
router.post("/generate-daily-analytics", async (req: Request, res: Response) => {
  try {
    const { date } = req.body;

    const analyticsDate = date ? new Date(date) : new Date();

    await analyticsDB.generateDailyAnalytics(analyticsDate);

    res.json({
      success: true,
      message: "Analytics diárias geradas com sucesso",
      date: analyticsDate,
    });
  } catch (error) {
    console.error("[Chat Routes] Erro ao gerar analytics diárias:", error);
    res.status(500).json({
      error: "Erro ao gerar analytics",
    });
  }
});

export default router;
