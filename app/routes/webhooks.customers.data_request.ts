import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

/**
 * Mandatory compliance webhook for GDPR customer data requests
 * 
 * When a customer requests their data from a store owner, Shopify sends this webhook
 * to notify the app that it needs to provide any customer data it has stored.
 * 
 * Requirements:
 * - Respond with 200 status to confirm receipt
 * - Provide the requested customer data to the store owner within 30 days
 * 
 * Payload includes:
 * - shop_id, shop_domain
 * - customer: { id, email, phone }
 * - orders_requested: array of order IDs
 * - data_request: { id }
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
 * Our app only stores shop-level data.
 * 
 * Therefore, there is no customer data to provide when this webhook is received.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
    const { shop, topic, payload } = await authenticate.webhook(request);

    console.log(`Received ${topic} webhook for ${shop}`);

    const { customer, data_request } = payload;
    console.log(`Customer data request for: ${customer?.email} (Request ID: ${data_request?.id})`);

    // This app does not store customer personal data.
    // Customers are anonymous - they customize products without accounts or tracking.
    // All stored data belongs to shops, not individual customers.
    console.log("No customer data to provide - customers are anonymous in this app");

    return new Response(null, { status: 200 });
};

