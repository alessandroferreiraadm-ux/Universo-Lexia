import { google } from "googleapis";
import { ENV } from "./_core/env";

let driveClient: ReturnType<typeof google.drive> | null = null;
let sheetsClient: ReturnType<typeof google.sheets> | null = null;

/**
 * Inicializar cliente Google Drive com API Key
 */
export function initGoogleDrive() {
  if (!driveClient) {
    driveClient = google.drive({
      version: "v3",
      auth: ENV.googleCloudApiKey,
    });
  }
  return driveClient;
}

/**
 * Inicializar cliente Google Sheets com API Key
 */
export function initGoogleSheets() {
  if (!sheetsClient) {
    sheetsClient = google.sheets({
      version: "v4",
      auth: ENV.googleCloudApiKey,
    });
  }
  return sheetsClient;
}

/**
 * Upload de arquivo para Google Drive
 */
export async function uploadToDrive(
  fileName: string,
  mimeType: string,
  fileContent: Buffer,
  parentFolderId?: string
) {
  try {
    const drive = initGoogleDrive();

    const fileMetadata: any = {
      name: fileName,
      mimeType,
    };

    if (parentFolderId) {
      fileMetadata.parents = [parentFolderId];
    }

    const media = {
      mimeType,
      body: fileContent,
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: "id, webViewLink, webContentLink",
    });

    return {
      fileId: response.data.id,
      webViewLink: response.data.webViewLink,
      webContentLink: response.data.webContentLink,
    };
  } catch (error) {
    console.error("[Google Drive] Upload failed:", error);
    throw error;
  }
}

/**
 * Criar pasta no Google Drive
 */
export async function createDriveFolder(folderName: string, parentFolderId?: string) {
  try {
    const drive = initGoogleDrive();

    const fileMetadata: any = {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
    };

    if (parentFolderId) {
      fileMetadata.parents = [parentFolderId];
    }

    const response = await drive.files.create({
      requestBody: fileMetadata,
      fields: "id, webViewLink",
    });

    return {
      folderId: response.data.id,
      webViewLink: response.data.webViewLink,
    };
  } catch (error) {
    console.error("[Google Drive] Folder creation failed:", error);
    throw error;
  }
}

/**
 * Adicionar dados a Google Sheets
 */
export async function appendToSheet(
  spreadsheetId: string,
  range: string,
  values: (string | number | boolean)[][]
) {
  try {
    const sheets = initGoogleSheets();

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values,
      },
    });

    return response.data;
  } catch (error) {
    console.error("[Google Sheets] Append failed:", error);
    throw error;
  }
}

/**
 * Ler dados de Google Sheets
 */
export async function readFromSheet(spreadsheetId: string, range: string) {
  try {
    const sheets = initGoogleSheets();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    return response.data.values || [];
  } catch (error) {
    console.error("[Google Sheets] Read failed:", error);
    throw error;
  }
}

/**
 * Atualizar dados em Google Sheets
 */
export async function updateSheet(
  spreadsheetId: string,
  range: string,
  values: (string | number | boolean)[][]
) {
  try {
    const sheets = initGoogleSheets();

    const response = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values,
      },
    });

    return response.data;
  } catch (error) {
    console.error("[Google Sheets] Update failed:", error);
    throw error;
  }
}

/**
 * Criar nova aba em Google Sheets
 */
export async function createSheet(spreadsheetId: string, sheetTitle: string) {
  try {
    const sheets = initGoogleSheets();

    const response = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetTitle,
              },
            },
          },
        ],
      },
    });

    return response.data;
  } catch (error) {
    console.error("[Google Sheets] Sheet creation failed:", error);
    throw error;
  }
}

/**
 * Sincronizar perfil de usuário com Google Sheets
 */
export async function syncProfileToSheets(
  spreadsheetId: string,
  profileType: "motorista" | "locador" | "investidor" | "funcionario",
  profileData: Record<string, any>
) {
  try {
    const sheetNameMap = {
      motorista: "Motoristas",
      locador: "Locadores",
      investidor: "Investidores",
      funcionario: "Funcionários",
    };

    const sheetName = sheetNameMap[profileType];
    const range = `${sheetName}!A:Z`;

    // Preparar dados para inserção
    const values = [
      [
        profileData.id,
        profileData.name,
        profileData.cpf,
        profileData.email,
        profileData.phone,
        profileData.address,
        profileData.city,
        profileData.state,
        profileData.zipCode,
        new Date().toISOString(),
      ],
    ];

    await appendToSheet(spreadsheetId, range, values);

    return {
      success: true,
      message: `Perfil ${profileType} sincronizado com sucesso`,
    };
  } catch (error) {
    console.error("[Google Sheets] Profile sync failed:", error);
    throw error;
  }
}
