import { authenticate } from "../../shopify.server";

export const loader = ({ request }: { request: Request }) => {
  console.log(`[CALLBACK] Route hit: ${request.url}`);
  const result = authenticate.admin(request);
  console.log(`[CALLBACK] Processing OAuth callback`);
  return result;
};
