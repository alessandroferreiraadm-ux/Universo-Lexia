/**
 * Chat Routes - Integração com Google Gemini
 * 
 * Endpoints:
 * POST /api/chat/generate - Gerar resposta inteligente
 * POST /api/chat/sessions - Criar sessão
 * POST /api/chat/end-session - Finalizar sessão
 * POST /api/chat/track - Rastrear mensagem
 * GET /api/chat/analytics - Obter analytics
 */

import express, { Request, Response } from "express";
import { createGeminiChatService } from "./gemini-chat-service";

const router = express.Router();

// Inicializar serviço Gemini
const geminiService = createGeminiChatService(
  process.env.GOOGLE_AI_API_KEY || "AIzaSyBCox-ePn2dPa-Blol2nsHp6KGEYn9803c"
);

// Armazenar históricos de sessão em memória (em produção, usar banco de dados)
const sessionHistories: Record<string, any[]> = {};

/**
 * POST /api/chat/generate
 * Gerar resposta inteligente com Gemini
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

    // Salvar histórico
    sessionHistories[sessionId] = geminiService.getHistory();

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
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        error: "sessionId é obrigatório",
      });
    }

    // Inicializar histórico da sessão
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
    const { sessionId, rating, feedback } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        error: "sessionId é obrigatório",
      });
    }

    // Limpar histórico da sessão
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

    // TODO: Salvar no banco de dados
    console.log("[Chat Tracking]", {
      sessionId,
      role,
      content: content.substring(0, 100),
      tokens,
      responseTime,
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

    // TODO: Salvar no banco de dados
    console.log("[Click Tracking]", {
      sessionId,
      elementText,
      elementType,
      pageUrl,
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

    // TODO: Atualizar no banco de dados
    console.log("[Chat] Sessão marcada como abandonada:", sessionId);

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

    // TODO: Buscar do banco de dados
    const mockAnalytics = {
      totalSessions: 1250,
      totalMessages: 5840,
      averageSessionDuration: 420,
      averageMessagesPerSession: 4.67,
      abandonmentRate: 12.5,
      satisfactionScore: 4.2,
      topIntents: [
        { intent: "aluguel", count: 450 },
        { intent: "investimento", count: 380 },
        { intent: "motorista", count: 320 },
        { intent: "suporte", count: 280 },
        { intent: "faq", count: 250 },
      ],
      sentimentDistribution: {
        positive: 65.5,
        negative: 12.3,
        neutral: 22.2,
      },
      topClickedElements: [
        { element: "Sou Motorista", count: 450 },
        { element: "Sou Locador", count: 380 },
        { element: "Investir", count: 320 },
        { element: "Falar com LIA", count: 280 },
        { element: "Suporte", count: 250 },
      ],
      topPages: [
        { page: "/", count: 520 },
        { page: "/carros", count: 380 },
        { page: "/investimentos", count: 320 },
        { page: "/suporte", count: 280 },
        { page: "/faq", count: 250 },
      ],
    };

    res.json(mockAnalytics);
  } catch (error) {
    console.error("[Chat Routes] Erro ao obter analytics:", error);
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

    const history = sessionHistories[sessionId] || [];

    res.json({
      sessionId,
      history,
      messageCount: history.length,
    });
  } catch (error) {
    console.error("[Chat Routes] Erro ao obter histórico:", error);
    res.status(500).json({
      error: "Erro ao obter histórico",
    });
  }
});

export default router;
