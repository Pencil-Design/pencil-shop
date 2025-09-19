import type { LoaderFunctionArgs } from "@remix-run/node";
import { login } from "../../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    throw new Response("Missing shop parameter", { status: 400 });
  }

  // 🟢 STEP 1: No top-level yet → bounce out of iframe
  if (!url.searchParams.get("top-level")) {
    console.log("🔄 STEP 1: In iframe, bouncing to top-level for shop:", shop);
    return new Response(
      `<script>
         console.log("🔄 STEP 1 (client): Forcing top-level redirect for ${shop}");
         window.top.location.href = "/auth/login?shop=${shop}&top-level=true";
       </script>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  // 🟢 STEP 2: At top-level → start OAuth
  console.log("🔄 STEP 2: At top-level, starting OAuth for shop:", shop);
  return login(request);
};