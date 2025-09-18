import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const searchParams = Object.fromEntries(url.searchParams.entries());
  
  console.log("🔄 STEP 3: OAuth callback received");
  console.log("  - Code:", searchParams.code ? "✅" : "❌");
  console.log("  - State:", searchParams.state ? "✅" : "❌");
  console.log("  - HMAC:", searchParams.hmac ? "✅" : "❌");
  
  try {
    console.log("🔄 STEP 3: Validating OAuth and creating session...");
    const result = await authenticate.admin(request);
    console.log("✅ STEP 3: OAuth successful → session created");
    return result;
  } catch (error) {
    console.error("❌ STEP 3: OAuth failed:", (error as Error).message);
    throw error;
  }
};
