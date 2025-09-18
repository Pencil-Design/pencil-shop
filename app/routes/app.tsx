// app/routes/app.tsx
import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError, useSearchParams } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const searchParams = Object.fromEntries(url.searchParams.entries());
  
  try {
    console.log("🔄 STEP 4: Validating session...");
    await authenticate.admin(request);
    console.log("✅ STEP 4: Session valid → user authenticated");
    return { apiKey: process.env.SHOPIFY_API_KEY || "" };
  } catch (error) {
    // Only redirect to OAuth if this is a Shopify embedded app request
    if (searchParams.shop && searchParams.embedded) {
      console.log("🔄 STEP 1: No session found → redirecting to OAuth");
      
      // Use top-level=true to avoid iframe issues
      if (searchParams.embedded === "1") {
        console.log("🔄 Opening OAuth in new window to avoid iframe issues");
        throw redirect("/auth/login?top-level=true");
      }
      
      throw redirect(`/auth/login?${url.searchParams.toString()}`);
    }
    
    console.error("❌ STEP 4: No valid session → redirecting to login");
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
