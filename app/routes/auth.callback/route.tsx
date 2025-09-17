import { authenticate } from "../../shopify.server";

export const loader = ({ request }: { request: Request }) =>
    authenticate.admin(request);
