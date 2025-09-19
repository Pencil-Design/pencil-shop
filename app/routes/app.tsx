// app/routes/app.tsx
import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError, useSearchParams } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  console.log("🔍 [app] Loader called with URL:", request.url);
  console.log("🔍 [app] Request headers:", Object.fromEntries(request.headers.entries()));
  console.log("🔍 [app] Cookies:", request.headers.get("cookie"));
  
  console.log("📝 [app] STEP 4: Validating existing session");
  console.log("📝 [app] This checks if user has a valid session from previous OAuth");
  console.log("📝 [app] If no session found, user will be redirected back to login");
  
  try {
    console.log("🔍 [app] Calling authenticate.admin to validate session...");
    const session = await authenticate.admin(request);
    console.log("✅ [app] STEP 4 COMPLETED: Session validation successful");
    console.log("✅ [app] User is authenticated and can access the app");
    console.log("✅ [app] Session data:", {
      id: session?.id,
      shop: session?.shop,
      isOnline: session?.isOnline,
      scope: session?.scope,
      expires: session?.expires,
    });
    return { apiKey: process.env.SHOPIFY_API_KEY || "" };
  } catch (error) {
    console.error("❌ [app] STEP 4 FAILED: Session validation failed");
    console.error("❌ [app] This means:");
    console.error("  - No session found in database");
    console.error("  - Session expired");
    console.error("  - Invalid session data");
    console.error("❌ [app] User will be redirected to login page");
    console.error("❌ [app] Error details:", {
      url: request.url,
      message: (error as Error).message,
      stack: (error as Error).stack,
    });
    throw error;
  }
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();
  const [search] = useSearchParams();
  const qs = search.toString();
  const withQS = (path: string) => (qs ? `${path}?${qs}` : path);

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <NavMenu>
        <Link to={withQS("/app")} rel="home">Home</Link>
        <Link to={withQS("/app/additional")}>Additional page</Link>
      </NavMenu>
      <Outlet />
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (args) => boundary.headers(args);
