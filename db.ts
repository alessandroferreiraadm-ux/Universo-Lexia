import { eq, and, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, profiles, InsertProfile, vehicles, InsertVehicle, selfies, InsertSelfie, documents, InsertDocument, investments, InsertInvestment, rentals, InsertRental, transactions, InsertTransaction, notifications, InsertNotification } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============ USER OPERATIONS ============

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ PROFILE OPERATIONS ============

export async function createProfile(profile: InsertProfile) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(profiles).values(profile);
  return result;
}

export async function getProfileByUserId(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function checkCpfExists(cpf: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select().from(profiles).where(eq(profiles.cpf, cpf)).limit(1);
  return result.length > 0;
}

export async function getProfilesByType(profileType: "motorista" | "locador" | "investidor" | "funcionario") {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(profiles).where(eq(profiles.profileType, profileType));
}

// ============ VEHICLE OPERATIONS ============

export async function createVehicle(vehicle: InsertVehicle) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(vehicles).values(vehicle);
  return result;
}

export async function checkLicensePlateExists(licensePlate: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select().from(vehicles).where(eq(vehicles.licensePlate, licensePlate)).limit(1);
  return result.length > 0;
}

export async function getVehiclesByOwnerId(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(vehicles).where(eq(vehicles.ownerId, ownerId));
}

export async function getAllVehicles() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(vehicles);
}

// ============ SELFIE OPERATIONS ============

export async function createSelfie(selfie: InsertSelfie) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(selfies).values(selfie);
  return result;
}

export async function getSelfieByUserId(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(selfies).where(eq(selfies.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ DOCUMENT OPERATIONS ============

export async function createDocument(document: InsertDocument) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(documents).values(document);
  return result;
}

export async function getDocumentsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(documents).where(eq(documents.userId, userId));
}

export async function getDocumentByUserAndType(userId: number, documentType: "cnh" | "crlv" | "rg" | "comprovante_endereco") {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(documents).where(and(eq(documents.userId, userId), eq(documents.documentType, documentType))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ INVESTMENT OPERATIONS ============

export async function createInvestment(investment: InsertInvestment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(investments).values(investment);
  return result;
}

export async function getInvestmentsByInvestorId(investorId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(investments).where(eq(investments.investorId, investorId));
}

export async function getAllInvestments() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(investments);
}

// ============ RENTAL OPERATIONS ============

export async function createRental(rental: InsertRental) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(rentals).values(rental);
  return result;
}

export async function getRentalsByDriverId(driverId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(rentals).where(eq(rentals.driverId, driverId));
}

export async function getAllRentals() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(rentals);
}

// ============ TRANSACTION OPERATIONS ============

export async function createTransaction(transaction: InsertTransaction) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(transactions).values(transaction);
  return result;
}

export async function getTransactionsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(transactions).where(eq(transactions.userId, userId)).orderBy(desc(transactions.createdAt));
}

export async function getAllTransactions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(transactions).orderBy(desc(transactions.createdAt));
}

// ============ NOTIFICATION OPERATIONS ============

export async function createNotification(notification: InsertNotification) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(notifications).values(notification);
  return result;
}

export async function getNotificationsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt));
}

// ============ DASHBOARD METRICS ============

export async function getDashboardMetrics() {
  const db = await getDb();
  if (!db) return null;

  const motoristas = await db.select().from(profiles).where(eq(profiles.profileType, "motorista"));
  const locadores = await db.select().from(profiles).where(eq(profiles.profileType, "locador"));
  const investidores = await db.select().from(profiles).where(eq(profiles.profileType, "investidor"));
  const funcionarios = await db.select().from(profiles).where(eq(profiles.profileType, "funcionario"));
  const allVehicles = await db.select().from(vehicles);
  const activeRentals = await db.select().from(rentals).where(eq(rentals.status, "ativo"));
  const allInvestments = await db.select().from(investments);

  return {
    totalMotoristas: motoristas.length,
    totalLocadores: locadores.length,
    totalInvestidores: investidores.length,
    totalFuncionarios: funcionarios.length,
    totalVehicles: allVehicles.length,
    activeRentals: activeRentals.length,
    totalInvestments: allInvestments.length,
  };
}
