import { authenticate } from "../../shopify.server";

export const loader = ({ request }: { request: Request }) =>{
    console.log("🔄 [auth.callback] Handling Shopify OAuth callback...");
    return authenticate.admin(request);
}
