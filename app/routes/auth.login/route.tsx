import type { LoaderFunctionArgs } from "@remix-run/node";
import { login } from "../../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    throw new Response("Missing shop parameter", { status: 400 });
  }

  // 🟢 STEP 1: If we're in the top-level bounce, output a script to break out of the iframe
  if (url.searchParams.get("top-level") === "true") {
    return new Response(
      `<script>
         window.top.location.href = "/auth/login?shop=${shop}";
       </script>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  // 🟢 STEP 2: Otherwise, start OAuth
  console.log("🔄 STEP 2: Starting OAuth for shop:", shop);
  return login(request);
};