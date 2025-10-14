import { json, type ActionFunctionArgs } from "@remix-run/node";
import { createBillingService } from "../services/billing.server";
import { calculateTransactionFee, formatCurrency } from "../utils/billing";

/**
 * Example API endpoint for processing orders and creating transaction fee usage records
 * This would typically be called when an order is completed in your app
 */
export async function action({ request }: ActionFunctionArgs) {
    if (request.method !== "POST") {
        return json({ error: "Method not allowed" }, { status: 405 });
    }

    try {
        const body = await request.json();
        const {
            orderId,
            orderAmount,
            customerEmail,
            planId,
            subscriptionLineItemId
        } = body;

        // Validate required fields
        if (!orderId || !orderAmount || !planId || !subscriptionLineItemId) {
            return json({
                error: "Missing required fields: orderId, orderAmount, planId, subscriptionLineItemId"
            }, { status: 400 });
        }

        // Calculate transaction fee
        const feeCalculation = calculateTransactionFee(orderAmount, planId);

        console.log(`Processing order ${orderId}:`, {
            orderAmount: formatCurrency(orderAmount),
            planId,
            transactionFee: formatCurrency(feeCalculation.finalFee),
            isCapped: feeCalculation.isCapped
        });

        // Only create usage record if there's a fee to charge
        if (feeCalculation.finalFee > 0) {
            const billingService = await createBillingService(request);

            const result = await billingService.createUsageRecord({
                subscriptionLineItemId,
                description: `Transaction fee for order #${orderId} - ${formatCurrency(orderAmount)}`,
                amount: feeCalculation.finalFee,
                currencyCode: "USD"
            });

            console.log(`Created usage record for order ${orderId}:`, result.appUsageRecord);

            return json({
                success: true,
                orderId,
                orderAmount,
                transactionFee: feeCalculation.finalFee,
                transactionFeeFormatted: formatCurrency(feeCalculation.finalFee),
                isCapped: feeCalculation.isCapped,
                usageRecordId: result.appUsageRecord.id
            });
        } else {
            return json({
                success: true,
                orderId,
                orderAmount,
                transactionFee: 0,
                transactionFeeFormatted: formatCurrency(0),
                isCapped: false,
                message: "No transaction fee applicable"
            });
        }

    } catch (error) {
        console.error("Error processing order transaction fee:", error);
        return json({
            error: error instanceof Error ? error.message : "Failed to process transaction fee"
        }, { status: 500 });
    }
}

/**
 * Example of how to use this API endpoint:
 * 
 * POST /api/process-order-fee
 * Content-Type: application/json
 * 
 * {
 *   "orderId": "12345",
 *   "orderAmount": 150.00,
 *   "customerEmail": "customer@example.com",
 *   "planId": "pencilShop",
 *   "subscriptionLineItemId": "gid://shopify/AppSubscriptionLineItem/123456?v=1&index=1"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "orderId": "12345",
 *   "orderAmount": 150.00,
 *   "transactionFee": 2.70,
 *   "transactionFeeFormatted": "$2.70",
 *   "isCapped": false,
 *   "usageRecordId": "gid://shopify/AppUsageRecord/789012"
 * }
 */
