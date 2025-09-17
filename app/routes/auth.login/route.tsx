import { login } from "../../shopify.server";

export const loader = ({ request }: { request: Request }) => {
  console.log("🔍 [auth.login] Loader called with URL:", request.url);
  console.log("🔍 [auth.login] Request method:", request.method);
  console.log("🔍 [auth.login] Request headers:", Object.fromEntries(request.headers.entries()));
  
  console.log("📝 [auth.login] STEP 1: User submitted shop domain");
  console.log("📝 [auth.login] This will redirect to Shopify OAuth URL");
  console.log("📝 [auth.login] OAuth URL format: https://{shop}.myshopify.com/admin/oauth/authorize?client_id={api_key}&scope={scopes}&redirect_uri={callback_url}&state={random_state}");
  
  return login(request);
};
