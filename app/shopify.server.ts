import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

// Log configuration on startup
console.log("🔍 [shopify.server] Configuration check:");
console.log("🔍 [shopify.server] SHOPIFY_API_KEY:", process.env.SHOPIFY_API_KEY ? "✅ Set" : "❌ Missing");
console.log("🔍 [shopify.server] SHOPIFY_API_SECRET:", process.env.SHOPIFY_API_SECRET ? "✅ Set" : "❌ Missing");
console.log("🔍 [shopify.server] SHOPIFY_APP_URL:", process.env.SHOPIFY_APP_URL || "❌ Missing");
console.log("🔍 [shopify.server] DATABASE_URL:", process.env.DATABASE_URL ? "✅ Set" : "❌ Missing");

console.log("\n📚 [shopify.server] SHOPIFY OAUTH EXPLANATION:");
console.log("📚 [shopify.server] ========================================");
console.log("📚 [shopify.server] OAuth is a secure way for apps to access user data");
console.log("📚 [shopify.server] without storing user passwords.");
console.log("📚 [shopify.server]");
console.log("📚 [shopify.server] SHOPIFY OAUTH FLOW:");
console.log("📚 [shopify.server] 1. User enters shop domain (e.g., my-shop.myshopify.com)");
console.log("📚 [shopify.server] 2. App redirects to: https://my-shop.myshopify.com/admin/oauth/authorize");
console.log("📚 [shopify.server]    with parameters: client_id, scope, redirect_uri, state");
console.log("📚 [shopify.server] 3. User sees Shopify's permission screen");
console.log("📚 [shopify.server] 4. If user approves, Shopify redirects back to your app");
console.log("📚 [shopify.server]    with parameters: code, state, shop, timestamp, hmac");
console.log("📚 [shopify.server] 5. App validates HMAC signature for security");
console.log("📚 [shopify.server] 6. App exchanges 'code' for 'access_token' via API call");
console.log("📚 [shopify.server] 7. App stores session with access_token in database");
console.log("📚 [shopify.server] 8. User is redirected to main app interface");
console.log("📚 [shopify.server] ========================================\n");

// Test database connection
prisma.$connect()
  .then(() => {
    console.log("✅ [shopify.server] Database connection successful");
  })
  .catch((error) => {
    console.error("❌ [shopify.server] Database connection failed:", error);
  });

// Add logging wrapper for session storage
const prismaSessionStorage = new PrismaSessionStorage(prisma);

// Wrap session storage methods with logging
const originalStoreSession = prismaSessionStorage.storeSession.bind(prismaSessionStorage);
const originalLoadSession = prismaSessionStorage.loadSession.bind(prismaSessionStorage);
const originalDeleteSession = prismaSessionStorage.deleteSession.bind(prismaSessionStorage);

prismaSessionStorage.storeSession = async (session) => {
  console.log("🔍 [prismaSessionStorage] Storing session:", {
    id: session.id,
    shop: session.shop,
    isOnline: session.isOnline,
    scope: session.scope,
    expires: session.expires,
  });
  try {
    const result = await originalStoreSession(session);
    console.log("✅ [prismaSessionStorage] Session stored successfully");
    return result;
  } catch (error) {
    console.error("❌ [prismaSessionStorage] Failed to store session:", error);
    throw error;
  }
};

prismaSessionStorage.loadSession = async (id) => {
  console.log("🔍 [prismaSessionStorage] Loading session with ID:", id);
  try {
    const session = await originalLoadSession(id);
    if (session) {
      console.log("✅ [prismaSessionStorage] Session loaded:", {
        id: session.id,
        shop: session.shop,
        isOnline: session.isOnline,
        scope: session.scope,
        expires: session.expires,
      });
    } else {
      console.log("⚠️ [prismaSessionStorage] No session found for ID:", id);
    }
    return session;
  } catch (error) {
    console.error("❌ [prismaSessionStorage] Failed to load session:", error);
    throw error;
  }
};

prismaSessionStorage.deleteSession = async (id) => {
  console.log("🔍 [prismaSessionStorage] Deleting session with ID:", id);
  try {
    const result = await originalDeleteSession(id);
    console.log("✅ [prismaSessionStorage] Session deleted successfully");
    return result;
  } catch (error) {
    console.error("❌ [prismaSessionStorage] Failed to delete session:", error);
    throw error;
  }
};

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October24,
  scopes: [
    "read_products",
    "write_products",
    "write_product_listings",
    "read_inventory",
    "write_inventory",
    "read_publications",
    "write_publications",
  ],
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: prismaSessionStorage,
  distribution: AppDistribution.AppStore,
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    removeRest: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.October24;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
