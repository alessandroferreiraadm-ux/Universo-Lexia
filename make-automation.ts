/**
 * Integração Make.com para Automação
 * Orquestração de fluxos entre Google Sheets, Asaas, WhatsApp e notificações
 */

const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL || "";

export interface MakeWebhookPayload {
  event: string;
  userId: string;
  data: Record<string, any>;
  timestamp: number;
}

/**
 * Enviar evento para Make.com
 */
export async function sendToMake(payload: MakeWebhookPayload): Promise<{ success: boolean; message: string }> {
  try {
    if (!MAKE_WEBHOOK_URL) {
      throw new Error("MAKE_WEBHOOK_URL não configurada");
    }

    const response = await fetch(MAKE_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...payload,
        timestamp: Date.now(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Make.com error: ${response.statusText}`);
    }

    return {
      success: true,
      message: "Evento enviado para Make.com com sucesso",
    };
  } catch (error) {
    console.error("[Make] Send webhook failed:", error);
    throw error;
  }
}

/**
 * Disparar fluxo de novo cadastro
 */
export async function triggerNewUserSignup(userData: {
  userId: string;
  name: string;
  email: string;
  phone: string;
  profileType: "motorista" | "locador" | "investidor" | "funcionario";
}): Promise<void> {
  await sendToMake({
    event: "novo_cadastro",
    userId: userData.userId,
    data: userData,
  });
}

/**
 * Disparar sincronização com Google Sheets
 */
export async function triggerGoogleSheetSync(data: {
  userId: string;
  profileType: string;
  profileData: Record<string, any>;
}): Promise<void> {
  await sendToMake({
    event: "sync_google_sheets",
    userId: data.userId,
    data,
  });
}

/**
 * Disparar notificação via WhatsApp
 */
export async function triggerWhatsAppNotification(data: {
  userId: string;
  phone: string;
  message: string;
  templateName?: string;
}): Promise<void> {
  await sendToMake({
    event: "whatsapp_notification",
    userId: data.userId,
    data,
  });
}

/**
 * Disparar criação de cobrança no Asaas
 */
export async function triggerAsaasCharge(data: {
  userId: string;
  customerId: string;
  amount: number;
  description: string;
  dueDate: string;
}): Promise<void> {
  await sendToMake({
    event: "create_asaas_charge",
    userId: data.userId,
    data,
  });
}

/**
 * Disparar notificação de KYC aprovado
 */
export async function triggerKYCApproved(data: {
  userId: string;
  email: string;
  phone: string;
  name: string;
}): Promise<void> {
  await sendToMake({
    event: "kyc_approved",
    userId: data.userId,
    data,
  });
}

/**
 * Disparar notificação de resgate disponível
 */
export async function triggerWithdrawalAvailable(data: {
  userId: string;
  email: string;
  phone: string;
  amount: number;
  investmentId: string;
}): Promise<void> {
  await sendToMake({
    event: "withdrawal_available",
    userId: data.userId,
    data,
  });
}

/**
 * Disparar notificação de aluguel vencido
 */
export async function triggerRentalExpiring(data: {
  userId: string;
  email: string;
  phone: string;
  rentalId: string;
  daysUntilExpiry: number;
  amount: number;
}): Promise<void> {
  await sendToMake({
    event: "rental_expiring",
    userId: data.userId,
    data,
  });
}

/**
 * Disparar sincronização de documento verificado
 */
export async function triggerDocumentVerified(data: {
  userId: string;
  email: string;
  phone: string;
  documentType: string;
}): Promise<void> {
  await sendToMake({
    event: "document_verified",
    userId: data.userId,
    data,
  });
}

/**
 * Disparar envio de contrato para assinatura
 */
export async function triggerContractSending(data: {
  userId: string;
  email: string;
  contractId: string;
  contractType: "aluguel" | "investimento" | "locacao";
  amount: number;
}): Promise<void> {
  await sendToMake({
    event: "send_contract",
    userId: data.userId,
    data,
  });
}

/**
 * Disparar notificação de pagamento recebido
 */
export async function triggerPaymentReceived(data: {
  userId: string;
  email: string;
  phone: string;
  amount: number;
  transactionId: string;
  type: "aluguel" | "resgate_investimento" | "deposito";
}): Promise<void> {
  await sendToMake({
    event: "payment_received",
    userId: data.userId,
    data,
  });
}

/**
 * Disparar notificação de erro/falha
 */
export async function triggerErrorNotification(data: {
  userId: string;
  email: string;
  errorType: string;
  errorMessage: string;
  context: Record<string, any>;
}): Promise<void> {
  await sendToMake({
    event: "error_notification",
    userId: data.userId,
    data,
  });
}

/**
 * Fluxo completo: Novo usuário → Google Sheets → WhatsApp → Email
 */
export async function orchestrateNewUserFlow(userData: {
  userId: string;
  name: string;
  email: string;
  phone: string;
  profileType: "motorista" | "locador" | "investidor" | "funcionario";
  cpf: string;
}): Promise<void> {
  try {
    // 1. Registrar novo cadastro
    await triggerNewUserSignup(userData);

    // 2. Sincronizar com Google Sheets
    await triggerGoogleSheetSync({
      userId: userData.userId,
      profileType: userData.profileType,
      profileData: userData,
    });

    // 3. Enviar notificação WhatsApp
    await triggerWhatsAppNotification({
      userId: userData.userId,
      phone: userData.phone,
      message: `Bem-vindo à Léxia! Seu cadastro como ${userData.profileType} foi recebido. Próximo passo: verificação de identidade.`,
      templateName: "welcome_new_user",
    });

    console.log(`[Make] Fluxo de novo usuário orquestrado para ${userData.userId}`);
  } catch (error) {
    console.error("[Make] Orchestrate new user flow failed:", error);
    await triggerErrorNotification({
      userId: userData.userId,
      email: userData.email,
      errorType: "orchestration_error",
      errorMessage: error instanceof Error ? error.message : "Erro desconhecido",
      context: userData,
    });
  }
}

/**
 * Fluxo completo: KYC Aprovado → Notificações → Google Sheets
 */
export async function orchestrateKYCApprovedFlow(userData: {
  userId: string;
  name: string;
  email: string;
  phone: string;
}): Promise<void> {
  try {
    // 1. Notificar aprovação de KYC
    await triggerKYCApproved(userData);

    // 2. Sincronizar status com Google Sheets
    await triggerGoogleSheetSync({
      userId: userData.userId,
      profileType: "kyc_approved",
      profileData: {
        ...userData,
        kycStatus: "approved",
        approvedAt: new Date().toISOString(),
      },
    });

    // 3. Enviar WhatsApp
    await triggerWhatsAppNotification({
      userId: userData.userId,
      phone: userData.phone,
      message: `🎉 Parabéns ${userData.name}! Sua identidade foi verificada. Você já pode realizar transações na Léxia.`,
      templateName: "kyc_approved",
    });

    console.log(`[Make] Fluxo de KYC aprovado orquestrado para ${userData.userId}`);
  } catch (error) {
    console.error("[Make] Orchestrate KYC approved flow failed:", error);
    await triggerErrorNotification({
      userId: userData.userId,
      email: userData.email,
      errorType: "kyc_orchestration_error",
      errorMessage: error instanceof Error ? error.message : "Erro desconhecido",
      context: userData,
    });
  }
}

/**
 * Fluxo completo: Resgate Disponível → Asaas → Google Sheets → Notificações
 */
export async function orchestrateWithdrawalFlow(data: {
  userId: string;
  name: string;
  email: string;
  phone: string;
  amount: number;
  investmentId: string;
  customerId: string;
}): Promise<void> {
  try {
    // 1. Notificar resgate disponível
    await triggerWithdrawalAvailable({
      userId: data.userId,
      email: data.email,
      phone: data.phone,
      amount: data.amount,
      investmentId: data.investmentId,
    });

    // 2. Criar cobrança no Asaas (se necessário)
    if (data.customerId) {
      await triggerAsaasCharge({
        userId: data.userId,
        customerId: data.customerId,
        amount: data.amount,
        description: `Resgate de investimento - ID: ${data.investmentId}`,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      });
    }

    // 3. Sincronizar com Google Sheets
    await triggerGoogleSheetSync({
      userId: data.userId,
      profileType: "withdrawal",
      profileData: {
        ...data,
        withdrawalStatus: "available",
        availableAt: new Date().toISOString(),
      },
    });

    // 4. Enviar WhatsApp
    await triggerWhatsAppNotification({
      userId: data.userId,
      phone: data.phone,
      message: `💰 Resgate disponível! Você tem R$ ${data.amount.toFixed(2)} pronto para sacar. Acesse seu painel para confirmar.`,
      templateName: "withdrawal_available",
    });

    console.log(`[Make] Fluxo de resgate orquestrado para ${data.userId}`);
  } catch (error) {
    console.error("[Make] Orchestrate withdrawal flow failed:", error);
    await triggerErrorNotification({
      userId: data.userId,
      email: data.email,
      errorType: "withdrawal_orchestration_error",
      errorMessage: error instanceof Error ? error.message : "Erro desconhecido",
      context: data,
    });
  }
}
