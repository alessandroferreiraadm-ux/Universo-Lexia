import crypto from "crypto";

/**
 * Integração Sumsub para KYC (Know Your Customer)
 * Validação biométrica de identidade antes de transações
 */

const SUMSUB_API_URL = "https://api.sumsub.com";
const SUMSUB_APP_TOKEN = process.env.SUMSUB_APP_TOKEN || "";
const SUMSUB_SECRET_KEY = process.env.SUMSUB_SECRET_KEY || "";

interface SumsubApplicant {
  id: string;
  externalUserId: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  status: "pending" | "approved" | "rejected" | "expired";
}

interface SumsubDocument {
  idDocType: string;
  idDocSubType: string;
  country: string;
  firstName: string;
  lastName: string;
  dob: string;
  issuedDate: string;
  validUntil: string;
  number: string;
}

/**
 * Gerar assinatura para requisições Sumsub
 */
function generateSignature(
  method: string,
  path: string,
  body: string = "",
  timestamp: number = Date.now()
): string {
  const data = `${method}${path}${body}${Math.floor(timestamp / 1000)}`;
  return crypto.createHmac("sha256", SUMSUB_SECRET_KEY).update(data).digest("hex");
}

/**
 * Criar novo aplicante para KYC
 */
export async function createSumsubApplicant(
  externalUserId: string,
  email: string,
  phone: string,
  firstName: string,
  lastName: string
): Promise<SumsubApplicant> {
  try {
    const path = "/resources/applicants";
    const body = JSON.stringify({
      externalUserId,
      email,
      phone,
      firstName,
      lastName,
      country: "BR",
      lang: "pt",
    });

    const timestamp = Date.now();
    const signature = generateSignature("POST", path, body, timestamp);

    const response = await fetch(`${SUMSUB_API_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-App-Token": SUMSUB_APP_TOKEN,
        "X-App-Access-Ts": Math.floor(timestamp / 1000).toString(),
        "X-App-Access-Sig": signature,
      },
      body,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Sumsub error: ${JSON.stringify(error)}`);
    }

    const data = (await response.json()) as SumsubApplicant;
    return data;
  } catch (error) {
    console.error("[Sumsub] Create applicant failed:", error);
    throw error;
  }
}

/**
 * Obter status de KYC do aplicante
 */
export async function getSumsubApplicantStatus(applicantId: string): Promise<SumsubApplicant> {
  try {
    const path = `/resources/applicants/${applicantId}`;
    const timestamp = Date.now();
    const signature = generateSignature("GET", path, "", timestamp);

    const response = await fetch(`${SUMSUB_API_URL}${path}`, {
      method: "GET",
      headers: {
        "X-App-Token": SUMSUB_APP_TOKEN,
        "X-App-Access-Ts": Math.floor(timestamp / 1000).toString(),
        "X-App-Access-Sig": signature,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Sumsub error: ${JSON.stringify(error)}`);
    }

    const data = (await response.json()) as SumsubApplicant;
    return data;
  } catch (error) {
    console.error("[Sumsub] Get applicant status failed:", error);
    throw error;
  }
}

/**
 * Gerar token de acesso para o SDK Sumsub (frontend)
 */
export async function generateSumsubAccessToken(applicantId: string): Promise<string> {
  try {
    const path = `/resources/accessTokens?userId=${applicantId}`;
    const timestamp = Date.now();
    const signature = generateSignature("POST", path, "", timestamp);

    const response = await fetch(`${SUMSUB_API_URL}${path}`, {
      method: "POST",
      headers: {
        "X-App-Token": SUMSUB_APP_TOKEN,
        "X-App-Access-Ts": Math.floor(timestamp / 1000).toString(),
        "X-App-Access-Sig": signature,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Sumsub error: ${JSON.stringify(error)}`);
    }

    const data = (await response.json()) as { token: string };
    return data.token;
  } catch (error) {
    console.error("[Sumsub] Generate access token failed:", error);
    throw error;
  }
}

/**
 * Upload de documento para KYC
 */
export async function uploadSumsubDocument(
  applicantId: string,
  documentType: "cnh" | "crlv" | "rg" | "passport",
  documentBase64: string,
  metadata: SumsubDocument
): Promise<{ success: boolean; message: string }> {
  try {
    const documentTypeMap = {
      cnh: { idDocType: "NATIONAL_ID", idDocSubType: "NATIONAL_ID" },
      crlv: { idDocType: "VEHICLE_REGISTRATION", idDocSubType: "VEHICLE_REGISTRATION" },
      rg: { idDocType: "NATIONAL_ID", idDocSubType: "NATIONAL_ID" },
      passport: { idDocType: "PASSPORT", idDocSubType: "PASSPORT" },
    };

    const docTypeConfig = documentTypeMap[documentType];

    const path = `/resources/applicants/${applicantId}/info/idDoc`;
    const body = JSON.stringify({
      ...docTypeConfig,
      ...metadata,
      country: "BR",
    });

    const timestamp = Date.now();
    const signature = generateSignature("POST", path, body, timestamp);

    const response = await fetch(`${SUMSUB_API_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-App-Token": SUMSUB_APP_TOKEN,
        "X-App-Access-Ts": Math.floor(timestamp / 1000).toString(),
        "X-App-Access-Sig": signature,
      },
      body,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Sumsub error: ${JSON.stringify(error)}`);
    }

    return {
      success: true,
      message: "Documento enviado com sucesso para análise",
    };
  } catch (error) {
    console.error("[Sumsub] Upload document failed:", error);
    throw error;
  }
}

/**
 * Submeter aplicante para revisão
 */
export async function submitSumsubApplicant(applicantId: string): Promise<SumsubApplicant> {
  try {
    const path = `/resources/applicants/${applicantId}/status/pending`;
    const timestamp = Date.now();
    const signature = generateSignature("POST", path, "", timestamp);

    const response = await fetch(`${SUMSUB_API_URL}${path}`, {
      method: "POST",
      headers: {
        "X-App-Token": SUMSUB_APP_TOKEN,
        "X-App-Access-Ts": Math.floor(timestamp / 1000).toString(),
        "X-App-Access-Sig": signature,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Sumsub error: ${JSON.stringify(error)}`);
    }

    const data = (await response.json()) as SumsubApplicant;
    return data;
  } catch (error) {
    console.error("[Sumsub] Submit applicant failed:", error);
    throw error;
  }
}

/**
 * Verificar se usuário passou no KYC
 */
export async function isKYCApproved(applicantId: string): Promise<boolean> {
  try {
    const applicant = await getSumsubApplicantStatus(applicantId);
    return applicant.status === "approved";
  } catch (error) {
    console.error("[Sumsub] KYC check failed:", error);
    return false;
  }
}

/**
 * Webhook handler para atualizações de KYC do Sumsub
 */
export function handleSumsubWebhook(payload: any): {
  applicantId: string;
  status: "pending" | "approved" | "rejected" | "expired";
  reviewResult?: any;
} {
  const { applicantId, status, reviewResult } = payload;

  return {
    applicantId,
    status,
    reviewResult,
  };
}

/**
 * Validar assinatura do webhook Sumsub
 */
export function validateSumsubWebhookSignature(
  body: string,
  signature: string
): boolean {
  const calculatedSignature = crypto
    .createHmac("sha256", SUMSUB_SECRET_KEY)
    .update(body)
    .digest("hex");

  return calculatedSignature === signature;
}
