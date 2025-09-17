import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
    await authenticate.public.appProxy(request);
    return json({ ok: true });
}

export async function action({ request }: ActionFunctionArgs) {
    await authenticate.public.appProxy(request);
    return json({ ok: true });
}


