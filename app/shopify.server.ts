import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

// Test database connection
prisma.$connect()
  .then(() => {
    console.log("✅ Database connected");
  })
  .catch((error) => {
    console.error("❌ Database connection failed:", error);
  });

// Session storage with minimal logging
const prismaSessionStorage = new PrismaSessionStorage(prisma);

// Wrap session storage methods with minimal logging
const originalStoreSession = prismaSessionStorage.storeSession.bind(prismaSessionStorage);
const originalLoadSession = prismaSessionStorage.loadSession.bind(prismaSessionStorage);
const originalDeleteSession = prismaSessionStorage.deleteSession.bind(prismaSessionStorage);

prismaSessionStorage.storeSession = async (session) => {
  console.log("💾 Storing session for shop:", session.shop);
  try {
    const result = await originalStoreSession(session);
    console.log("✅ Session stored");
    return result;
  } catch (error) {
    console.error("❌ Failed to store session:", error);
    throw error;
  }
};

prismaSessionStorage.loadSession = async (id) => {
  try {
    const session = await originalLoadSession(id);
    if (session) {
      console.log("✅ Session found for shop:", session.shop);
    } else {
      console.log("⚠️ No session found for ID:", id);
    }
    return session;
  } catch (error) {
    console.error("❌ Failed to load session:", error);
    throw error;
  }
};

prismaSessionStorage.deleteSession = async (id) => {
  try {
    const result = await originalDeleteSession(id);
    console.log("🗑️ Session deleted");
    return result;
  } catch (error) {
    console.error("❌ Failed to delete session:", error);
    throw error;
  }
};

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY!,
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
  // 🔑 Add secure cookie options for embedded apps
  cookieOptions: {
    sameSite: "none", // required so cookies can be sent inside the iframe
    secure: true,     // required on HTTPS (App Runner already uses HTTPS)
  },
});

export default shopify;
export const apiVersion = ApiVersion.October24;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
