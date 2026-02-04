/**
 * Integração Asaas para Pagamentos
 * Gerenciamento de cobranças, contratos e transações
 */

const ASAAS_API_URL = "https://api.asaas.com/v3";
const ASAAS_API_KEY = process.env.ASAAS_API_KEY || "";

interface AsaasCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  cpfCnpj: string;
}

interface AsaasPayment {
  id: string;
  customer: string;
  value: number;
  dueDate: string;
  status: "PENDING" | "RECEIVED" | "OVERDUE" | "CANCELLED";
  description: string;
}

interface AsaasContract {
  id: string;
  customer: string;
  value: number;
  status: "ACTIVE" | "INACTIVE" | "COMPLETED";
  description: string;
}

/**
 * Criar cliente no Asaas
 */
export async function createAsaasCustomer(
  name: string,
  email: string,
  phone: string,
  cpfCnpj: string
): Promise<AsaasCustomer> {
  try {
    const response = await fetch(`${ASAAS_API_URL}/customers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access_token": ASAAS_API_KEY,
      },
      body: JSON.stringify({
        name,
        email,
        phone,
        cpfCnpj,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Asaas error: ${JSON.stringify(error)}`);
    }

    const data = (await response.json()) as AsaasCustomer;
    return data;
  } catch (error) {
    console.error("[Asaas] Create customer failed:", error);
    throw error;
  }
}

/**
 * Criar cobrança no Asaas
 */
export async function createAsaasPayment(
  customerId: string,
  value: number,
  dueDate: string,
  description: string,
  billingType: "BOLETO" | "CREDIT_CARD" | "PIX" = "PIX"
): Promise<AsaasPayment> {
  try {
    const response = await fetch(`${ASAAS_API_URL}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access_token": ASAAS_API_KEY,
      },
      body: JSON.stringify({
        customer: customerId,
        value,
        dueDate,
        description,
        billingType,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Asaas error: ${JSON.stringify(error)}`);
    }

    const data = (await response.json()) as AsaasPayment;
    return data;
  } catch (error) {
    console.error("[Asaas] Create payment failed:", error);
    throw error;
  }
}

/**
 * Obter status de cobrança
 */
export async function getAsaasPaymentStatus(paymentId: string): Promise<AsaasPayment> {
  try {
    const response = await fetch(`${ASAAS_API_URL}/payments/${paymentId}`, {
      method: "GET",
      headers: {
        "access_token": ASAAS_API_KEY,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Asaas error: ${JSON.stringify(error)}`);
    }

    const data = (await response.json()) as AsaasPayment;
    return data;
  } catch (error) {
    console.error("[Asaas] Get payment status failed:", error);
    throw error;
  }
}

/**
 * Listar cobranças de um cliente
 */
export async function listAsaasPayments(
  customerId: string,
  status?: "PENDING" | "RECEIVED" | "OVERDUE"
): Promise<AsaasPayment[]> {
  try {
    const params = new URLSearchParams({
      customer: customerId,
      ...(status && { status }),
    });

    const response = await fetch(`${ASAAS_API_URL}/payments?${params}`, {
      method: "GET",
      headers: {
        "access_token": ASAAS_API_KEY,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Asaas error: ${JSON.stringify(error)}`);
    }

    const data = (await response.json()) as { data: AsaasPayment[] };
    return data.data;
  } catch (error) {
    console.error("[Asaas] List payments failed:", error);
    throw error;
  }
}

/**
 * Cancelar cobrança
 */
export async function cancelAsaasPayment(paymentId: string): Promise<{ success: boolean }> {
  try {
    const response = await fetch(`${ASAAS_API_URL}/payments/${paymentId}`, {
      method: "DELETE",
      headers: {
        "access_token": ASAAS_API_KEY,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Asaas error: ${JSON.stringify(error)}`);
    }

    return { success: true };
  } catch (error) {
    console.error("[Asaas] Cancel payment failed:", error);
    throw error;
  }
}

/**
 * Criar assinatura/contrato recorrente
 */
export async function createAsaasSubscription(
  customerId: string,
  value: number,
  billingType: "BOLETO" | "CREDIT_CARD" | "PIX",
  cycle: "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "ANNUAL" = "MONTHLY",
  description: string = "Assinatura Léxia"
): Promise<AsaasContract> {
  try {
    const response = await fetch(`${ASAAS_API_URL}/subscriptions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access_token": ASAAS_API_KEY,
      },
      body: JSON.stringify({
        customer: customerId,
        value,
        billingType,
        cycle,
        description,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Asaas error: ${JSON.stringify(error)}`);
    }

    const data = (await response.json()) as AsaasContract;
    return data;
  } catch (error) {
    console.error("[Asaas] Create subscription failed:", error);
    throw error;
  }
}

/**
 * Obter PIX QR Code para pagamento
 */
export async function getAsaasPixQRCode(paymentId: string): Promise<{
  qrCode: string;
  qrCodeUrl: string;
  brCode: string;
}> {
  try {
    const response = await fetch(`${ASAAS_API_URL}/payments/${paymentId}/pixQrCode`, {
      method: "GET",
      headers: {
        "access_token": ASAAS_API_KEY,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Asaas error: ${JSON.stringify(error)}`);
    }

    const data = (await response.json()) as {
      qrCode: string;
      qrCodeUrl: string;
      brCode: string;
    };
    return data;
  } catch (error) {
    console.error("[Asaas] Get PIX QR Code failed:", error);
    throw error;
  }
}

/**
 * Webhook handler para atualizações de pagamento
 */
export function handleAsaasWebhook(payload: any): {
  paymentId: string;
  status: string;
  value: number;
  customer: string;
} {
  const { id, status, value, customer } = payload;

  return {
    paymentId: id,
    status,
    value,
    customer,
  };
}

/**
 * Fluxo completo: Criar cliente → Cobrança → PIX
 */
export async function orchestratePaymentFlow(data: {
  userId: string;
  name: string;
  email: string;
  phone: string;
  cpf: string;
  amount: number;
  description: string;
  dueDate: string;
}): Promise<{
  customerId: string;
  paymentId: string;
  pixQrCode?: string;
}> {
  try {
    // 1. Criar cliente
    const customer = await createAsaasCustomer(
      data.name,
      data.email,
      data.phone,
      data.cpf
    );

    // 2. Criar cobrança PIX
    const payment = await createAsaasPayment(
      customer.id,
      data.amount,
      data.dueDate,
      data.description,
      "PIX"
    );

    // 3. Obter QR Code PIX
    const pixData = await getAsaasPixQRCode(payment.id);

    return {
      customerId: customer.id,
      paymentId: payment.id,
      pixQrCode: pixData.qrCode,
    };
  } catch (error) {
    console.error("[Asaas] Orchestrate payment flow failed:", error);
    throw error;
  }
}

/**
 * Gerar boleto para cobrança
 */
export async function generateAsaasBoleto(paymentId: string): Promise<{
  boletoUrl: string;
  boletoCode: string;
}> {
  try {
    const response = await fetch(`${ASAAS_API_URL}/payments/${paymentId}`, {
      method: "GET",
      headers: {
        "access_token": ASAAS_API_KEY,
      },
    });

    if (!response.ok) {
      throw new Error("Erro ao obter dados do boleto");
    }

    const data = (await response.json()) as any;

    return {
      boletoUrl: data.bankSlipUrl || "",
      boletoCode: data.bankSlipCode || "",
    };
  } catch (error) {
    console.error("[Asaas] Generate boleto failed:", error);
    throw error;
  }
}
