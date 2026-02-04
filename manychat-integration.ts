/**
 * ManyChat Integration
 * Chatbot automático e automações de WhatsApp
 */

const MANYCHAT_API_URL = "https://api.manychat.com/fb/subscriber";
const MANYCHAT_API_TOKEN = process.env.MANYCHAT_API_TOKEN || "";

interface ManyChatSubscriber {
  id: string;
  phone: string;
  name: string;
  email: string;
  firstName: string;
  lastName: string;
  customFields: Record<string, any>;
}

interface ManyChatFlow {
  id: string;
  name: string;
  status: "active" | "inactive";
}

/**
 * Criar ou atualizar subscriber no ManyChat
 */
export async function upsertManyChatSubscriber(data: {
  phone: string;
  name: string;
  email: string;
  firstName: string;
  lastName: string;
  customFields?: Record<string, any>;
}): Promise<ManyChatSubscriber> {
  try {
    const payload = {
      phone: data.phone.replace(/\D/g, ""),
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email,
      custom_fields: data.customFields || {},
    };

    const response = await fetch(`${MANYCHAT_API_URL}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MANYCHAT_API_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`ManyChat error: ${JSON.stringify(error)}`);
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error("[ManyChat] Upsert subscriber failed:", error);
    throw error;
  }
}

/**
 * Enviar mensagem via ManyChat
 */
export async function sendManyChatMessage(
  phone: string,
  message: string,
  flowId?: string
): Promise<{ success: boolean; messageId: string }> {
  try {
    const payload = {
      phone: phone.replace(/\D/g, ""),
      message,
      ...(flowId && { flow_id: flowId }),
    };

    const response = await fetch(`${MANYCHAT_API_URL}/send-message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MANYCHAT_API_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`ManyChat error: ${JSON.stringify(error)}`);
    }

    const result = await response.json();
    return {
      success: true,
      messageId: result.data.message_id,
    };
  } catch (error) {
    console.error("[ManyChat] Send message failed:", error);
    throw error;
  }
}

/**
 * Adicionar tag ao subscriber
 */
export async function addManyChatTag(
  phone: string,
  tag: string
): Promise<{ success: boolean }> {
  try {
    const payload = {
      phone: phone.replace(/\D/g, ""),
      tag,
    };

    const response = await fetch(`${MANYCHAT_API_URL}/add-tag`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MANYCHAT_API_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`ManyChat error: ${JSON.stringify(error)}`);
    }

    return { success: true };
  } catch (error) {
    console.error("[ManyChat] Add tag failed:", error);
    throw error;
  }
}

/**
 * Remover tag do subscriber
 */
export async function removeManyChatTag(
  phone: string,
  tag: string
): Promise<{ success: boolean }> {
  try {
    const payload = {
      phone: phone.replace(/\D/g, ""),
      tag,
    };

    const response = await fetch(`${MANYCHAT_API_URL}/remove-tag`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MANYCHAT_API_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`ManyChat error: ${JSON.stringify(error)}`);
    }

    return { success: true };
  } catch (error) {
    console.error("[ManyChat] Remove tag failed:", error);
    throw error;
  }
}

/**
 * Iniciar fluxo automático
 */
export async function triggerManyChatFlow(
  phone: string,
  flowId: string,
  variables?: Record<string, any>
): Promise<{ success: boolean }> {
  try {
    const payload = {
      phone: phone.replace(/\D/g, ""),
      flow_id: flowId,
      variables: variables || {},
    };

    const response = await fetch(`${MANYCHAT_API_URL}/trigger-flow`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MANYCHAT_API_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`ManyChat error: ${JSON.stringify(error)}`);
    }

    return { success: true };
  } catch (error) {
    console.error("[ManyChat] Trigger flow failed:", error);
    throw error;
  }
}

/**
 * Fluxos automáticos pré-configurados
 */

// Fluxo: Novo usuário cadastrado
export async function flowNewUserSignup(data: {
  phone: string;
  name: string;
  email: string;
  profileType: string;
}): Promise<void> {
  try {
    // 1. Criar subscriber
    await upsertManyChatSubscriber({
      phone: data.phone,
      name: data.name,
      email: data.email,
      firstName: data.name.split(" ")[0],
      lastName: data.name.split(" ").slice(1).join(" "),
      customFields: {
        profile_type: data.profileType,
        signup_date: new Date().toISOString(),
      },
    });

    // 2. Adicionar tag
    await addManyChatTag(data.phone, "novo_usuario");

    // 3. Enviar mensagem de boas-vindas
    await sendManyChatMessage(
      data.phone,
      `Bem-vindo à Léxia, ${data.name}! 🚀 Seu cadastro foi recebido. Próximo passo: verificação de identidade.`
    );
  } catch (error) {
    console.error("[ManyChat] New user signup flow failed:", error);
  }
}

// Fluxo: KYC aprovado
export async function flowKYCApproved(data: {
  phone: string;
  name: string;
  email: string;
}): Promise<void> {
  try {
    // 1. Adicionar tag
    await addManyChatTag(data.phone, "kyc_aprovado");

    // 2. Remover tag de pendente
    await removeManyChatTag(data.phone, "kyc_pendente");

    // 3. Enviar mensagem
    await sendManyChatMessage(
      data.phone,
      `🎉 Parabéns ${data.name}! Sua identidade foi verificada com sucesso. Você já pode acessar todas as funcionalidades da Léxia! 🚀`
    );
  } catch (error) {
    console.error("[ManyChat] KYC approved flow failed:", error);
  }
}

// Fluxo: KYC rejeitado
export async function flowKYCRejected(data: {
  phone: string;
  name: string;
  email: string;
}): Promise<void> {
  try {
    // 1. Adicionar tag
    await addManyChatTag(data.phone, "kyc_rejeitado");

    // 2. Enviar mensagem
    await sendManyChatMessage(
      data.phone,
      `Oi ${data.name}, sua verificação de identidade foi rejeitada. Por favor, tente novamente com documentos válidos. Estamos aqui para ajudar! 💬`
    );
  } catch (error) {
    console.error("[ManyChat] KYC rejected flow failed:", error);
  }
}

// Fluxo: Pagamento recebido
export async function flowPaymentReceived(data: {
  phone: string;
  name: string;
  amount: number;
  transactionId: string;
}): Promise<void> {
  try {
    // 1. Adicionar tag
    await addManyChatTag(data.phone, "pagamento_recebido");

    // 2. Enviar mensagem
    await sendManyChatMessage(
      data.phone,
      `✅ Pagamento recebido! Olá ${data.name}, recebemos seu pagamento de R$ ${data.amount.toFixed(2)}. ID: ${data.transactionId}. Obrigado! 💰`
    );
  } catch (error) {
    console.error("[ManyChat] Payment received flow failed:", error);
  }
}

// Fluxo: Resgate disponível
export async function flowWithdrawalAvailable(data: {
  phone: string;
  name: string;
  amount: number;
  investmentId: string;
}): Promise<void> {
  try {
    // 1. Adicionar tag
    await addManyChatTag(data.phone, "resgate_disponivel");

    // 2. Enviar mensagem
    await sendManyChatMessage(
      data.phone,
      `💰 Resgate disponível! Oi ${data.name}, você tem R$ ${data.amount.toFixed(2)} pronto para sacar. Acesse seu painel para confirmar! 🎯`
    );
  } catch (error) {
    console.error("[ManyChat] Withdrawal available flow failed:", error);
  }
}

// Fluxo: Aluguel vencendo
export async function flowRentalExpiring(data: {
  phone: string;
  name: string;
  daysUntilExpiry: number;
  amount: number;
}): Promise<void> {
  try {
    // 1. Adicionar tag
    await addManyChatTag(data.phone, "aluguel_vencendo");

    // 2. Enviar mensagem
    await sendManyChatMessage(
      data.phone,
      `⏰ Atenção ${data.name}! Seu aluguel vence em ${data.daysUntilExpiry} dias. Valor: R$ ${data.amount.toFixed(2)}. Renove agora! 🚗`
    );
  } catch (error) {
    console.error("[ManyChat] Rental expiring flow failed:", error);
  }
}

/**
 * Webhook handler para mensagens do ManyChat
 */
export function handleManyChatWebhook(payload: any): {
  phone: string;
  message: string;
  subscriberId: string;
  timestamp: number;
} {
  const data = payload.data;

  return {
    phone: data.phone,
    message: data.message_text,
    subscriberId: data.subscriber_id,
    timestamp: data.timestamp,
  };
}

/**
 * Obter subscriber do ManyChat
 */
export async function getManyChatSubscriber(
  phone: string
): Promise<ManyChatSubscriber | null> {
  try {
    const response = await fetch(
      `${MANYCHAT_API_URL}?phone=${phone.replace(/\D/g, "")}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${MANYCHAT_API_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error("[ManyChat] Get subscriber failed:", error);
    return null;
  }
}
