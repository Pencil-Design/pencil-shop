import { PRICING_PLANS } from "../services/billing.server";

export interface TransactionFeeCalculation {
    orderAmount: number;
    planId: string;
    feeRate: number;
    calculatedFee: number;
    cappedFee: number;
    finalFee: number;
    isCapped: boolean;
}

/**
 * Calculate transaction fee for a given order amount and plan
 */
export function calculateTransactionFee(orderAmount: number, planId: string): TransactionFeeCalculation {
    const plan = PRICING_PLANS[planId];
    if (!plan) {
        throw new Error(`Invalid plan ID: ${planId}`);
    }

    const calculatedFee = orderAmount * plan.transactionFeeRate;
    const cappedFee = plan.transactionFeeCap;
    const finalFee = Math.min(calculatedFee, cappedFee);
    const isCapped = calculatedFee > cappedFee;

    return {
        orderAmount,
        planId,
        feeRate: plan.transactionFeeRate,
        calculatedFee,
        cappedFee,
        finalFee,
        isCapped
    };
}

/**
 * Format currency amount for display
 */
export function formatCurrency(amount: number, currencyCode: string = "USD"): string {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currencyCode,
    }).format(amount);
}

/**
 * Format percentage for display
 */
export function formatPercentage(rate: number): string {
    return `${(rate * 100).toFixed(1)}%`;
}

/**
 * Get plan display information
 */
export function getPlanDisplayInfo(planId: string) {
    const plan = PRICING_PLANS[planId];
    if (!plan) {
        throw new Error(`Invalid plan ID: ${planId}`);
    }

    return {
        name: plan.name,
        monthlyPrice: formatCurrency(plan.monthlyPrice),
        transactionFeeRate: formatPercentage(plan.transactionFeeRate),
        transactionFeeCap: formatCurrency(plan.transactionFeeCap),
        aiCredits: plan.aiCredits.toLocaleString(),
    };
}

/**
 * Validate if a plan ID exists
 */
export function isValidPlanId(planId: string): boolean {
    return planId in PRICING_PLANS;
}

/**
 * Get all available plan IDs
 */
export function getAvailablePlanIds(): string[] {
    return Object.keys(PRICING_PLANS);
}

/**
 * Calculate monthly savings between plans
 */
export function calculatePlanSavings(fromPlanId: string, toPlanId: string, monthlySales: number): {
    monthlySavings: number;
    transactionFeeSavings: number;
    totalSavings: number;
} {
    const fromPlan = PRICING_PLANS[fromPlanId];
    const toPlan = PRICING_PLANS[toPlanId];

    if (!fromPlan || !toPlan) {
        throw new Error("Invalid plan IDs");
    }

    const fromFee = Math.min(monthlySales * fromPlan.transactionFeeRate, fromPlan.transactionFeeCap);
    const toFee = Math.min(monthlySales * toPlan.transactionFeeRate, toPlan.transactionFeeCap);

    const transactionFeeSavings = fromFee - toFee;
    const monthlySavings = fromPlan.monthlyPrice - toPlan.monthlyPrice;
    const totalSavings = monthlySavings + transactionFeeSavings;

    return {
        monthlySavings,
        transactionFeeSavings,
        totalSavings
    };
}
