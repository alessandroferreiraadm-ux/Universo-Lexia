/**
 * WhatsApp Business API Integration
 * Envio de mensagens, templates e notificações
 */

const WHATSAPP_API_URL = "https://graph.instagram.com/v18.0";
const WHATSAPP_BUSINESS_ACCOUNT_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "";
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN || "";

interface WhatsAppMessage {
  to: string;
  type: "text" | "template" | "image" | "document";
  text?: string;
  template?: {
    name: string;
    language: {
      code: string;
    };
    parameters?: {
      body: {
        parameters: Array<{
          type: string;
          text?: string;
        }>;
      };
    };
  };
  image?: {
    link: string;
  };
  document?: {
    link: string;
  };
}

/**
 * Enviar mensagem de texto
 */
export async function sendWhatsAppMessage(
  phoneNumber: string,
  message: string
): Promise<{ success: boolean; messageId: string }> {
  try {
    const payload: WhatsAppMessage = {
      to: phoneNumber.replace(/\D/g, ""), // Remove caracteres não numéricos
      type: "text",
      text: message,
    };

    const response = await fetch(
      `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${WHATSAPP_API_TOKEN}`,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`WhatsApp error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    return {
      success: true,
      messageId: data.messages[0].id,
    };
  } catch (error) {
    console.error("[WhatsApp] Send message failed:", error);
    throw error;
  }
}

/**
 * Enviar template de mensagem
 */
export async function sendWhatsAppTemplate(
  phoneNumber: string,
  templateName: string,
  parameters: string[] = []
): Promise<{ success: boolean; messageId: string }> {
  try {
    const payload: WhatsAppMessage = {
      to: phoneNumber.replace(/\D/g, ""),
      type: "template",
      template: {
        name: templateName,
        language: {
          code: "pt_BR",
        },
        parameters:
          parameters.length > 0
            ? {
                body: {
                  parameters: parameters.map((param) => ({
                    type: "text",
                    text: param,
                  })),
                },
              }
            : undefined,
      },
    };

    const response = await fetch(
      `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${WHATSAPP_API_TOKEN}`,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`WhatsApp error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    return {
      success: true,
      messageId: data.messages[0].id,
    };
  } catch (error) {
    console.error("[WhatsApp] Send template failed:", error);
    throw error;
  }
}

/**
 * Enviar imagem
 */
export async function sendWhatsAppImage(
  phoneNumber: string,
  imageUrl: string,
  caption?: string
): Promise<{ success: boolean; messageId: string }> {
  try {
    const payload = {
      to: phoneNumber.replace(/\D/g, ""),
      type: "image",
      image: {
        link: imageUrl,
      },
      ...(caption && { caption }),
    };

    const response = await fetch(
      `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${WHATSAPP_API_TOKEN}`,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`WhatsApp error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    return {
      success: true,
      messageId: data.messages[0].id,
    };
  } catch (error) {
    console.error("[WhatsApp] Send image failed:", error);
    throw error;
  }
}

/**
 * Enviar documento
 */
export async function sendWhatsAppDocument(
  phoneNumber: string,
  documentUrl: string,
  fileName: string
): Promise<{ success: boolean; messageId: string }> {
  try {
    const payload = {
      to: phoneNumber.replace(/\D/g, ""),
      type: "document",
      document: {
        link: documentUrl,
        filename: fileName,
      },
    };

    const response = await fetch(
      `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${WHATSAPP_API_TOKEN}`,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`WhatsApp error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    return {
      success: true,
      messageId: data.messages[0].id,
    };
  } catch (error) {
    console.error("[WhatsApp] Send document failed:", error);
    throw error;
  }
}

/**
 * Notificações automáticas de KYC
 */
export async function notifyKYCApproved(
  phoneNumber: string,
  userName: string
): Promise<{ success: boolean; messageId: string }> {
  try {
    const message = `🎉 Parabéns ${userName}! Sua identidade foi verificada com sucesso. Você já pode acessar todas as funcionalidades da Léxia. Bem-vindo! 🚀`;
    return await sendWhatsAppMessage(phoneNumber, message);
  } catch (error) {
    console.error("[WhatsApp] KYC approved notification failed:", error);
    throw error;
  }
}

/**
 * Notificações automáticas de KYC rejeitado
 */
export async function notifyKYCRejected(
  phoneNumber: string,
  userName: string
): Promise<{ success: boolean; messageId: string }> {
  try {
    const message = `Oi ${userName}, sua verificação de identidade foi rejeitada. Por favor, tente novamente com documentos válidos e em boa qualidade. Estamos aqui para ajudar! 💬`;
    return await sendWhatsAppMessage(phoneNumber, message);
  } catch (error) {
    console.error("[WhatsApp] KYC rejected notification failed:", error);
    throw error;
  }
}

/**
 * Notificações de pagamento recebido
 */
export async function notifyPaymentReceived(
  phoneNumber: string,
  userName: string,
  amount: number,
  transactionId: string
): Promise<{ success: boolean; messageId: string }> {
  try {
    const message = `✅ Pagamento recebido! Olá ${userName}, recebemos seu pagamento de R$ ${amount.toFixed(2)}. ID da transação: ${transactionId}. Obrigado! 💰`;
    return await sendWhatsAppMessage(phoneNumber, message);
  } catch (error) {
    console.error("[WhatsApp] Payment notification failed:", error);
    throw error;
  }
}

/**
 * Notificações de resgate disponível
 */
export async function notifyWithdrawalAvailable(
  phoneNumber: string,
  userName: string,
  amount: number
): Promise<{ success: boolean; messageId: string }> {
  try {
    const message = `💰 Resgate disponível! Oi ${userName}, você tem R$ ${amount.toFixed(2)} pronto para sacar. Acesse seu painel para confirmar o resgate. 🎯`;
    return await sendWhatsAppMessage(phoneNumber, message);
  } catch (error) {
    console.error("[WhatsApp] Withdrawal notification failed:", error);
    throw error;
  }
}

/**
 * Notificações de novo usuário
 */
export async function notifyNewUserSignup(
  phoneNumber: string,
  userName: string
): Promise<{ success: boolean; messageId: string }> {
  try {
    const message = `Bem-vindo à Léxia, ${userName}! 🚀 Seu cadastro foi recebido. Próximo passo: verificação de identidade. Clique aqui para continuar: https://www.lexiaveiculos.com.br/kyc`;
    return await sendWhatsAppMessage(phoneNumber, message);
  } catch (error) {
    console.error("[WhatsApp] New user notification failed:", error);
    throw error;
  }
}

/**
 * Notificações de aluguel vencendo
 */
export async function notifyRentalExpiring(
  phoneNumber: string,
  userName: string,
  daysUntilExpiry: number,
  amount: number
): Promise<{ success: boolean; messageId: string }> {
  try {
    const message = `⏰ Atenção ${userName}! Seu aluguel vence em ${daysUntilExpiry} dias. Valor: R$ ${amount.toFixed(2)}. Renove agora para não perder acesso! 🚗`;
    return await sendWhatsAppMessage(phoneNumber, message);
  } catch (error) {
    console.error("[WhatsApp] Rental expiring notification failed:", error);
    throw error;
  }
}

/**
 * Enviar PIX QR Code
 */
export async function sendWhatsAppPixQRCode(
  phoneNumber: string,
  qrCodeImageUrl: string,
  amount: number,
  description: string
): Promise<{ success: boolean; messageId: string }> {
  try {
    const message = `Escaneie o QR Code para pagar R$ ${amount.toFixed(2)} - ${description}`;
    return await sendWhatsAppImage(phoneNumber, qrCodeImageUrl, message);
  } catch (error) {
    console.error("[WhatsApp] PIX QR Code notification failed:", error);
    throw error;
  }
}

/**
 * Webhook handler para mensagens recebidas
 */
export function handleWhatsAppWebhook(payload: any): {
  phoneNumber: string;
  message: string;
  messageId: string;
  timestamp: number;
} {
  const message = payload.entry[0].changes[0].value.messages[0];
  const contact = payload.entry[0].changes[0].value.contacts[0];

  return {
    phoneNumber: message.from,
    message: message.text?.body || "",
    messageId: message.id,
    timestamp: parseInt(message.timestamp),
  };
}

/**
 * Validar webhook do WhatsApp
 */
export function validateWhatsAppWebhook(
  token: string,
  challenge: string,
  verifyToken: string
): string | null {
  if (verifyToken === process.env.WHATSAPP_VERIFY_TOKEN) {
    return challenge;
  }
  return null;
}

/**
 * Enviar mensagem em massa
 */
export async function sendBulkWhatsAppMessages(
  phoneNumbers: string[],
  message: string
): Promise<{ success: number; failed: number; errors: any[] }> {
  try {
    const results = await Promise.allSettled(
      phoneNumbers.map((phone) => sendWhatsAppMessage(phone, message))
    );

    const success = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;
    const errors = results
      .filter((r) => r.status === "rejected")
      .map((r) => (r as PromiseRejectedResult).reason);

    return { success, failed, errors };
  } catch (error) {
    console.error("[WhatsApp] Bulk send failed:", error);
    throw error;
  }
}

/**
 * Criar template de mensagem
 */
export async function createWhatsAppTemplate(
  templateName: string,
  templateContent: string,
  category: "MARKETING" | "OTP" | "TRANSACTIONAL" = "TRANSACTIONAL"
): Promise<{ success: boolean; templateId: string }> {
  try {
    const payload = {
      name: templateName,
      category,
      language: "pt_BR",
      components: [
        {
          type: "BODY",
          text: templateContent,
        },
      ],
    };

    const response = await fetch(
      `${WHATSAPP_API_URL}/${WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${WHATSAPP_API_TOKEN}`,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`WhatsApp error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    return {
      success: true,
      templateId: data.id,
    };
  } catch (error) {
    console.error("[WhatsApp] Create template failed:", error);
    throw error;
  }
}
