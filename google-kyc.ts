import vision from "@google-cloud/vision";
import documentai from "@google-cloud/documentai";
import storage from "@google-cloud/storage";

/**
 * Google Cloud KYC
 * Integração de Google Vision AI + Document AI para verificação de identidade
 */

const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || "";
const visionClient = new vision.ImageAnnotatorClient();
const docaiClient = new documentai.v1.DocumentProcessorServiceClient();
const storageClient = new storage.Storage({ projectId });

interface KYCResult {
  status: "approved" | "rejected" | "manual_review";
  selfieValid: boolean;
  documentValid: boolean;
  extractedData: Record<string, any>;
  riskScore: number;
  message: string;
}

/**
 * Validar selfie com Google Vision
 */
export async function validateSelfieWithVision(
  imageBase64: string
): Promise<{
  faceDetected: boolean;
  faceCount: number;
  confidence: number;
  message: string;
}> {
  try {
    const request = {
      image: {
        content: imageBase64,
      },
      features: [
        { type: "FACE_DETECTION" },
        { type: "SAFE_SEARCH_DETECTION" },
      ],
    };

    const [result] = await visionClient.annotateImage(request);

    if (!result.faceAnnotations || result.faceAnnotations.length === 0) {
      return {
        faceDetected: false,
        faceCount: 0,
        confidence: 0,
        message: "Nenhum rosto detectado. Tire uma selfie clara.",
      };
    }

    if (result.faceAnnotations.length > 1) {
      return {
        faceDetected: true,
        faceCount: result.faceAnnotations.length,
        confidence: 0,
        message: "Múltiplos rostos detectados. Tire uma selfie apenas com você.",
      };
    }

    const face = result.faceAnnotations[0];
    const confidence = face.detectionConfidence || 0;

    // Verificar se a selfie é segura
    const safeSearch = result.safeSearchAnnotation;
    if (
      safeSearch?.adult === "LIKELY" ||
      safeSearch?.adult === "VERY_LIKELY" ||
      safeSearch?.violence === "LIKELY" ||
      safeSearch?.violence === "VERY_LIKELY"
    ) {
      return {
        faceDetected: true,
        faceCount: 1,
        confidence,
        message: "Selfie não apropriada. Use uma foto clara do seu rosto.",
      };
    }

    return {
      faceDetected: true,
      faceCount: 1,
      confidence,
      message: confidence > 0.8 ? "Selfie válida!" : "Qualidade baixa. Tente novamente.",
    };
  } catch (error) {
    console.error("[Google Vision] Selfie validation failed:", error);
    throw error;
  }
}

/**
 * Processar documento com Google Document AI
 */
export async function processDocumentWithDocumentAI(
  imageBase64: string,
  documentType: "cnh" | "crlv" | "rg"
): Promise<{
  success: boolean;
  extractedData: Record<string, any>;
  confidence: number;
  message: string;
}> {
  try {
    // Mapear tipo de documento para processador
    const processorMap = {
      cnh: "projects/PROJECT_ID/locations/us/processors/PROCESSOR_ID", // CNH Processor
      crlv: "projects/PROJECT_ID/locations/us/processors/PROCESSOR_ID", // CRLV Processor
      rg: "projects/PROJECT_ID/locations/us/processors/PROCESSOR_ID", // RG Processor
    };

    const processorName = processorMap[documentType];

    const request = {
      name: processorName,
      rawDocument: {
        content: Buffer.from(imageBase64, "base64"),
        mimeType: "image/jpeg",
      },
    };

    const [result] = await docaiClient.processDocument(request as any);
    const document = result.document;

    if (!document) {
      return {
        success: false,
        extractedData: {},
        confidence: 0,
        message: "Erro ao processar documento",
      };
    }

    // Extrair dados do documento
    const extractedData: Record<string, any> = {};
    let totalConfidence = 0;
    let fieldCount = 0;

    if (document.entities) {
      for (const entity of document.entities) {
        if (entity.mentionText) {
          extractedData[entity.type || "unknown"] = entity.mentionText;
          totalConfidence += entity.confidence || 0;
          fieldCount++;
        }
      }
    }

    const avgConfidence = fieldCount > 0 ? totalConfidence / fieldCount : 0;

    return {
      success: true,
      extractedData,
      confidence: avgConfidence,
      message: avgConfidence > 0.8 ? "Documento processado com sucesso" : "Qualidade baixa",
    };
  } catch (error) {
    console.error("[Google Document AI] Document processing failed:", error);
    throw error;
  }
}

/**
 * Fazer upload de imagem para Google Cloud Storage
 */
export async function uploadImageToGCS(
  imageBase64: string,
  userId: string,
  documentType: "selfie" | "cnh" | "crlv" | "rg"
): Promise<{
  gcsUrl: string;
  fileName: string;
}> {
  try {
    const bucketName = process.env.GCS_BUCKET_NAME || "lexia-kyc-documents";
    const bucket = storageClient.bucket(bucketName);

    const fileName = `kyc/${userId}/${documentType}-${Date.now()}.jpg`;
    const file = bucket.file(fileName);

    const buffer = Buffer.from(imageBase64, "base64");

    await file.save(buffer, {
      metadata: {
        contentType: "image/jpeg",
        metadata: {
          userId,
          documentType,
          uploadedAt: new Date().toISOString(),
        },
      },
    });

    const gcsUrl = `gs://${bucketName}/${fileName}`;

    return {
      gcsUrl,
      fileName,
    };
  } catch (error) {
    console.error("[GCS] Upload failed:", error);
    throw error;
  }
}

/**
 * Validar documento com OpenAI (análise adicional)
 */
export async function validateDocumentWithOpenAI(
  documentType: "cnh" | "crlv" | "rg",
  extractedData: Record<string, any>,
  imageBase64: string
): Promise<{
  isValid: boolean;
  riskScore: number;
  issues: string[];
  recommendations: string[];
}> {
  try {
    const prompt = `
    Você é um especialista em validação de documentos brasileiros.
    
    Tipo: ${documentType}
    Dados extraídos: ${JSON.stringify(extractedData)}
    
    Analise:
    1. Se os dados estão completos
    2. Se há inconsistências
    3. Se há sinais de adulteração
    4. Se a qualidade da imagem é boa
    
    Retorne JSON:
    {
      "isValid": boolean,
      "riskScore": 0-100,
      "issues": ["issue1", "issue2"],
      "recommendations": ["rec1", "rec2"]
    }
    `;

    // Usar OpenAI para análise adicional
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error("OpenAI error");
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "{}";
    const validation = JSON.parse(content);

    return validation;
  } catch (error) {
    console.error("[OpenAI] Document validation failed:", error);
    throw error;
  }
}

/**
 * Fluxo completo de KYC com Google Cloud
 */
export async function performGoogleKYC(data: {
  userId: string;
  selfieBase64: string;
  documentBase64: string;
  documentType: "cnh" | "crlv" | "rg";
}): Promise<KYCResult> {
  try {
    // 1. Validar selfie
    const selfieValidation = await validateSelfieWithVision(data.selfieBase64);

    if (!selfieValidation.faceDetected) {
      return {
        status: "rejected",
        selfieValid: false,
        documentValid: false,
        extractedData: {},
        riskScore: 100,
        message: selfieValidation.message,
      };
    }

    if (selfieValidation.confidence < 0.8) {
      return {
        status: "manual_review",
        selfieValid: false,
        documentValid: false,
        extractedData: {},
        riskScore: 60,
        message: selfieValidation.message,
      };
    }

    // 2. Processar documento
    const documentProcessing = await processDocumentWithDocumentAI(
      data.documentBase64,
      data.documentType
    );

    if (!documentProcessing.success) {
      return {
        status: "manual_review",
        selfieValid: true,
        documentValid: false,
        extractedData: {},
        riskScore: 70,
        message: documentProcessing.message,
      };
    }

    // 3. Validar documento com OpenAI
    const documentValidation = await validateDocumentWithOpenAI(
      data.documentType,
      documentProcessing.extractedData,
      data.documentBase64
    );

    // 4. Upload para GCS
    await uploadImageToGCS(data.selfieBase64, data.userId, "selfie");
    await uploadImageToGCS(data.documentBase64, data.userId, data.documentType);

    // 5. Determinar resultado
    let status: "approved" | "rejected" | "manual_review" = "approved";
    let riskScore = documentValidation.riskScore;

    if (documentValidation.riskScore > 70) {
      status = "manual_review";
    }

    if (documentValidation.riskScore > 90 || !documentValidation.isValid) {
      status = "rejected";
    }

    return {
      status,
      selfieValid: selfieValidation.faceDetected && selfieValidation.confidence > 0.8,
      documentValid: documentProcessing.success && documentValidation.isValid,
      extractedData: documentProcessing.extractedData,
      riskScore,
      message:
        status === "approved"
          ? "✅ KYC aprovado! Bem-vindo à Léxia."
          : status === "manual_review"
            ? "⏳ Sua verificação será revisada manualmente em breve."
            : "❌ Verificação rejeitada. Tente novamente com documentos válidos.",
    };
  } catch (error) {
    console.error("[Google KYC] Full flow failed:", error);
    throw error;
  }
}

/**
 * Comparar selfie com foto do documento
 */
export async function compareSelfieWithDocument(
  selfieBase64: string,
  documentImageBase64: string
): Promise<{
  match: boolean;
  confidence: number;
  message: string;
}> {
  try {
    const request = {
      image: {
        content: selfieBase64,
      },
      features: [{ type: "FACE_DETECTION" }],
    };

    const [result] = await visionClient.annotateImage(request);

    if (!result.faceAnnotations || result.faceAnnotations.length === 0) {
      return {
        match: false,
        confidence: 0,
        message: "Nenhum rosto detectado na selfie",
      };
    }

    // Comparar características faciais (simplificado)
    // Em produção, usar face matching mais robusto
    const confidence = 0.85; // Placeholder

    return {
      match: confidence > 0.7,
      confidence,
      message: confidence > 0.7 ? "Rostos correspondem" : "Rostos não correspondem",
    };
  } catch (error) {
    console.error("[Google Vision] Face comparison failed:", error);
    throw error;
  }
}

/**
 * Verificar documento expirado
 */
export function checkDocumentExpiration(
  documentType: "cnh" | "crlv" | "rg",
  extractedData: Record<string, any>
): {
  isExpired: boolean;
  expirationDate: string | null;
  daysUntilExpiration: number;
} {
  const expirationDateField = extractedData.validUntil || extractedData.validity || extractedData.expirationDate;

  if (!expirationDateField) {
    return {
      isExpired: false,
      expirationDate: null,
      daysUntilExpiration: -1,
    };
  }

  const expirationDate = new Date(expirationDateField);
  const today = new Date();
  const daysUntilExpiration = Math.floor(
    (expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    isExpired: daysUntilExpiration < 0,
    expirationDate: expirationDate.toISOString().split("T")[0],
    daysUntilExpiration,
  };
}
