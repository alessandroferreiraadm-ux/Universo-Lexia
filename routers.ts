import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { storagePut } from "./storage";
import { notifyOwner } from "./_core/notification";

// ============ VALIDATION SCHEMAS ============

const createMotoristaSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  cpf: z.string().regex(/^\d{11}$/, "CPF deve ter 11 dígitos"),
  email: z.string().email("Email inválido"),
  phone: z.string().min(10, "Telefone inválido"),
  address: z.string().min(5, "Endereço inválido"),
  city: z.string().min(2, "Cidade inválida"),
  state: z.string().length(2, "Estado deve ter 2 caracteres"),
  zipCode: z.string().regex(/^\d{5}-?\d{3}$/, "CEP inválido"),
  selfieBase64: z.string().min(100, "Selfie inválida"),
  cnhBase64: z.string().min(100, "CNH inválida"),
});

const createLocadorSchema = z.object({
  name: z.string().min(3),
  cpf: z.string().regex(/^\d{11}$/),
  email: z.string().email(),
  phone: z.string().min(10),
  address: z.string().min(5),
  city: z.string().min(2),
  state: z.string().length(2),
  zipCode: z.string().regex(/^\d{5}-?\d{3}$/),
  selfieBase64: z.string().min(100),
  crlvBase64: z.string().min(100),
});

const createInvestidorSchema = z.object({
  name: z.string().min(3),
  cpf: z.string().regex(/^\d{11}$/),
  email: z.string().email(),
  phone: z.string().min(10),
  address: z.string().min(5),
  city: z.string().min(2),
  state: z.string().length(2),
  zipCode: z.string().regex(/^\d{5}-?\d{3}$/),
  initialInvestment: z.number().min(100, "Investimento mínimo é R$ 100"),
  selfieBase64: z.string().min(100),
});

const createFuncionarioSchema = z.object({
  name: z.string().min(3),
  cpf: z.string().regex(/^\d{11}$/),
  email: z.string().email(),
  phone: z.string().min(10),
  address: z.string().min(5),
  city: z.string().min(2),
  state: z.string().length(2),
  zipCode: z.string().regex(/^\d{5}-?\d{3}$/),
  cargo: z.string().min(3),
  departamento: z.string().min(3),
  selfieBase64: z.string().min(100),
});

const createVehicleSchema = z.object({
  brand: z.string().min(2),
  model: z.string().min(2),
  year: z.number().min(1900).max(new Date().getFullYear() + 1),
  licensePlate: z.string().regex(/^[A-Z]{3}-?\d{4}$/, "Placa inválida"),
  color: z.string().min(2),
  fuelType: z.enum(["gasolina", "diesel", "etanol", "eletrico", "hibrido"]),
  mileage: z.number().min(0),
  dailyRate: z.number().min(0.01),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // ============ CADASTRO ROUTERS ============

  cadastro: router({
    // Motorista (Locatário)
    createMotorista: publicProcedure
      .input(createMotoristaSchema)
      .mutation(async ({ input, ctx }) => {
        // Validar duplicidade de CPF
        const cpfExists = await db.checkCpfExists(input.cpf);
        if (cpfExists) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "CPF já cadastrado no sistema",
          });
        }

        // Criar usuário
        const user = await db.getUserByOpenId(ctx.user?.openId || "");
        if (!user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Usuário não autenticado",
          });
        }

        // Upload de selfie para S3
        const selfieBuffer = Buffer.from(input.selfieBase64, "base64");
        const selfieKey = `selfies/motorista/${user.id}-selfie-${Date.now()}.jpg`;
        const { url: selfieUrl } = await storagePut(selfieKey, selfieBuffer, "image/jpeg");

        // Upload de CNH para S3
        const cnhBuffer = Buffer.from(input.cnhBase64, "base64");
        const cnhKey = `documentos/motorista/${user.id}-cnh-${Date.now()}.pdf`;
        const { url: cnhUrl } = await storagePut(cnhKey, cnhBuffer, "application/pdf");

        // Criar perfil
        await db.createProfile({
          userId: user.id,
          profileType: "motorista",
          cpf: input.cpf,
          phone: input.phone,
          address: input.address,
          city: input.city,
          state: input.state,
          zipCode: input.zipCode,
        });

        // Criar selfie
        await db.createSelfie({
          userId: user.id,
          s3Key: selfieKey,
          s3Url: selfieUrl,
        });

        // Criar documento CNH
        await db.createDocument({
          userId: user.id,
          documentType: "cnh",
          s3Key: cnhKey,
          s3Url: cnhUrl,
        });

        // Notificar proprietário
        await notifyOwner({
          title: "Novo Motorista Cadastrado",
          content: `${input.name} (CPF: ${input.cpf}) se cadastrou como motorista.`,
        });

        return {
          success: true,
          message: "Motorista cadastrado com sucesso",
        };
      }),

    // Locador
    createLocador: publicProcedure
      .input(createLocadorSchema)
      .mutation(async ({ input, ctx }) => {
        const cpfExists = await db.checkCpfExists(input.cpf);
        if (cpfExists) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "CPF já cadastrado no sistema",
          });
        }

        const user = await db.getUserByOpenId(ctx.user?.openId || "");
        if (!user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Usuário não autenticado",
          });
        }

        const selfieBuffer = Buffer.from(input.selfieBase64, "base64");
        const selfieKey = `selfies/locador/${user.id}-selfie-${Date.now()}.jpg`;
        const { url: selfieUrl } = await storagePut(selfieKey, selfieBuffer, "image/jpeg");

        const crlvBuffer = Buffer.from(input.crlvBase64, "base64");
        const crlvKey = `documentos/locador/${user.id}-crlv-${Date.now()}.pdf`;
        const { url: crlvUrl } = await storagePut(crlvKey, crlvBuffer, "application/pdf");

        await db.createProfile({
          userId: user.id,
          profileType: "locador",
          cpf: input.cpf,
          phone: input.phone,
          address: input.address,
          city: input.city,
          state: input.state,
          zipCode: input.zipCode,
        });

        await db.createSelfie({
          userId: user.id,
          s3Key: selfieKey,
          s3Url: selfieUrl,
        });

        await db.createDocument({
          userId: user.id,
          documentType: "crlv",
          s3Key: crlvKey,
          s3Url: crlvUrl,
        });

        await notifyOwner({
          title: "Novo Locador Cadastrado",
          content: `${input.name} (CPF: ${input.cpf}) se cadastrou como locador.`,
        });

        return {
          success: true,
          message: "Locador cadastrado com sucesso",
        };
      }),

    // Investidor
    createInvestidor: publicProcedure
      .input(createInvestidorSchema)
      .mutation(async ({ input, ctx }) => {
        const cpfExists = await db.checkCpfExists(input.cpf);
        if (cpfExists) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "CPF já cadastrado no sistema",
          });
        }

        const user = await db.getUserByOpenId(ctx.user?.openId || "");
        if (!user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Usuário não autenticado",
          });
        }

        const selfieBuffer = Buffer.from(input.selfieBase64, "base64");
        const selfieKey = `selfies/investidor/${user.id}-selfie-${Date.now()}.jpg`;
        const { url: selfieUrl } = await storagePut(selfieKey, selfieBuffer, "image/jpeg");

        await db.createProfile({
          userId: user.id,
          profileType: "investidor",
          cpf: input.cpf,
          phone: input.phone,
          address: input.address,
          city: input.city,
          state: input.state,
          zipCode: input.zipCode,
        });

        await db.createSelfie({
          userId: user.id,
          s3Key: selfieKey,
          s3Url: selfieUrl,
        });

        await db.createInvestment({
          investorId: user.id,
          amount: input.initialInvestment.toString(),
          monthlyRate: "2.00",
          withdrawalType: "mensal",
        });

        await notifyOwner({
          title: "Novo Investidor Cadastrado",
          content: `${input.name} (CPF: ${input.cpf}) se cadastrou como investidor com investimento inicial de R$ ${input.initialInvestment.toFixed(2)}.`,
        });

        return {
          success: true,
          message: "Investidor cadastrado com sucesso",
        };
      }),

    // Funcionário
    createFuncionario: publicProcedure
      .input(createFuncionarioSchema)
      .mutation(async ({ input, ctx }) => {
        const cpfExists = await db.checkCpfExists(input.cpf);
        if (cpfExists) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "CPF já cadastrado no sistema",
          });
        }

        const user = await db.getUserByOpenId(ctx.user?.openId || "");
        if (!user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Usuário não autenticado",
          });
        }

        const selfieBuffer = Buffer.from(input.selfieBase64, "base64");
        const selfieKey = `selfies/funcionario/${user.id}-selfie-${Date.now()}.jpg`;
        const { url: selfieUrl } = await storagePut(selfieKey, selfieBuffer, "image/jpeg");

        await db.createProfile({
          userId: user.id,
          profileType: "funcionario",
          cpf: input.cpf,
          phone: input.phone,
          address: input.address,
          city: input.city,
          state: input.state,
          zipCode: input.zipCode,
        });

        await db.createSelfie({
          userId: user.id,
          s3Key: selfieKey,
          s3Url: selfieUrl,
        });

        await notifyOwner({
          title: "Novo Funcionário Cadastrado",
          content: `${input.name} (CPF: ${input.cpf}) se cadastrou como funcionário no cargo de ${input.cargo}.`,
        });

        return {
          success: true,
          message: "Funcionário cadastrado com sucesso",
        };
      }),

    // Adicionar veículo (para locadores)
    addVehicle: protectedProcedure
      .input(createVehicleSchema)
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Usuário não autenticado",
          });
        }

        const profile = await db.getProfileByUserId(ctx.user.id);
        if (!profile || profile.profileType !== "locador") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Apenas locadores podem adicionar veículos",
          });
        }

        const platExists = await db.checkLicensePlateExists(input.licensePlate);
        if (platExists) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Placa de veículo já cadastrada no sistema",
          });
        }

        await db.createVehicle({
          ownerId: ctx.user.id,
          brand: input.brand,
          model: input.model,
          year: input.year,
          licensePlate: input.licensePlate,
          color: input.color,
          fuelType: input.fuelType,
          mileage: input.mileage,
          dailyRate: input.dailyRate.toString(),
        });

        return {
          success: true,
          message: "Veículo cadastrado com sucesso",
        };
      }),
  }),

  // ============ DASHBOARD ROUTER ============

  dashboard: router({
    getMetrics: protectedProcedure.query(async () => {
      return await db.getDashboardMetrics();
    }),
  }),
});

export type AppRouter = typeof appRouter;
