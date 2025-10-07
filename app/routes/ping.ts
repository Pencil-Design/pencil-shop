// app/routes/ping.ts
import type { LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
    const url = new URL(request.url);
    console.log("[PING] query", Object.fromEntries(url.searchParams));
    return new Response("ok", { status: 200 });
}
