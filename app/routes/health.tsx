import { json, type LoaderFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";

export const loader = async (_args: LoaderFunctionArgs) => {
    try {
        // Simple DB connectivity check
        await prisma.$queryRaw`SELECT 1`;
        return json({ ok: true });
    } catch (error) {
        console.error('Health check failed', error);
        return json({ ok: false, error: (error as Error).message }, { status: 500 });
    }
};


