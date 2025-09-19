import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  console.log("🔍 [_index] Loader called with URL:", request.url);
  console.log("🔍 [_index] Search params:", Object.fromEntries(url.searchParams.entries()));

  // Check if this is a Shopify embedded app request
  if (url.searchParams.get("shop") && url.searchParams.get("embedded")) {
    console.log("🔍 [_index] Shopify embedded app request detected");
    console.log("📝 [_index] User is accessing from Shopify Admin, redirecting to OAuth");
    console.log("📝 [_index] This will start the OAuth flow to create a session");
    throw redirect(`/auth/login?${url.searchParams.toString()}`);
  }

  if (url.searchParams.get("shop")) {
    console.log("🔍 [_index] Shop param found, redirecting to /app");
    console.log("📝 [_index] This means user is coming back from OAuth flow");
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  console.log("🔍 [_index] No shop param, showing login form");
  console.log("📝 [_index] User needs to enter their shop domain to start OAuth");
  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>A short heading about [your app]</h1>
        <p className={styles.text}>
          A tagline about [your app] that describes your value proposition.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>Product feature</strong>. Some detail about your feature and
            its benefit to your customer.
          </li>
          <li>
            <strong>Product feature</strong>. Some detail about your feature and
            its benefit to your customer.
          </li>
          <li>
            <strong>Product feature</strong>. Some detail about your feature and
            its benefit to your customer.
          </li>
        </ul>
      </div>
    </div>
  );
}
