/**
 * Simulador de Investimentos - Léxia Veículos
 * 
 * Cálculos:
 * - Taxa: 2% ao mês
 * - Tipos de resgate: Mensal (saque do rendimento) ou Composto (reinvestimento)
 * - Carência: 30 dias para primeiro resgate
 */

export interface InvestmentSimulation {
  initialAmount: number;
  monthlyRate: number;
  withdrawalType: "mensal" | "composto";
  months: number;
  projections: MonthProjection[];
  totalReturn: number;
  totalWithdrawn: number;
  finalBalance: number;
}

export interface MonthProjection {
  month: number;
  date: Date;
  balance: number;
  monthlyReturn: number;
  totalReturn: number;
  totalWithdrawn: number;
  availableForWithdrawal: number;
}

/**
 * Calcular projeção de investimento mensal
 */
export function calculateInvestmentProjection(
  initialAmount: number,
  monthlyRate: number = 2,
  withdrawalType: "mensal" | "composto" = "mensal",
  months: number = 12
): InvestmentSimulation {
  const rate = monthlyRate / 100;
  const projections: MonthProjection[] = [];

  let currentBalance = initialAmount;
  let totalWithdrawn = 0;
  let totalReturn = 0;

  for (let month = 1; month <= months; month++) {
    // Calcular retorno do mês
    const monthlyReturn = currentBalance * rate;
    totalReturn += monthlyReturn;

    // Determinar tipo de resgate
    let availableForWithdrawal = 0;
    let newBalance = currentBalance;

    if (withdrawalType === "mensal") {
      // Resgate mensal: saca o rendimento, mantém o principal
      availableForWithdrawal = monthlyReturn;
      newBalance = currentBalance; // Principal não muda
    } else if (withdrawalType === "composto") {
      // Resgate composto: reinveste o rendimento
      newBalance = currentBalance + monthlyReturn;
      availableForWithdrawal = 0; // Nada disponível até solicitar resgate
    }

    const projection: MonthProjection = {
      month,
      date: new Date(new Date().setMonth(new Date().getMonth() + month)),
      balance: newBalance,
      monthlyReturn,
      totalReturn,
      totalWithdrawn,
      availableForWithdrawal,
    };

    projections.push(projection);
    currentBalance = newBalance;
  }

  return {
    initialAmount,
    monthlyRate,
    withdrawalType,
    months,
    projections,
    totalReturn,
    totalWithdrawn,
    finalBalance: currentBalance,
  };
}

/**
 * Calcular valor disponível para resgate
 */
export function calculateWithdrawalAmount(
  investment: {
    amount: number;
    monthlyRate: number;
    investmentDate: Date;
    withdrawalType: "mensal" | "composto";
    lastWithdrawalDate?: Date;
    totalWithdrawn: number;
  },
  currentDate: Date = new Date()
): {
  availableAmount: number;
  nextWithdrawalDate: Date;
  canWithdraw: boolean;
  daysUntilNextWithdrawal: number;
} {
  // Calcular dias desde o investimento
  const investmentTime = currentDate.getTime() - investment.investmentDate.getTime();
  const daysSinceInvestment = Math.floor(investmentTime / (1000 * 60 * 60 * 24));

  // Verificar carência de 30 dias
  const canWithdraw = daysSinceInvestment >= 30;
  const nextWithdrawalDate = new Date(investment.investmentDate);
  nextWithdrawalDate.setDate(nextWithdrawalDate.getDate() + 30);

  const daysUntilNextWithdrawal = Math.max(0, 30 - daysSinceInvestment);

  if (!canWithdraw) {
    return {
      availableAmount: 0,
      nextWithdrawalDate,
      canWithdraw: false,
      daysUntilNextWithdrawal,
    };
  }

  // Calcular retorno acumulado
  const monthsSinceInvestment = daysSinceInvestment / 30;
  const rate = investment.monthlyRate / 100;

  let availableAmount = 0;

  if (investment.withdrawalType === "mensal") {
    // Resgate mensal: cada mês rende 2% sobre o principal
    const monthlyReturn = investment.amount * rate;
    const monthsToWithdraw = Math.floor(monthsSinceInvestment);
    const totalAccumulated = monthlyReturn * monthsToWithdraw;
    availableAmount = Math.max(0, totalAccumulated - investment.totalWithdrawn);
  } else if (investment.withdrawalType === "composto") {
    // Resgate composto: juros sobre juros
    const totalBalance = investment.amount * Math.pow(1 + rate, monthsSinceInvestment);
    availableAmount = Math.max(0, totalBalance - investment.amount - investment.totalWithdrawn);
  }

  return {
    availableAmount: Math.round(availableAmount * 100) / 100,
    nextWithdrawalDate,
    canWithdraw: true,
    daysUntilNextWithdrawal: 0,
  };
}

/**
 * Simular resgate de investimento
 */
export function simulateWithdrawal(
  investment: {
    amount: number;
    monthlyRate: number;
    investmentDate: Date;
    withdrawalType: "mensal" | "composto";
    totalWithdrawn: number;
  },
  withdrawalAmount: number,
  currentDate: Date = new Date()
): {
  success: boolean;
  message: string;
  newBalance?: number;
  newTotalWithdrawn?: number;
  remainingBalance?: number;
} {
  const withdrawal = calculateWithdrawalAmount(investment, currentDate);

  if (!withdrawal.canWithdraw) {
    return {
      success: false,
      message: `Carência de 30 dias não atingida. Próximo resgate disponível em ${withdrawal.daysUntilNextWithdrawal} dias.`,
    };
  }

  if (withdrawalAmount > withdrawal.availableAmount) {
    return {
      success: false,
      message: `Valor solicitado (R$ ${withdrawalAmount.toFixed(2)}) excede o disponível (R$ ${withdrawal.availableAmount.toFixed(2)}).`,
    };
  }

  const newTotalWithdrawn = investment.totalWithdrawn + withdrawalAmount;

  // Calcular novo saldo
  let newBalance = investment.amount;

  if (investment.withdrawalType === "composto") {
    const monthsSinceInvestment = (currentDate.getTime() - investment.investmentDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
    const rate = investment.monthlyRate / 100;
    newBalance = investment.amount * Math.pow(1 + rate, monthsSinceInvestment) - newTotalWithdrawn;
  }

  return {
    success: true,
    message: "Resgate realizado com sucesso",
    newBalance: Math.round(newBalance * 100) / 100,
    newTotalWithdrawn,
    remainingBalance: Math.round(newBalance * 100) / 100,
  };
}

/**
 * Comparar cenários de investimento
 */
export function compareInvestmentScenarios(
  initialAmount: number,
  months: number = 12
): {
  mensal: InvestmentSimulation;
  composto: InvestmentSimulation;
  comparison: {
    monthlyBetter: number;
    compostoReturn: number;
    difference: number;
    percentageDifference: number;
  };
} {
  const mensal = calculateInvestmentProjection(initialAmount, 2, "mensal", months);
  const composto = calculateInvestmentProjection(initialAmount, 2, "composto", months);

  const mensalFinalBalance = mensal.finalBalance;
  const compostoFinalBalance = composto.finalBalance;
  const difference = compostoFinalBalance - mensalFinalBalance;
  const percentageDifference = (difference / mensalFinalBalance) * 100;

  return {
    mensal,
    composto,
    comparison: {
      monthlyBetter: mensalFinalBalance,
      compostoReturn: compostoFinalBalance,
      difference,
      percentageDifference,
    },
  };
}

/**
 * Calcular tempo para atingir meta de investimento
 */
export function calculateTimeToGoal(
  initialAmount: number,
  goalAmount: number,
  withdrawalType: "mensal" | "composto" = "composto"
): {
  months: number;
  years: number;
  finalAmount: number;
  totalReturn: number;
} {
  const rate = 0.02; // 2% ao mês
  let months = 0;
  let currentAmount = initialAmount;

  while (currentAmount < goalAmount && months < 360) {
    // Limite de 30 anos
    currentAmount *= 1 + rate;
    months++;
  }

  const years = months / 12;
  const totalReturn = currentAmount - initialAmount;

  return {
    months,
    years: Math.round(years * 100) / 100,
    finalAmount: Math.round(currentAmount * 100) / 100,
    totalReturn: Math.round(totalReturn * 100) / 100,
  };
}
