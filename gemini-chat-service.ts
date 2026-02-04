/**
 * Serviço de integração com Google Gemini para respostas inteligentes no chat
 * Fornece respostas personalizadas baseadas no contexto e intenção
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

interface ChatMessage {
  role: "user" | "model";
  content: string;
}

interface ChatContext {
  element?: string;
  elementType?: string;
  pageUrl?: string;
  userId?: string;
  sessionId?: string;
}

interface GeminiResponse {
  message: string;
  intent: string;
  confidence: number;
  suggestedActions: string[];
}

/**
 * Classe para gerenciar chat com Gemini
 */
export class GeminiChatService {
  private client: GoogleGenerativeAI;
  private model: any;
  private conversationHistory: ChatMessage[] = [];

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = this.client.getGenerativeModel({ model: "gemini-pro" });
  }

  /**
   * Gerar resposta inteligente para mensagem do usuário
   */
  async generateResponse(
    userMessage: string,
    context?: ChatContext,
    history?: ChatMessage[]
  ): Promise<GeminiResponse> {
    try {
      // Construir prompt com contexto
      const systemPrompt = this.buildSystemPrompt(context);
      const conversationContext = history || this.conversationHistory;

      // Adicionar mensagem do usuário ao histórico
      conversationContext.push({
        role: "user",
        content: userMessage,
      });

      // Preparar mensagens para o Gemini
      const messages = this.formatMessagesForGemini(conversationContext, systemPrompt);

      // Chamar Gemini
      const response = await this.model.generateContent({
        contents: messages,
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 500,
        },
      });

      const responseText = response.response.text();

      // Analisar resposta
      const intent = await this.detectIntent(userMessage);
      const suggestedActions = this.generateSuggestedActions(intent, context);

      // Adicionar resposta ao histórico
      conversationContext.push({
        role: "model",
        content: responseText,
      });

      // Manter histórico limitado (últimas 10 mensagens)
      if (conversationContext.length > 20) {
        conversationContext.splice(0, conversationContext.length - 20);
      }

      this.conversationHistory = conversationContext;

      return {
        message: responseText,
        intent,
        confidence: 0.95,
        suggestedActions,
      };
    } catch (error) {
      console.error("[Gemini Chat] Erro ao gerar resposta:", error);
      throw error;
    }
  }

  /**
   * Detectar intenção da mensagem
   */
  async detectIntent(message: string): Promise<string> {
    const lowerMessage = message.toLowerCase();

    // Palavras-chave por intenção
    const intents: Record<string, string[]> = {
      aluguel: ["alugar", "aluguel", "rent", "locação", "temporada"],
      investimento: ["investir", "investimento", "retorno", "ganho", "lucro", "aplicação"],
      motorista: ["motorista", "dirigir", "uber", "trabalhar", "renda"],
      locador: ["locador", "proprietário", "ganhar", "renda", "aluguel"],
      documentos: ["documento", "cnh", "rg", "comprovante", "upload"],
      pagamento: ["pagar", "pagamento", "cartão", "boleto", "pix"],
      suporte: ["problema", "erro", "ajuda", "não funciona", "bug"],
      faq: ["como", "o que", "qual", "quando", "onde", "por que"],
      cadastro: ["cadastro", "registrar", "criar conta", "inscrever"],
    };

    for (const [intent, keywords] of Object.entries(intents)) {
      if (keywords.some((keyword) => lowerMessage.includes(keyword))) {
        return intent;
      }
    }

    return "general";
  }

  /**
   * Gerar ações sugeridas baseado na intenção
   */
  private generateSuggestedActions(intent: string, context?: ChatContext): string[] {
    const actions: Record<string, string[]> = {
      aluguel: [
        "Ver carros disponíveis",
        "Simular aluguel",
        "Falar com locador",
        "Conhecer condições",
      ],
      investimento: [
        "Simular retorno",
        "Ver histórico",
        "Falar com especialista",
        "Conhecer riscos",
      ],
      motorista: [
        "Começar cadastro",
        "Ver ganhos",
        "Entender processo",
        "Falar com suporte",
      ],
      locador: [
        "Começar cadastro",
        "Ver ganhos potenciais",
        "Entender processo",
        "Falar com especialista",
      ],
      documentos: [
        "Upload de documentos",
        "Verificar status",
        "Falar com suporte",
        "Entender requisitos",
      ],
      pagamento: [
        "Ver formas de pagamento",
        "Rastrear pagamento",
        "Falar com financeiro",
        "Entender taxas",
      ],
      suporte: [
        "Abrir ticket",
        "Chat com especialista",
        "Ver FAQ",
        "Agendar atendimento",
      ],
      faq: ["Ver respostas", "Buscar tópico", "Chat com especialista", "Enviar dúvida"],
      cadastro: [
        "Começar cadastro",
        "Ver requisitos",
        "Falar com suporte",
        "Entender processo",
      ],
      general: [
        "Conhecer Léxia",
        "Ver oportunidades",
        "Falar com especialista",
        "Fazer cadastro",
      ],
    };

    return actions[intent] || actions.general;
  }

  /**
   * Construir prompt do sistema com contexto
   */
  private buildSystemPrompt(context?: ChatContext): string {
    let prompt = `Você é LIA, a assistente inteligente da Léxia, uma plataforma de aluguel de carros e investimentos.

Sua personalidade:
- Amigável, empática e profissional
- Sempre em português brasileiro
- Responde de forma clara e concisa
- Oferece soluções práticas
- Quando não sabe, oferece falar com um especialista

Contexto da Léxia:
- Aluguel de carros para motoristas de aplicativo (Uber, 99, etc)
- Investimento em frota de carros com retorno de 2% a.m.
- Locadores ganham com aluguel de seus carros
- Motoristas ganham alugando carros para trabalhar
- Sem cartão de crédito, sem juros, sem burocracia
- Empresa registrada, contrato formal

Tipos de usuários:
1. Motoristas: Querem alugar carros para trabalhar
2. Locadores: Querem ganhar alugando seus carros
3. Investidores: Querem investir na frota
4. Funcionários: Trabalham na Léxia`;

    if (context?.element) {
      prompt += `\n\nContexto atual:
- Usuário clicou em: ${context.element}
- Tipo de elemento: ${context.elementType}
- Página: ${context.pageUrl}`;
    }

    prompt += `\n\nResponda de forma natural, como se estivesse em uma conversa real.
Se o usuário perguntar sobre algo específico, seja direto.
Se não souber, ofereça conectar com um especialista.
Mantenha as respostas curtas (máximo 2-3 linhas).`;

    return prompt;
  }

  /**
   * Formatar mensagens para o Gemini
   */
  private formatMessagesForGemini(history: ChatMessage[], systemPrompt: string): any[] {
    return [
      {
        role: "user",
        parts: [{ text: systemPrompt }],
      },
      {
        role: "model",
        parts: [{ text: "Entendi! Sou LIA, assistente da Léxia. Como posso ajudar?" }],
      },
      ...history.map((msg) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      })),
    ];
  }

  /**
   * Analisar sentimento da mensagem
   */
  async analyzeSentiment(message: string): Promise<"positive" | "negative" | "neutral"> {
    const positiveWords = [
      "obrigado",
      "ótimo",
      "excelente",
      "perfeito",
      "adorei",
      "amei",
      "legal",
      "bom",
    ];
    const negativeWords = [
      "ruim",
      "péssimo",
      "horrível",
      "problema",
      "erro",
      "falha",
      "não funciona",
      "chato",
    ];

    const lowerMessage = message.toLowerCase();

    const hasPositive = positiveWords.some((word) => lowerMessage.includes(word));
    const hasNegative = negativeWords.some((word) => lowerMessage.includes(word));

    if (hasPositive && !hasNegative) return "positive";
    if (hasNegative && !hasPositive) return "negative";
    return "neutral";
  }

  /**
   * Limpar histórico de conversa
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * Obter histórico atual
   */
  getHistory(): ChatMessage[] {
    return this.conversationHistory;
  }

  /**
   * Definir histórico (para restaurar de sessão anterior)
   */
  setHistory(history: ChatMessage[]): void {
    this.conversationHistory = history;
  }
}

/**
 * Factory para criar instância do serviço
 */
export function createGeminiChatService(apiKey: string): GeminiChatService {
  return new GeminiChatService(apiKey);
}

/**
 * Respostas pré-configuradas para casos comuns
 */
export const predefinedResponses: Record<string, string> = {
  saudacao:
    "Olá! 👋 Sou LIA, assistente da Léxia. Como posso ajudar você hoje? Você é motorista, locador ou investidor?",
  aluguel_como:
    "Para alugar um carro na Léxia, você precisa:\n1. Fazer cadastro\n2. Validar identidade (KYC)\n3. Escolher um carro\n4. Assinar contrato\n5. Começar a trabalhar!\n\nQuer começar agora?",
  investimento_retorno:
    "Nossos investidores ganham 2% a.m. de retorno! 📈\nExemplo: R$ 50.000 investidos = R$ 1.000/mês de ganho.\nQuer simular seu retorno?",
  motorista_ganho:
    "Motoristas ganham alugando carros para trabalhar com Uber, 99, etc.\nSem cartão de crédito, sem juros, sem burocracia.\nQuer saber mais?",
  documentos_necessarios:
    "Para cadastro você precisa de:\n✅ CNH válida\n✅ RG ou CPF\n✅ Comprovante de endereço\n✅ Selfie\n\nTem tudo isso?",
  kyc_o_que_e:
    "KYC (Know Your Customer) é validação de identidade.\nUsamos reconhecimento facial + OCR de documentos.\nÉ rápido e seguro! ✅",
  contrato_o_que_e:
    "Nosso contrato é formal e protege você e a Léxia.\nTudo transparente, sem surpresas.\nQuer ver um exemplo?",
  pagamento_formas:
    "Aceitamos:\n💳 Cartão de crédito\n🏦 Transferência bancária\n📱 PIX\n💰 Boleto\n\nQual prefere?",
};
