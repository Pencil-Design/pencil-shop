import { useEffect } from "react";
import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  List,
  Link,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { redirect } = await authenticate.admin(request);
  if (redirect) return redirect;
  return json({ ok: true });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const color = ["Red", "Orange", "Yellow", "Green"][
    Math.floor(Math.random() * 4)
  ];
  const response = await admin.graphql(
    `#graphql
      mutation populateProduct($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product {
            id
            title
            handle
            status
            variants(first: 10) {
              edges {
                node {
                  id
                  price
                  barcode
                  createdAt
                }
              }
            }
          }
        }
      }`,
    {
      variables: {
        product: {
          title: `${color} Snowboard`,
        },
      },
    },
  );
  const responseJson = await response.json();

  const product = responseJson.data!.productCreate!.product!;
  const variantId = product.variants.edges[0]!.node!.id!;

  const variantResponse = await admin.graphql(
    `#graphql
    mutation shopifyRemixTemplateUpdateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants {
          id
          price
          barcode
          createdAt
        }
      }
    }`,
    {
      variables: {
        productId: product.id,
        variants: [{ id: variantId, price: "100.00" }],
      },
    },
  );

  const variantResponseJson = await variantResponse.json();

  return {
    product: responseJson!.data!.productCreate!.product,
    variant:
      variantResponseJson!.data!.productVariantsBulkUpdate!.productVariants,
  };
};

export default function Index() {
  const fetcher = useFetcher<typeof action>();

  const shopify = useAppBridge();
  const productId = fetcher.data?.product?.id.replace(
    "gid://shopify/Product/",
    "",
  );

  useEffect(() => {
    if (productId) {
      shopify.toast.show("Product created");
    }
  }, [productId, shopify]);

  return (
    <Page>
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Add the Pencil Designer Embed to your Shopify Store
                  </Text>
                  <Text variant="bodyMd" as="p">
                    Follow these steps to add the "Pencil Designer Embed" block to
                    your theme:
                  </Text>
                </BlockStack>
                <BlockStack gap="200">
                  <List>
                    <List.Item>
                      1. From your Shopify admin, go to{" "}
                      <Link
                        url="https://admin.shopify.com/admin/themes"
                        target="_blank"
                        removeUnderline
                      >
                        Online Store &gt; Themes
                      </Link>
                      .
                    </List.Item>
                    <List.Item>
                      2. Find your current theme and click "Customize".
                    </List.Item>
                    <List.Item>
                      3. In the theme editor, navigate to the page where you want to
                      add the embed (e.g., a product page, a custom page, or the home
                      page).
                    </List.Item>
                    <List.Item>
                      4. In the left sidebar, click "Add section" or "Add block" (depending on where you want to add it).
                    </List.Item>
                    <List.Item>
                      5. Search for "Pencil Designer Embed" and click on it to add the block.
                    </List.Item>
                    <List.Item>
                      6. Configure the "Designer URL" with your Pencil Subdomain and the "Height" based on how you want the embed to look.
                    </List.Item>
                    <List.Item>7. Click "Save" to apply your changes.</List.Item>
                  </List>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
