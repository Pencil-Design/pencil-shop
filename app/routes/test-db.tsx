import { json, type LoaderFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    try {
        // Test basic connectivity
        await prisma.$queryRaw`SELECT 1`;

        // Check if Session table exists and is accessible
        const sessionCount = await prisma.session.count();

        // Try to create a test session
        const testSession = await prisma.session.create({
            data: {
                id: `test-${Date.now()}`,
                shop: "test-shop.myshopify.com",
                state: "test-state",
                accessToken: "test-token",
                isOnline: false,
            }
        });

        // Clean up test session
        await prisma.session.delete({
            where: { id: testSession.id }
        });

        return json({
            success: true,
            sessionCount,
            message: "Database and Session table working correctly"
        });

    } catch (error) {
        console.error("Database test failed:", error);
        return json({
            success: false,
            error: (error as Error).message,
            stack: (error as Error).stack
        }, { status: 500 });
    }
};
