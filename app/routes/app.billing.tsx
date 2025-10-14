import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { useEffect, useState } from "react";
import { useLoaderData, useActionData, useNavigation } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { BillingService, PRICING_PLANS } from "../services/billing.server";
import { createPencilAPIService } from "~/services/pencil-api.server";
import {
    Page,
    Text,
    Card,
    BlockStack,
    Button,
    Banner,
    List,
    Modal,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

export async function loader({ request }: LoaderFunctionArgs) {
    try {
        const { admin } = await authenticate.admin(request);
        const billingService = new BillingService(admin);

        try {
            const currentSubscription = await billingService.getCurrentSubscription();
            return json({
                currentSubscription,
                plans: PRICING_PLANS,
                error: null
            });
        } catch (error) {
            console.error("Error loading subscription data:", error);
            return json({
                currentSubscription: null,
                plans: PRICING_PLANS,
                error: "Failed to load subscription data"
            });
        }
    } catch (authError) {
        console.error("Authentication error in billing loader:", authError);
        return json({
            currentSubscription: null,
            plans: PRICING_PLANS,
            error: "Authentication failed. Please try logging in again."
        }, { status: 401 });
    }
}

export async function action({ request }: ActionFunctionArgs) {
    try {
        const { admin, session } = await authenticate.admin(request);
        const billingService = new BillingService(admin);

        const formData = await request.formData();
        const planId = formData.get("planId") as string;
        const action = formData.get("action") as string;

        // Handle unsubscribe action
        if (action === "unsubscribe") {
            const subscriptionId = formData.get("subscriptionId") as string;

            if (!subscriptionId) {
                return json({
                    error: "Missing subscription ID for unsubscribe"
                }, { status: 400 });
            }

            try {
                await billingService.cancelSubscription(subscriptionId);

                // Integrate with Pencil API after successful cancellation
                try {
                    const pencilAPI = createPencilAPIService();

                    // Get shop details for merchant info
                    const shopQuery = `query { shop { contactEmail name } }`;
                    const shopResponse = await admin.graphql(shopQuery);
                    const shopResult = await shopResponse.json();
                    const shopData = shopResult.data?.shop;

                    if (shopData && shopData.contactEmail) {
                        await pencilAPI.handleSubscriptionCancellation({
                            email: shopData.contactEmail,
                            firstName: undefined,
                            lastName: undefined,
                        });
                    }
                } catch (pencilError) {
                    console.error('Error cancelling Pencil API user (non-blocking):', pencilError);
                    // Don't fail the cancellation - this is supplementary
                }

                return json({
                    success: true,
                    message: "Subscription cancelled successfully"
                });
            } catch (error) {
                console.error("Error cancelling subscription:", error);
                return json({
                    error: error instanceof Error ? error.message : "Failed to cancel subscription. Please try again."
                }, { status: 500 });
            }
        }

        // Handle subscribe action
        if (!planId) {
            return json({
                error: "Missing required field: planId"
            }, { status: 400 });
        }

        if (!PRICING_PLANS[planId]) {
            return json({
                error: "Invalid plan selected"
            }, { status: 400 });
        }

        try {
            // Create a proper Shopify admin return URL using the authenticated session
            const shop = session.shop;

            if (!shop) {
                return json({
                    error: "Missing shop in session"
                }, { status: 400 });
            }

            // Extract shop name without .myshopify.com for proper URL construction
            const shopName = shop.replace('.myshopify.com', '');

            // Construct the proper Shopify admin app URL - redirect to setup page
            const fullReturnUrl = `https://admin.shopify.com/store/${shopName}/apps/pencil-shop-3/app/setup`;

            const result = await billingService.createSubscription({
                planId,
                shopDomain: shop,
                returnUrl: fullReturnUrl
            });

            // Integrate with Pencil API after successful subscription creation
            try {
                const pencilAPI = createPencilAPIService();

                // Get shop details for merchant info
                const shopQuery = `query { shop { contactEmail name } }`;
                const shopResponse = await admin.graphql(shopQuery);
                const shopResult = await shopResponse.json();
                const shopData = shopResult.data?.shop;

                if (shopData && shopData.contactEmail) {
                    await pencilAPI.handleSubscriptionActivation({
                        email: shopData.contactEmail,
                        firstName: undefined,
                        lastName: undefined,
                        planId,
                        subscriptionId: result.appSubscription?.id,
                        price: PRICING_PLANS[planId]?.monthlyPrice,
                    });
                }
            } catch (pencilError) {
                console.error('Error creating Pencil API user (non-blocking):', pencilError);
                // Don't fail the subscription creation - this is supplementary
            }

            // Return confirmation URL and let App Bridge handle top-level navigation client-side
            return json({ success: true, confirmationUrl: result.confirmationUrl });
        } catch (error) {
            console.error("Error creating subscription:", error);
            return json({
                error: error instanceof Error ? error.message : "Failed to create subscription. Please try again."
            }, { status: 500 });
        }
    } catch (authError) {
        console.error("Authentication error in billing action:", authError);
        return json({
            error: "Authentication failed. Please try logging in again."
        }, { status: 401 });
    }
}

export default function BillingPage() {
    const { currentSubscription, error: loadError } = useLoaderData<typeof loader>();
    const actionData = useActionData<typeof action>();
    const navigation = useNavigation();

    const isSubmitting = navigation.state === "submitting";
    const [showCancelModal, setShowCancelModal] = useState(false);

    // Determine which plan is currently active
    const getActivePlanId = () => {
        if (!currentSubscription) return null;

        // Check if the subscription name contains plan identifiers
        const name = currentSubscription.name?.toLowerCase() || '';
        if (name.includes('pencil shop plus') || name.includes('plus')) {
            return 'pencilShopPlus';
        } else if (name.includes('pencil shop')) {
            return 'pencilShop';
        }
        return null;
    };

    const activePlanId = getActivePlanId();

    const handleCancelClick = () => {
        setShowCancelModal(true);
    };

    const handleCancelConfirm = () => {
        setShowCancelModal(false);
        // Submit the unsubscribe form
        const form = document.querySelector('form[data-action="unsubscribe"]') as HTMLFormElement;
        if (form) {
            form.submit();
        }
    };

    const handleCancelClose = () => {
        setShowCancelModal(false);
    };

    // When we receive a confirmationUrl from the action, use App Bridge to navigate
    // at the top level (outside the iframe) to avoid X-Frame-Options issues.
    useEffect(() => {
        const url = (actionData as any)?.confirmationUrl as string | undefined;
        if (!url) return;
        // Force top-level navigation to avoid iframe/X-Frame-Options issues
        if (typeof window !== "undefined") {
            const target = window.top ?? window;
            target.location.href = url;
        }
    }, [actionData]);

    return (
        <Page>
            <TitleBar title="Choose Your Plan" />

            <BlockStack gap="500">
                {loadError && (
                    <Banner tone="critical">
                        <p>{loadError}</p>
                    </Banner>
                )}

                {actionData && 'error' in actionData && (
                    <Banner tone="critical">
                        <p>{actionData.error}</p>
                    </Banner>
                )}

                {actionData && 'success' in actionData && actionData.success && 'message' in actionData && actionData.message && (
                    <Banner tone="success">
                        <p>{actionData.message}</p>
                    </Banner>
                )}

                {currentSubscription && (
                    <Banner tone="info">
                        <p>
                            <strong>{currentSubscription.name}</strong> - Status: {currentSubscription.status}
                        </p>
                        <p>
                            Next billing: {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}
                        </p>
                    </Banner>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'stretch' }}>
                    <Card>
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '375px' }}>
                            <div style={{ flex: '1' }}>
                                <BlockStack gap="400">
                                    <BlockStack gap="200">
                                        <Text variant="headingMd" as="h2">
                                            Pencil Shop
                                        </Text>
                                        <Text variant="headingLg" fontWeight="bold" as="h3">
                                            $99 per month
                                        </Text>
                                        <Text variant="bodyMd" tone="subdued" as="p">
                                            Connect your website with Pencil to sell
                                        </Text>
                                    </BlockStack>

                                    <BlockStack gap="200">
                                        <Text variant="bodyMd" fontWeight="semibold" as="p">
                                            Features:
                                        </Text>
                                        <List type="bullet">
                                            <List.Item>1000 AI credits per month</List.Item>
                                            <List.Item>Everything in Pro, plus:</List.Item>
                                            <List.Item>Publish designs directly to your website as products</List.Item>
                                            <List.Item>Made-to-order product catalog</List.Item>
                                            <List.Item>Live pricing and add-to-cart tools</List.Item>
                                            <List.Item>1.8% transaction fee</List.Item>
                                        </List>
                                    </BlockStack>
                                </BlockStack>
                            </div>

                            <div style={{ paddingTop: '1rem' }}>
                                {activePlanId === 'pencilShop' ? (
                                    <Button
                                        variant="secondary"
                                        size="large"
                                        fullWidth
                                        loading={isSubmitting}
                                        onClick={handleCancelClick}
                                    >
                                        Cancel Subscription
                                    </Button>
                                ) : (
                                    <form method="post">
                                        <input type="hidden" name="planId" value="pencilShop" />
                                        <Button
                                            submit
                                            variant="primary"
                                            size="large"
                                            fullWidth
                                            loading={isSubmitting}
                                        >
                                            {activePlanId === 'pencilShopPlus' ? "Downgrade" : "Get Plan →"}
                                        </Button>
                                    </form>
                                )}
                            </div>
                        </div>
                    </Card>

                    <Card>
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '375px' }}>
                            <div style={{ flex: '1' }}>
                                <BlockStack gap="400">
                                    <BlockStack gap="200">
                                        <Text variant="headingMd" as="h2">
                                            Pencil Shop Plus
                                        </Text>
                                        <Text variant="headingLg" fontWeight="bold" as="h3">
                                            $199 per month
                                        </Text>
                                        <Text variant="bodyMd" tone="subdued" as="p">
                                            Online custom design tools on your website
                                        </Text>
                                    </BlockStack>

                                    <BlockStack gap="200">
                                        <Text variant="bodyMd" fontWeight="semibold" as="p">
                                            Features:
                                        </Text>
                                        <List type="bullet">
                                            <List.Item>2000 AI credits per month</List.Item>
                                            <List.Item>Everything in Shop, plus:</List.Item>
                                            <List.Item>Ring builder app</List.Item>
                                            <List.Item>Online custom design app</List.Item>
                                            <List.Item>Detailed pricing calculator and controls</List.Item>
                                            <List.Item>Custom AI agent</List.Item>
                                            <List.Item>Dedicated account manager</List.Item>
                                            <List.Item>0.8% transaction fee</List.Item>
                                        </List>
                                    </BlockStack>
                                </BlockStack>
                            </div>

                            <div style={{ paddingTop: '1rem' }}>
                                {activePlanId === 'pencilShopPlus' ? (
                                    <Button
                                        variant="secondary"
                                        size="large"
                                        fullWidth
                                        loading={isSubmitting}
                                        onClick={handleCancelClick}
                                    >
                                        Cancel Subscription
                                    </Button>
                                ) : (
                                    <form method="post">
                                        <input type="hidden" name="planId" value="pencilShopPlus" />
                                        <Button
                                            submit
                                            variant="primary"
                                            size="large"
                                            fullWidth
                                            loading={isSubmitting}
                                        >
                                            {activePlanId === 'pencilShop' ? "Upgrade" : "Get Plan →"}
                                        </Button>
                                    </form>
                                )}
                            </div>
                        </div>
                    </Card>
                </div>

                <Card>
                    <BlockStack gap="300">
                        <Text variant="headingMd" as="h3">
                            How Transaction Fees Work
                        </Text>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <BlockStack gap="200">
                                <Text variant="bodyMd" fontWeight="semibold" as="p">
                                    Pencil Shop Plan
                                </Text>
                                <Text variant="bodyMd" tone="subdued" as="p">
                                    Pay 1.8% on each transaction, with a maximum of $5,000 per month in transaction fees.
                                </Text>
                                <Text variant="bodyMd" tone="subdued" as="p">
                                    Example: $10,000 in sales = $180 in fees
                                </Text>
                            </BlockStack>
                            <BlockStack gap="200">
                                <Text variant="bodyMd" fontWeight="semibold" as="p">
                                    Pencil Shop Plus Plan
                                </Text>
                                <Text variant="bodyMd" tone="subdued" as="p">
                                    Pay 0.8% on each transaction, with a maximum of $5,000 per month in transaction fees.
                                </Text>
                                <Text variant="bodyMd" tone="subdued" as="p">
                                    Example: $10,000 in sales = $80 in fees
                                </Text>
                            </BlockStack>
                        </div>
                    </BlockStack>
                </Card>
            </BlockStack>

            {/* Hidden unsubscribe form */}
            <form method="post" data-action="unsubscribe" style={{ display: 'none' }}>
                <input type="hidden" name="action" value="unsubscribe" />
                <input type="hidden" name="subscriptionId" value={currentSubscription?.id || ''} />
            </form>

            {/* Cancel Subscription Modal */}
            <Modal
                open={showCancelModal}
                onClose={handleCancelClose}
                title="Cancel Subscription"
                primaryAction={{
                    content: 'Cancel Subscription',
                    onAction: handleCancelConfirm,
                    destructive: true,
                }}
                secondaryActions={[
                    {
                        content: 'Keep Subscription',
                        onAction: handleCancelClose,
                    },
                ]}
            >
                <Modal.Section>
                    <BlockStack gap="400">
                        <Text variant="bodyMd" as="p">
                            Are you sure you want to cancel your subscription?
                        </Text>
                        <Banner tone="warning">
                            <Text variant="bodyMd" as="p">
                                <strong>Warning:</strong> Cancelling your subscription will permanently delete all your shop information, including:
                            </Text>
                            <List type="bullet">
                                <List.Item>All product designs and configurations</List.Item>
                                <List.Item>Customer order history</List.Item>
                                <List.Item>Custom pricing settings</List.Item>
                                <List.Item>AI-generated content and templates</List.Item>
                                <List.Item>Account preferences and settings</List.Item>
                            </List>
                            <Text variant="bodyMd" as="p">
                                This action cannot be undone. You will need to set up your shop from scratch if you decide to resubscribe later.
                            </Text>
                        </Banner>
                    </BlockStack>
                </Modal.Section>
            </Modal>
        </Page>
    );
}
