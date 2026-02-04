import { decimal, int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, index } from "drizzle-orm/mysql-core";
import { relations, type RelationsConfig } from "drizzle-orm";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Perfis de usuário (Motorista, Locador, Investidor, Funcionário)
export const profiles = mysqlTable("profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  profileType: mysqlEnum("profileType", ["motorista", "locador", "investidor", "funcionario"]).notNull(),
  cpf: varchar("cpf", { length: 14 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 2 }),
  zipCode: varchar("zipCode", { length: 10 }),
  documentStatus: mysqlEnum("documentStatus", ["pendente", "verificado", "rejeitado"]).default("pendente"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("userId_idx").on(table.userId),
  cpfIdx: index("cpf_idx").on(table.cpf),
}));

export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = typeof profiles.$inferInsert;

// Veículos cadastrados por locadores
export const vehicles = mysqlTable("vehicles", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  brand: varchar("brand", { length: 50 }).notNull(),
  model: varchar("model", { length: 100 }).notNull(),
  year: int("year").notNull(),
  licensePlate: varchar("licensePlate", { length: 10 }).notNull().unique(),
  color: varchar("color", { length: 50 }),
  fuelType: mysqlEnum("fuelType", ["gasolina", "diesel", "etanol", "eletrico", "hibrido"]),
  mileage: int("mileage"),
  dailyRate: decimal("dailyRate", { precision: 10, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["disponivel", "alugado", "manutencao", "inativo"]).default("disponivel"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  ownerIdIdx: index("ownerId_idx").on(table.ownerId),
  licensePlateIdx: index("licensePlate_idx").on(table.licensePlate),
}));

export type Vehicle = typeof vehicles.$inferSelect;
export type InsertVehicle = typeof vehicles.$inferInsert;

// Selfies capturadas durante cadastro
export const selfies = mysqlTable("selfies", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  s3Key: varchar("s3Key", { length: 255 }).notNull(),
  s3Url: text("s3Url").notNull(),
  driveFileId: varchar("driveFileId", { length: 255 }),
  driveFileUrl: text("driveFileUrl"),
  capturedAt: timestamp("capturedAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("userId_selfie_idx").on(table.userId),
}));

export type Selfie = typeof selfies.$inferSelect;
export type InsertSelfie = typeof selfies.$inferInsert;

// Documentos enviados (CNH, CRLV, etc.)
export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  documentType: mysqlEnum("documentType", ["cnh", "crlv", "rg", "comprovante_endereco"]).notNull(),
  s3Key: varchar("s3Key", { length: 255 }).notNull(),
  s3Url: text("s3Url").notNull(),
  driveFileId: varchar("driveFileId", { length: 255 }),
  driveFileUrl: text("driveFileUrl"),
  verificationStatus: mysqlEnum("verificationStatus", ["pendente", "verificado", "rejeitado"]).default("pendente"),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("userId_document_idx").on(table.userId),
  documentTypeIdx: index("documentType_idx").on(table.documentType),
}));

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

// Investimentos realizados
export const investments = mysqlTable("investments", {
  id: int("id").autoincrement().primaryKey(),
  investorId: int("investorId").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  monthlyRate: decimal("monthlyRate", { precision: 5, scale: 2 }).default("2.00"),
  investmentDate: timestamp("investmentDate").defaultNow().notNull(),
  withdrawalType: mysqlEnum("withdrawalType", ["mensal", "composto"]).default("mensal"),
  lastWithdrawalDate: timestamp("lastWithdrawalDate"),
  totalWithdrawn: decimal("totalWithdrawn", { precision: 12, scale: 2 }).default("0.00"),
  status: mysqlEnum("status", ["ativo", "finalizado", "suspenso"]).default("ativo"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  investorIdIdx: index("investorId_idx").on(table.investorId),
}));

export type Investment = typeof investments.$inferSelect;
export type InsertInvestment = typeof investments.$inferInsert;

// Aluguéis de veículos
export const rentals = mysqlTable("rentals", {
  id: int("id").autoincrement().primaryKey(),
  driverId: int("driverId").notNull(),
  vehicleId: int("vehicleId").notNull(),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  totalCost: decimal("totalCost", { precision: 10, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["ativo", "concluido", "cancelado"]).default("ativo"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  driverIdIdx: index("driverId_idx").on(table.driverId),
  vehicleIdIdx: index("vehicleId_idx").on(table.vehicleId),
}));

export type Rental = typeof rentals.$inferSelect;
export type InsertRental = typeof rentals.$inferInsert;

// Transações (aluguéis, resgates de investimentos)
export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["aluguel", "resgate_investimento", "deposito"]).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  stripeTransactionId: varchar("stripeTransactionId", { length: 255 }),
  status: mysqlEnum("status", ["pendente", "concluido", "falhou", "reembolsado"]).default("pendente"),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("userId_transaction_idx").on(table.userId),
  typeIdx: index("type_idx").on(table.type),
}));

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

// Notificações
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["novo_cadastro", "aluguel_vencido", "resgate_disponivel", "documento_verificado", "sistema"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content"),
  read: boolean("read").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("userId_notification_idx").on(table.userId),
}));

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// Relacionamentos
export const usersRelations = relations(users, ({ many }) => ({
  profiles: many(profiles),
  selfies: many(selfies),
  documents: many(documents),
  investments: many(investments),
  rentals: many(rentals),
  transactions: many(transactions),
  notifications: many(notifications),
  ownedVehicles: many(vehicles),
}));

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, {
    fields: [profiles.userId],
    references: [users.id],
  }),
}));

export const vehiclesRelations = relations(vehicles, ({ one, many }) => ({
  owner: one(users, {
    fields: [vehicles.ownerId],
    references: [users.id],
  }),
  rentals: many(rentals),
}));

export const selfiesRelations = relations(selfies, ({ one }) => ({
  user: one(users, {
    fields: [selfies.userId],
    references: [users.id],
  }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  user: one(users, {
    fields: [documents.userId],
    references: [users.id],
  }),
}));

export const investmentsRelations = relations(investments, ({ one, many }) => ({
  investor: one(users, {
    fields: [investments.investorId],
    references: [users.id],
  }),
  transactions: many(transactions),
}));

export const rentalsRelations = relations(rentals, ({ one }) => ({
  driver: one(users, {
    fields: [rentals.driverId],
    references: [users.id],
  }),
  vehicle: one(vehicles, {
    fields: [rentals.vehicleId],
    references: [vehicles.id],
  }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));
