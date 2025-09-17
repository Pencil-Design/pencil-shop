import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { execSync } from "child_process";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    try {
        console.log("Running migrations manually...");
        const output = execSync("npx prisma migrate deploy", {
            encoding: "utf8",
            cwd: process.cwd()
        });
        console.log("Migration output:", output);

        // Also run generate to be safe
        const generateOutput = execSync("npx prisma generate", {
            encoding: "utf8",
            cwd: process.cwd()
        });
        console.log("Generate output:", generateOutput);

        return json({
            success: true,
            migrateOutput: output,
            generateOutput: generateOutput
        });
    } catch (error) {
        console.error("Migration failed:", error);
        return json({
            success: false,
            error: (error as Error).message
        }, { status: 500 });
    }
};
