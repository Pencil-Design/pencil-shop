import { login } from "../../shopify.server";

export const loader = ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const searchParams = Object.fromEntries(url.searchParams.entries());
  
  if (searchParams.shop) {
    console.log("🔄 STEP 2: Starting OAuth for shop:", searchParams.shop);
  } else {
    console.log("🔄 STEP 2: Starting OAuth from form submission");
  }
  
  return login(request);
};
