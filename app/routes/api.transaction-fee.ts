import { json, type ActionFunctionArgs } from "@remix-run/node";
import { createBillingService } from "../services/billing.server";

export async function action({ request }: ActionFunctionArgs) {
    if (request.method !== "POST") {
        return json({ error: "Method not allowed" }, { status: 405 });
    }

    try {
        const body = await request.json();
        const {
            subscriptionLineItemId,
            orderAmount,
            orderId,
            planId
        } = body;

        if (!subscriptionLineItemId || !orderAmount || !orderId || !planId) {
            return json({
                error: "Missing required fields: subscriptionLineItemId, orderAmount, orderId, planId"
            }, { status: 400 });
        }

        const billingService = await createBillingService(request);

        // Calculate transaction fee
        const transactionFee = billingService.calculateTransactionFee(orderAmount, planId);

        if (transactionFee <= 0) {
            return json({
                success: true,
                message: "No transaction fee applicable",
                transactionFee: 0
            });
        }

        // Create usage record for transaction fee
        const result = await billingService.createUsageRecord({
            subscriptionLineItemId,
            description: `Transaction fee for order #${orderId} - $${orderAmount.toFixed(2)}`,
            amount: transactionFee,
            currencyCode: "USD"
        });

        return json({
            success: true,
            transactionFee,
            usageRecord: result.appUsageRecord
        });

    } catch (error) {
        console.error("Error creating transaction fee usage record:", error);
        return json({
            error: error instanceof Error ? error.message : "Failed to create usage record"
        }, { status: 500 });
    }
}
