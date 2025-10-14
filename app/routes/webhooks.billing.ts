import { type ActionFunctionArgs } from "@remix-run/node";
import { createPencilAPIService } from "~/services/pencil-api.server";

export async function action({ request }: ActionFunctionArgs) {
    if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
    }

    try {
        const body = await request.json();
        const { topic, data } = body;

        console.log(`Received webhook: ${topic}`, data);

        switch (topic) {
            case "APP_SUBSCRIPTIONS_UPDATE":
                await handleSubscriptionUpdate(data);
                break;

            case "APP_SUBSCRIPTIONS_APPROACHING_CAPPED_AMOUNT":
                await handleApproachingCappedAmount(data);
                break;

            case "APP_SUBSCRIPTIONS_CAPPED_AMOUNT_UPDATED":
                await handleCappedAmountUpdated(data);
                break;

            default:
                console.log(`Unhandled webhook topic: ${topic}`);
        }

        return new Response("OK", { status: 200 });
    } catch (error) {
        console.error("Error processing webhook:", error);
        return new Response("Internal Server Error", { status: 500 });
    }
}

async function handleSubscriptionUpdate(data: any) {
    try {
        const pencilAPI = createPencilAPIService();

        // Handle subscription status changes
        const { subscription, shop } = data;

        if (subscription && shop) {
            // Extract merchant email from shop data
            const merchantEmail = shop.email || shop.contactEmail || `owner@${shop.myshopify_domain}`;

            if (!merchantEmail) {
                console.error('No merchant email found in webhook data');
                return;
            }

            // Determine plan ID from subscription name
            const planId = extractPlanIdFromSubscription(subscription);

            if (subscription.status === 'ACTIVE' && planId) {
                await pencilAPI.handleSubscriptionActivation({
                    email: merchantEmail,
                    firstName: undefined,
                    lastName: undefined,
                    planId,
                    subscriptionId: subscription.id,
                    price: parseFloat(subscription.recurring_application_charge?.price || '0'),
                    periodStart: new Date(subscription.created_at),
                    periodEnd: subscription.billing_on ? new Date(subscription.billing_on) : undefined,
                });
            } else if (['CANCELLED', 'FROZEN', 'DECLINED'].includes(subscription.status)) {
                await pencilAPI.handleSubscriptionCancellation({
                    email: merchantEmail,
                    firstName: undefined,
                    lastName: undefined,
                });
            }
        }
    } catch (error) {
        console.error('Error handling subscription update in Pencil API:', error);
        // Don't fail the webhook - log and continue
    }
}

/**
 * Extract plan ID from subscription object
 */
function extractPlanIdFromSubscription(subscription: any): string | null {
    // Try to get plan ID from subscription name
    const name = subscription.name?.toLowerCase() || '';

    if (name.includes('pencil shop plus') || name.includes('plus')) {
        return 'pencilShopPlus';
    } else if (name.includes('pencil shop')) {
        return 'pencilShop';
    }

    // If we can't determine from name, return null
    console.warn('Could not determine plan ID from subscription:', subscription.name);
    return null;
}

async function handleApproachingCappedAmount(data: any) {
    console.log("Subscription approaching capped amount:", data);

    // Handle when merchant is approaching their usage cap
    const { subscription } = data;
    if (subscription) {
        console.log(`Subscription ${subscription.id} is approaching capped amount`);

        // You can add logic here to:
        // - Send email notifications to merchants
        // - Show in-app warnings
        // - Suggest upgrading their plan
    }
}

async function handleCappedAmountUpdated(data: any) {
    console.log("Capped amount updated:", data);

    // Handle when merchant updates their usage cap
    const { subscription } = data;
    if (subscription) {
        console.log(`Subscription ${subscription.id} capped amount updated`);

        // You can add logic here to:
        // - Update your database with new cap
        // - Send confirmation emails
        // - Update billing calculations
    }
}
