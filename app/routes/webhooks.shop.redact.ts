import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { createPencilAPIService } from "../services/pencil-api.server";

/**
 * Mandatory compliance webhook for shop data deletion
 * 
 * 48 hours after a store owner uninstalls the app, Shopify sends this webhook
 * to notify the app to delete all data associated with that shop.
 * 
 * Requirements:
 * - Respond with 200 status to confirm receipt
 * - Delete all shop data within 30 days
 * - If legally required to retain data, you may keep it but should document why
 * 
 * Payload includes:
 * - shop_id
 * - shop_domain
 */
export const action = async ({ request }: ActionFunctionArgs) => {
    const { shop, topic, payload } = await authenticate.webhook(request);

    console.log(`Received ${topic} webhook for ${shop}`);
    console.log("Shop redact payload:", JSON.stringify(payload, null, 2));

    const { shop_id, shop_domain } = payload;

    try {
        // Delete all data associated with this shop
        console.log(`Deleting all data for shop: ${shop_domain} (ID: ${shop_id})`);

        // Get the shop owner's email before deleting sessions
        const session = await db.session.findFirst({
            where: { shop: shop_domain },
            orderBy: { id: 'desc' }
        });

        const shopOwnerEmail = session?.email;

        // Delete sessions for this shop
        const deletedSessions = await db.session.deleteMany({
            where: { shop: shop_domain }
        });
        console.log(`Deleted ${deletedSessions.count} session(s) for ${shop_domain}`);

        // Delete models/products created for this shop
        const deletedModels = await db.model.deleteMany({
            where: { shop: shop_domain }
        });
        console.log(`Deleted ${deletedModels.count} model(s) for ${shop_domain}`);

        // Delete user data from external Pencil API
        if (shopOwnerEmail) {
            try {
                const pencilAPI = createPencilAPIService();
                await pencilAPI.deleteUser(shopOwnerEmail);
                console.log(`Deleted user ${shopOwnerEmail} from Pencil API`);
            } catch (error) {
                console.error(`Error deleting user from Pencil API: ${error}`);
                // Continue execution - we've done our best to delete the data
                // The error is logged for follow-up
            }
        } else {
            console.log("No shop owner email found, skipping Pencil API deletion");
        }

        console.log(`Successfully completed shop data redaction for ${shop_domain}`);
    } catch (error) {
        console.error("Error processing shop redaction:", error);
        // Still return 200 to acknowledge receipt, but log the error for follow-up
    }

    return new Response(null, { status: 200 });
};

