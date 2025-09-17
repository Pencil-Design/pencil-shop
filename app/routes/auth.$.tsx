import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const searchParams = Object.fromEntries(url.searchParams.entries());
  
  console.log("🔍 [auth.$] Callback loader called with URL:", request.url);
  console.log("🔍 [auth.$] Search params:", searchParams);
  console.log("🔍 [auth.$] Request headers:", Object.fromEntries(request.headers.entries()));
  
  console.log("📝 [auth.$] STEP 2: Shopify OAuth Callback");
  console.log("📝 [auth.$] User was redirected back from Shopify with authorization code");
  console.log("📝 [auth.$] Expected params: code, state, shop, timestamp, hmac");
  console.log("📝 [auth.$] Received params:", Object.keys(searchParams));
  
  if (searchParams.code) {
    console.log("✅ [auth.$] Authorization code received:", searchParams.code.substring(0, 10) + "...");
  } else {
    console.log("❌ [auth.$] No authorization code found in callback");
  }
  
  if (searchParams.state) {
    console.log("✅ [auth.$] State parameter received:", searchParams.state);
  } else {
    console.log("❌ [auth.$] No state parameter found");
  }
  
  if (searchParams.hmac) {
    console.log("✅ [auth.$] HMAC signature received for validation");
  } else {
    console.log("❌ [auth.$] No HMAC signature found");
  }
  
  try {
    console.log("🔍 [auth.$] STEP 3: Validating OAuth callback and exchanging code for token");
    console.log("🔍 [auth.$] This will:");
    console.log("  - Validate HMAC signature from Shopify");
    console.log("  - Exchange authorization code for access token");
    console.log("  - Create/update session in database");
    console.log("  - Redirect to /app");
    
    const result = await authenticate.admin(request);
    console.log("✅ [auth.$] STEP 3 COMPLETED: OAuth validation successful");
    console.log("✅ [auth.$] Session created and user will be redirected to /app");
    return result;
  } catch (error) {
    console.error("❌ [auth.$] STEP 3 FAILED: OAuth validation failed");
    console.error("❌ [auth.$] This could be due to:");
    console.error("  - Invalid HMAC signature");
    console.error("  - Expired authorization code");
    console.error("  - Database connection issues");
    console.error("  - Invalid shop domain");
    console.error("❌ [auth.$] Error details:", {
      message: (error as Error).message,
      stack: (error as Error).stack,
    });
    throw error;
  }
};
