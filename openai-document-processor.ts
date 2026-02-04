import OpenAI from "openai";
import { ENV } from "./_core/env";

const openai = new OpenAI({
  apiKey: ENV.openaiApiKey,
});

/**
 * Processar documento com OpenAI Vision (extrair texto de imagem)
 */
export async function processDocumentImage(imageBase64: string, documentType: "cnh" | "crlv" | "rg") {
  try {
    const prompt = getDocumentPrompt(documentType);

    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 1024,
    });

    const extractedText = response.choices[0]?.message?.content || "";

    return {
      success: true,
      extractedText,
      documentType,
      processedAt: new Date(),
    };
  } catch (error) {
    console.error("[OpenAI] Document processing failed:", error);
    throw error;
  }
}

/**
 * Validar documento com OpenAI
 */
export async function validateDocument(
  documentType: "cnh" | "crlv" | "rg",
  extractedData: Record<string, any>
) {
  try {
    const validationPrompt = `
    Você é um especialista em validação de documentos brasileiros.
    
    Tipo de documento: ${documentType}
    Dados extraídos: ${JSON.stringify(extractedData)}
    
    Valide se os dados estão corretos e completos para um ${documentType}.
    Retorne um JSON com:
    {
      "isValid": boolean,
      "missingFields": string[],
      "errors": string[],
      "warnings": string[]
    }
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "user",
          content: validationPrompt,
        },
      ],
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content || "{}";
    const validation = JSON.parse(content);

    return validation;
  } catch (error) {
    console.error("[OpenAI] Document validation failed:", error);
    throw error;
  }
}

/**
 * Extrair dados estruturados de documento
 */
export async function extractStructuredData(
  documentType: "cnh" | "crlv" | "rg",
  extractedText: string
) {
  try {
    const extractionPrompt = getExtractionPrompt(documentType);

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "user",
          content: `${extractionPrompt}\n\nTexto do documento:\n${extractedText}`,
        },
      ],
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content || "{}";
    const structuredData = JSON.parse(content);

    return structuredData;
  } catch (error) {
    console.error("[OpenAI] Data extraction failed:", error);
    throw error;
  }
}

/**
 * Detectar fraude em documento
 */
export async function detectFraud(
  documentType: "cnh" | "crlv" | "rg",
  imageBase64: string,
  extractedData: Record<string, any>
) {
  try {
    const fraudPrompt = `
    Você é um especialista em detecção de fraude de documentos.
    
    Analize a imagem e os dados extraídos para detectar possíveis fraudes:
    - Documento falsificado
    - Dados inconsistentes
    - Sinais de adulteração
    - Qualidade de imagem suspeita
    
    Retorne um JSON com:
    {
      "isFraudulent": boolean,
      "riskLevel": "low" | "medium" | "high" | "critical",
      "indicators": string[],
      "recommendations": string[]
    }
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: fraudPrompt,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 1024,
    });

    const content = response.choices[0]?.message?.content || "{}";
    const fraudAnalysis = JSON.parse(content);

    return fraudAnalysis;
  } catch (error) {
    console.error("[OpenAI] Fraud detection failed:", error);
    throw error;
  }
}

// ============ HELPER FUNCTIONS ============

function getDocumentPrompt(documentType: "cnh" | "crlv" | "rg"): string {
  const prompts = {
    cnh: `
    Extraia todos os dados visíveis da Carteira Nacional de Habilitação (CNH).
    Inclua: número da CNH, nome, data de nascimento, CPF, validade, categorias, etc.
    Retorne como texto estruturado.
    `,
    crlv: `
    Extraia todos os dados visíveis do Certificado de Registro e Licenciamento do Veículo (CRLV).
    Inclua: placa, renavam, marca, modelo, ano, proprietário, etc.
    Retorne como texto estruturado.
    `,
    rg: `
    Extraia todos os dados visíveis do Registro Geral (RG).
    Inclua: número, nome, data de nascimento, filiação, naturalidade, etc.
    Retorne como texto estruturado.
    `,
  };

  return prompts[documentType];
}

function getExtractionPrompt(documentType: "cnh" | "crlv" | "rg"): string {
  const prompts = {
    cnh: `
    Extraia os dados da CNH e retorne um JSON com a seguinte estrutura:
    {
      "cnhNumber": string,
      "name": string,
      "birthDate": string (YYYY-MM-DD),
      "cpf": string,
      "validity": string (YYYY-MM-DD),
      "categories": string[],
      "issueDate": string (YYYY-MM-DD),
      "state": string
    }
    `,
    crlv: `
    Extraia os dados do CRLV e retorne um JSON com a seguinte estrutura:
    {
      "licensePlate": string,
      "renavam": string,
      "brand": string,
      "model": string,
      "year": number,
      "ownerName": string,
      "ownerCPF": string,
      "validity": string (YYYY-MM-DD)
    }
    `,
    rg: `
    Extraia os dados do RG e retorne um JSON com a seguinte estrutura:
    {
      "rgNumber": string,
      "name": string,
      "birthDate": string (YYYY-MM-DD),
      "filiation": string,
      "naturalness": string,
      "issueDate": string (YYYY-MM-DD),
      "state": string
    }
    `,
  };

  return prompts[documentType];
}
