import { login } from "../../shopify.server";

export const loader = ({ request }: { request: Request }) => {
  console.log(`[LOGIN] Route hit: ${request.url}`);
  const result = login(request);
  console.log(`[LOGIN] Initiating OAuth flow`);
  return result;
};
