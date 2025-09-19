import { login } from "../../shopify.server";

export const loader = ({ request }: { request: Request }) => login(request);
