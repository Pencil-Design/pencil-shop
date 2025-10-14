import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Text,
  Card,
  BlockStack,
  List,
  Link,
  Button,
  Banner,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { BillingService } from "../services/billing.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const billingService = new BillingService(admin);

  // Check for payment success parameters
  const url = new URL(request.url);
  const chargeId = url.searchParams.get("charge_id");
  const paymentSuccess = url.searchParams.get("payment_success") === "true" || !!chargeId;

  try {
    const currentSubscription = await billingService.getCurrentSubscription();
    return {
      currentSubscription,
      paymentSuccess,
      chargeId,
      subscriptionLoaded: true,
      subscriptionError: null
    };
  } catch (error) {
    console.error("Error loading subscription data:", error);
    return {
      currentSubscription: null,
      paymentSuccess,
      chargeId,
      subscriptionLoaded: true,
      subscriptionError: error instanceof Error ? error.message : "Failed to load subscription data"
    };
  }
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
  const { currentSubscription, paymentSuccess, chargeId, subscriptionLoaded, subscriptionError } = useLoaderData<typeof loader>();

  return (
    <Page>
      <TitleBar title="Pencil Shop Embed">
      </TitleBar>
      <BlockStack gap="500">
        {paymentSuccess && (
          <Banner tone="success">
            <Text variant="bodyMd" fontWeight="semibold" as="p">
              ✅ Payment Successful!
            </Text>
            <Text variant="bodyMd" as="p">
              Your subscription has been activated. You can now start using Pencil Shop features.
            </Text>
            {chargeId && (
              <Text variant="bodyMd" as="p">
                Transaction ID: <code>{chargeId}</code>
              </Text>
            )}
          </Banner>
        )}

        {subscriptionError && (
          <Banner tone="critical">
            <Text variant="bodyMd" fontWeight="semibold" as="p">
              Error loading subscription data
            </Text>
            <Text variant="bodyMd" as="p">
              {subscriptionError}
            </Text>
          </Banner>
        )}

        {!subscriptionLoaded ? (
          // Show loading state while subscription data is being fetched
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Loading...
              </Text>
              <Text variant="bodyMd" as="p">
                Please wait while we load your subscription information.
              </Text>
            </BlockStack>
          </Card>
        ) : !currentSubscription ? (
          // Show subscription prompt for non-subscribers (only after data is loaded)
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Get Started with Pencil Shop
              </Text>
              <Text variant="bodyMd" as="p">
                Connect your website with Pencil to sell custom products.
              </Text>
              <Button url="/app/billing" variant="primary" size="large">
                View Plans & Subscribe →
              </Button>
            </BlockStack>
          </Card>
        ) : (
          // Show embed instructions for subscribers
          <>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Add Pencil Shop Embeds to your Shopify Store
                </Text>
                <Text variant="bodyMd" as="p">
                  Follow these steps to add the "Pencil Shop Embed" block to
                  your theme:
                </Text>
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
                      5. Search for "Pencil Shop Embed" and click on it to add the block.
                    </List.Item>
                    <List.Item>
                      6. Configure the "Designer URL" with your Pencil Link (provided in your Pencil Shop Settings page) and the "Height" based on how you want the embed to look.
                    </List.Item>
                    <List.Item>7. Click "Save" to apply your changes.</List.Item>
                  </List>
                </BlockStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Configure Your Pencil Design Settings
                </Text>
                <Text variant="bodyMd" as="p">
                  To start adding products and custom templates to your store, you need to configure your settings in the Pencil Design app.
                </Text>
                <Text variant="bodyMd" tone="subdued" as="p">
                  In the Pencil Design app, you can:
                </Text>
                <List type="bullet">
                  <List.Item>Set up your product catalog and designs</List.Item>
                  <List.Item>Configure pricing and customization options</List.Item>
                  <List.Item>Manage your AI credits and usage</List.Item>
                  <List.Item>Create and publish products to your Shopify store</List.Item>
                </List>
                <Button
                  onClick={() => window.open('https://app.pencildesign.co/home', '_blank', 'noopener,noreferrer')}
                  variant="primary"
                  size="large"
                >
                  Open Pencil Design App →
                </Button>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Manage Subscription
                </Text>
                <Text variant="bodyMd" as="p">
                  Current plan: <strong>{currentSubscription.name}</strong> - Status: {currentSubscription.status}
                </Text>
                <Button url="/app/billing" variant="primary" size="medium">
                  Manage Subscription
                </Button>
              </BlockStack>
            </Card>
          </>
        )}
      </BlockStack>
    </Page>
  );
}


