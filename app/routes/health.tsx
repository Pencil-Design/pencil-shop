import { json, type LoaderFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";

export const loader = async (_args: LoaderFunctionArgs) => {
    const startedAt = Date.now();
    const env = {
        nodeEnv: process.env.NODE_ENV,
        shopifyAppUrlSet: Boolean(process.env.SHOPIFY_APP_URL),
        shopifyAppUrl: process.env.SHOPIFY_APP_URL,
        apiKeySet: Boolean(process.env.SHOPIFY_API_KEY),
        apiSecretSet: Boolean(process.env.SHOPIFY_API_SECRET),
        databaseUrlSet: Boolean(process.env.DATABASE_URL),
        shopCustomDomainSet: Boolean(process.env.SHOP_CUSTOM_DOMAIN),
    };

    let dbConnected = false;
    let sessionTableExists: boolean | null = null;
    let sessionCount: number | null = null;
    let dbError: string | undefined;

    try {
        await prisma.$queryRaw`SELECT 1`;
        dbConnected = true;
        try {
            // Check Session table exists and count rows (may fail if not migrated)
            const result = await prisma.$queryRawUnsafe<any[]>(
                "SELECT to_regclass('public." + "Session" + "') AS exists"
            );
            sessionTableExists = Boolean(result?.[0]?.exists);
            if (sessionTableExists) {
                const countResult = await prisma.$queryRawUnsafe<any[]>(
                    'SELECT COUNT(*)::int AS count FROM "public"."Session"'
                );
                sessionCount = countResult?.[0]?.count ?? null;
            }
        } catch (inner) {
            dbError = (inner as Error).message;
        }
    } catch (error) {
        dbError = (error as Error).message;
    }

    const payload = {
        ok: dbConnected,
        env,
        db: {
            connected: dbConnected,
            sessionTableExists,
            sessionCount,
            error: dbError,
        },
        elapsedMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
    };

    if (!dbConnected) {
        console.error("/health check failed", payload);
        return json(payload, { status: 500 });
    }

    return json(payload);
};


