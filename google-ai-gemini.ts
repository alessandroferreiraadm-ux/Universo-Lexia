/**
 * Google AI Studio (Gemini) Integration
 * Análise avançada de documentos e validação de KYC
 */

const GOOGLE_AI_API_KEY = process.env.GOOGLE_CLOUD_API_KEY || "";
const GOOGLE_AI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent";

interface GeminiAnalysisResult {
  isValid: boolean;
  riskScore: number;
  extractedData: Record<string, any>;
  issues: string[];
  recommendations: string[];
  confidence: number;
}

/**
 * Analisar documento com Gemini Vision
 */
export async function analyzeDocumentWithGemini(
  imageBase64: string,
  documentType: "cnh" | "crlv" | "rg",
  mimeType: string = "image/jpeg"
): Promise<GeminiAnalysisResult> {
  try {
    const prompt = `
    Você é um especialista em validação de documentos brasileiros.
    
    Analise esta imagem de ${documentType === "cnh" ? "CNH (Carteira de Habilitação)" : documentType === "crlv" ? "CRLV (Certificado de Registro)" : "RG (Registro Geral)"}.
    
    Extraia e valide:
    1. Nome completo
    2. CPF/CNPJ
    3. Data de nascimento
    4. Data de validade
    5. Número do documento
    6. Órgão emissor
    7. Qualidade da imagem (0-100)
    8. Sinais de adulteração ou falsificação
    9. Legibilidade dos dados
    10. Conformidade com padrões brasileiros
    
    Retorne um JSON com:
    {
      "isValid": boolean,
      "riskScore": 0-100,
      "extractedData": {
        "name": string,
        "cpf": string,
        "birthDate": string,
        "expiryDate": string,
        "documentNumber": string,
        "issuer": string
      },
      "issues": ["issue1", "issue2"],
      "recommendations": ["rec1", "rec2"],
      "confidence": 0-1,
      "qualityScore": 0-100,
      "fraudIndicators": ["indicator1", "indicator2"]
    }
    `;

    const request = {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
            {
              inlineData: {
                mimeType,
                data: imageBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      },
    };

    const response = await fetch(`${GOOGLE_AI_URL}?key=${GOOGLE_AI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Gemini error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    // Extrair JSON da resposta
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    return {
      isValid: result.isValid || false,
      riskScore: result.riskScore || 50,
      extractedData: result.extractedData || {},
      issues: result.issues || [],
      recommendations: result.recommendations || [],
      confidence: result.confidence || 0,
    };
  } catch (error) {
    console.error("[Gemini] Document analysis failed:", error);
    throw error;
  }
}

/**
 * Comparar selfie com documento usando Gemini
 */
export async function compareFaceWithGemini(
  selfieBase64: string,
  documentImageBase64: string
): Promise<{
  match: boolean;
  confidence: number;
  message: string;
  riskScore: number;
}> {
  try {
    const prompt = `
    Compare estas duas imagens:
    1. Primeira: Selfie de uma pessoa
    2. Segunda: Foto de um documento (CNH, RG ou CRLV)
    
    Analise:
    - Os rostos correspondem? (mesma pessoa)
    - Qualidade das imagens
    - Ângulos e iluminação
    - Sinais de manipulação
    
    Retorne JSON:
    {
      "match": boolean,
      "confidence": 0-1,
      "riskScore": 0-100,
      "issues": ["issue1"],
      "message": "análise detalhada"
    }
    `;

    const request = {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: selfieBase64,
              },
            },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: documentImageBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
    };

    const response = await fetch(`${GOOGLE_AI_URL}?key=${GOOGLE_AI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error("Gemini comparison failed");
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    return {
      match: result.match || false,
      confidence: result.confidence || 0,
      message: result.message || "Análise inconclusiva",
      riskScore: result.riskScore || 50,
    };
  } catch (error) {
    console.error("[Gemini] Face comparison failed:", error);
    throw error;
  }
}

/**
 * Detectar fraude com Gemini
 */
export async function detectFraudWithGemini(
  documentImageBase64: string,
  extractedData: Record<string, any>
): Promise<{
  isFraudulent: boolean;
  riskScore: number;
  fraudIndicators: string[];
  confidence: number;
}> {
  try {
    const prompt = `
    Analise esta imagem de documento e os dados extraídos para detectar fraude.
    
    Dados extraídos:
    ${JSON.stringify(extractedData)}
    
    Procure por:
    1. Sinais de adulteração (rasura, colagem, alteração)
    2. Inconsistências entre imagem e dados
    3. Padrões de documentos falsificados conhecidos
    4. Qualidade anormal (muito clara/escura, desfocada)
    5. Marcas de segurança faltando ou incorretas
    6. Fontes ou cores anormais
    7. Números de série inválidos
    8. Datas inconsistentes
    
    Retorne JSON:
    {
      "isFraudulent": boolean,
      "riskScore": 0-100,
      "fraudIndicators": ["indicator1", "indicator2"],
      "confidence": 0-1,
      "severity": "low" | "medium" | "high"
    }
    `;

    const request = {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: documentImageBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
    };

    const response = await fetch(`${GOOGLE_AI_URL}?key=${GOOGLE_AI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error("Gemini fraud detection failed");
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    return {
      isFraudulent: result.isFraudulent || false,
      riskScore: result.riskScore || 0,
      fraudIndicators: result.fraudIndicators || [],
      confidence: result.confidence || 0,
    };
  } catch (error) {
    console.error("[Gemini] Fraud detection failed:", error);
    throw error;
  }
}

/**
 * Fluxo completo de KYC com Gemini
 */
export async function performGeminiKYC(data: {
  userId: string;
  selfieBase64: string;
  documentBase64: string;
  documentType: "cnh" | "crlv" | "rg";
}): Promise<{
  status: "approved" | "rejected" | "manual_review";
  riskScore: number;
  extractedData: Record<string, any>;
  issues: string[];
  message: string;
}> {
  try {
    // 1. Analisar documento
    const documentAnalysis = await analyzeDocumentWithGemini(
      data.documentBase64,
      data.documentType
    );

    if (!documentAnalysis.isValid) {
      return {
        status: "rejected",
        riskScore: documentAnalysis.riskScore,
        extractedData: documentAnalysis.extractedData,
        issues: documentAnalysis.issues,
        message: "Documento inválido ou ilegível",
      };
    }

    // 2. Comparar selfie com documento
    const faceComparison = await compareFaceWithGemini(
      data.selfieBase64,
      data.documentBase64
    );

    if (!faceComparison.match) {
      return {
        status: "rejected",
        riskScore: Math.max(documentAnalysis.riskScore, faceComparison.riskScore),
        extractedData: documentAnalysis.extractedData,
        issues: [...documentAnalysis.issues, "Rosto não corresponde ao documento"],
        message: "Selfie não corresponde ao documento",
      };
    }

    // 3. Detectar fraude
    const fraudDetection = await detectFraudWithGemini(
      data.documentBase64,
      documentAnalysis.extractedData
    );

    if (fraudDetection.isFraudulent) {
      return {
        status: "rejected",
        riskScore: fraudDetection.riskScore,
        extractedData: documentAnalysis.extractedData,
        issues: fraudDetection.fraudIndicators,
        message: "Documento suspeito de falsificação",
      };
    }

    // 4. Calcular score final
    const finalRiskScore =
      (documentAnalysis.riskScore +
        faceComparison.riskScore +
        fraudDetection.riskScore) /
      3;

    let status: "approved" | "rejected" | "manual_review" = "approved";
    if (finalRiskScore > 70) {
      status = "manual_review";
    }
    if (finalRiskScore > 85) {
      status = "rejected";
    }

    return {
      status,
      riskScore: finalRiskScore,
      extractedData: documentAnalysis.extractedData,
      issues: documentAnalysis.issues,
      message:
        status === "approved"
          ? "✅ KYC aprovado com sucesso!"
          : status === "manual_review"
            ? "⏳ Verificação será revisada manualmente"
            : "❌ Verificação rejeitada",
    };
  } catch (error) {
    console.error("[Gemini] Full KYC flow failed:", error);
    throw error;
  }
}
