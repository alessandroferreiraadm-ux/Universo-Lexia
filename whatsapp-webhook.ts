/**
 * WhatsApp Webhook Handler
 * Recebe mensagens do Make.com → Processa com Assistant GPT → Retorna resposta
 * 
 * Webhook URL: https://seu-dominio.com/api/whatsapp/webhook
 * Configurado no Make.com para receber mensagens do WhatsApp Business
 */

import express, { Request, Response } from "express";

const router = express.Router();

// Configuração
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID || "asst_Gmmt7Bw1FzbxWBjzeMGKXXMR";
const OPENAI_API_URL = "https://api.openai.com/v1";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "sua-chave-secreta";

// Armazenar threads por número de WhatsApp (em produção, usar banco de dados)
const threadMap = new Map<string, string>();

/**
 * POST /api/whatsapp/webhook
 * Recebe mensagens do Make.com
 */
router.post("/webhook", async (req: Request, res: Response) => {
  try {
    // Validar webhook (opcional - adicionar segurança depois)
    // const signature = req.headers["x-webhook-signature"];
    // if (signature !== WEBHOOK_SECRET) {
    //   return res.status(401).json({ error: "Unauthorized" });
    // }

    const { phone, message, messageId } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ error: "phone e message são obrigatórios" });
    }

    console.log(`[WhatsApp] Mensagem recebida de ${phone}: ${message}`);

    // 1. Obter ou criar thread para este número
    let threadId = threadMap.get(phone);

    if (!threadId) {
      threadId = await createThread();
      threadMap.set(phone, threadId);
      console.log(`[WhatsApp] Nova thread criada para ${phone}: ${threadId}`);
    }

    // 2. Enviar mensagem ao Assistant
    const reply = await sendToAssistant(threadId, message);

    // 3. Retornar resposta para Make.com
    res.json({
      success: true,
      phone,
      messageId,
      reply,
      threadId,
    });

    console.log(`[WhatsApp] Resposta enviada para ${phone}: ${reply}`);
  } catch (error) {
    console.error("[WhatsApp] Erro:", error);
    res.status(500).json({
      success: false,
      error: "Erro ao processar mensagem",
    });
  }
});

/**
 * Criar nova thread no OpenAI
 */
async function createThread(): Promise<string> {
  const response = await fetch(`${OPENAI_API_URL}/threads`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "OpenAI-Beta": "assistants=v2",
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();
  return data.id;
}

/**
 * Enviar mensagem ao Assistant e obter resposta
 */
async function sendToAssistant(
  threadId: string,
  message: string
): Promise<string> {
  try {
    // 1. Adicionar mensagem à thread
    await fetch(`${OPENAI_API_URL}/threads/${threadId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "OpenAI-Beta": "assistants=v2",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role: "user",
        content: message,
      }),
    });

    // 2. Executar Assistant
    const runResponse = await fetch(
      `${OPENAI_API_URL}/threads/${threadId}/runs`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "OpenAI-Beta": "assistants=v2",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assistant_id: ASSISTANT_ID,
        }),
      }
    );

    const runData = await runResponse.json();
    const runId = runData.id;

    // 3. Aguardar conclusão (com timeout)
    let run = runData;
    let attempts = 0;
    const maxAttempts = 30;

    while (run.status !== "completed" && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const statusResponse = await fetch(
        `${OPENAI_API_URL}/threads/${threadId}/runs/${runId}`,
        {
          headers: {
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
            "OpenAI-Beta": "assistants=v2",
          },
        }
      );

      run = await statusResponse.json();
      attempts++;
    }

    if (run.status !== "completed") {
      return "Desculpe, estou processando sua mensagem. Tente novamente em alguns segundos.";
    }

    // 4. Recuperar mensagens
    const messagesResponse = await fetch(
      `${OPENAI_API_URL}/threads/${threadId}/messages`,
      {
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "OpenAI-Beta": "assistants=v2",
        },
      }
    );

    const messagesData = await messagesResponse.json();
    const assistantMessage = messagesData.data.find(
      (msg: any) => msg.role === "assistant"
    );

    return (
      assistantMessage?.content[0]?.text?.value ||
      "Desculpe, não consegui processar sua mensagem."
    );
  } catch (error) {
    console.error("[Assistant] Erro:", error);
    return "Desculpe, ocorreu um erro. Por favor, tente novamente.";
  }
}

/**
 * GET /api/whatsapp/status
 * Verificar status da integração
 */
router.get("/status", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    webhook: "configurado",
    threads: threadMap.size,
    timestamp: new Date().toISOString(),
  });
});

export default router;
