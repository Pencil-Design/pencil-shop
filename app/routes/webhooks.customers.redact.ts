import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

/**
 * Mandatory compliance webhook for GDPR customer data deletion
 * 
 * When a store owner requests that customer data be deleted (on behalf of a customer),
 * Shopify sends this webhook to notify the app to redact/delete that customer's data.
 * 
 * Requirements:
 * - Respond with 200 status to confirm receipt
 * - Delete/redact the customer data within 30 days
 * - If legally required to retain data, you may keep it but should not complete the action
 * 
 * Timing:
 * - Sent 10 days after deletion request if customer hasn't ordered in 6 months
 * - Otherwise sent after 6 months from last order
 * 
 * Payload includes:
 * - shop_id, shop_domain
 * - customer: { id, email, phone }
 * - orders_to_redact: array of order IDs
 * 
 * ---
 * 
 * IMPLEMENTATION NOTE:
 * This app does not store any customer personal data. Customers use the app anonymously
 * to customize products without creating accounts or being tracked. All data belongs to
 * the shop (product models, inventory) not to individual customers.
 * 
 * What we DON'T store:
 * - Customer accounts or profiles
 * - Customer emails or contact info
 * - "My Designs" or saved customizations
 * - Customer identifiers in product models
 * - Customer session data or cookies
 * 
 * Customer data is managed entirely by Shopify (orders, checkout, customer accounts).
 * Our app only stores shop-level data which is deleted via the shop/redact webhook.
 * 
 * Therefore, there is nothing to delete when this webhook is received.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
    const { shop, topic, payload } = await authenticate.webhook(request);

    console.log(`Received ${topic} webhook for ${shop}`);

    const { customer } = payload;
    console.log(`Customer redaction request for: ${customer?.email} (Customer ID: ${customer?.id})`);

    // This app does not store customer personal data.
    // Customers are anonymous - they customize products without accounts or tracking.
    // All stored data belongs to shops and is deleted via the shop/redact webhook.
    console.log("No customer data to delete - customers are anonymous in this app");

    return new Response(null, { status: 200 });
};

