import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
    Page,
    Text,
    Card,
    BlockStack,
    Button,
    Banner,
    List,
    Divider,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { BillingService } from "../services/billing.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const { admin } = await authenticate.admin(request);
    const billingService = new BillingService(admin);

    try {
        const currentSubscription = await billingService.getCurrentSubscription();
        return { currentSubscription };
    } catch (error) {
        console.error("Error loading subscription data:", error);
        return { currentSubscription: null };
    }
};

export default function SetupPage() {
    const { currentSubscription } = useLoaderData<typeof loader>();

    return (
        <Page>
            <TitleBar title="Welcome to Pencil Shop!" />

            <BlockStack gap="500">
                <Banner tone="success">
                    <Text variant="bodyMd" fontWeight="semibold" as="p">
                        🎉 Subscription Activated Successfully!
                    </Text>
                    <Text variant="bodyMd" as="p">
                        Your {currentSubscription?.name || 'Pencil Shop'} subscription is now active.
                        You're ready to start selling custom products!
                    </Text>
                </Banner>

                <Card>
                    <BlockStack gap="400">
                        <Text as="h2" variant="headingMd">
                            Next Steps: Set Up Your Pencil Account
                        </Text>

                        <Text variant="bodyMd" as="p">
                            To start creating and selling custom products, you'll need to access your Pencil Design account.
                            Since this is your first time, you'll need to reset your password to log in.
                        </Text>

                        <Divider />

                        <BlockStack gap="300">
                            <Text variant="bodyMd" fontWeight="semibold" as="p">
                                Step 1: Access Pencil Design App
                            </Text>
                            <Text variant="bodyMd" as="p">
                                Click the button below to open Pencil Design in a new tab. This will take you to the login page.
                            </Text>
                            <Button
                                onClick={() => window.open('https://app.pencildesign.co/home', '_blank', 'noopener,noreferrer')}
                                variant="primary"
                                size="large"
                            >
                                Open Pencil Design App →
                            </Button>
                        </BlockStack>

                        <Divider />

                        <BlockStack gap="300">
                            <Text variant="bodyMd" fontWeight="semibold" as="p">
                                Step 2: Reset Your Password
                            </Text>
                            <Text variant="bodyMd" as="p">
                                Since this is your first time accessing Pencil, you'll need to reset your password:
                            </Text>
                            <List type="number">
                                <List.Item>On the Pencil login page, click "Forgot Password?"</List.Item>
                                <List.Item>Enter your email address (the same one associated with your Shopify store)</List.Item>
                                <List.Item>Check your email for a password reset link</List.Item>
                                <List.Item>Click the link and create a new password</List.Item>
                                <List.Item>Log in with your new password</List.Item>
                            </List>
                        </BlockStack>

                        <Divider />

                        <BlockStack gap="300">
                            <Text variant="bodyMd" fontWeight="semibold" as="p">
                                Step 3: Configure Your Products & Templates
                            </Text>
                            <Text variant="bodyMd" as="p">
                                Once you're logged into Pencil, you can:
                            </Text>
                            <List type="bullet">
                                <List.Item>Set up your product catalog and designs</List.Item>
                                <List.Item>Configure pricing and customization options</List.Item>
                                <List.Item>Manage your AI credits and usage</List.Item>
                                <List.Item>Create and publish products to your Shopify store</List.Item>
                                <List.Item>Customize your design templates</List.Item>
                            </List>
                        </BlockStack>

                        <Divider />

                        <BlockStack gap="300">
                            <Text variant="bodyMd" fontWeight="semibold" as="p">
                                Step 4: Add Pencil Shop to Your Store
                            </Text>
                            <Text variant="bodyMd" as="p">
                                After configuring your products in Pencil, you can add the Pencil Shop embed to your Shopify store:
                            </Text>
                            <List type="number">
                                <List.Item>Go to your Shopify admin → Online Store → Themes</List.Item>
                                <List.Item>Click "Customize" on your active theme</List.Item>
                                <List.Item>Add the "Pencil Shop Embed" block to any page</List.Item>
                                <List.Item>Configure the Designer URL with your Pencil link</List.Item>
                                <List.Item>Save your changes</List.Item>
                            </List>
                        </BlockStack>
                    </BlockStack>
                </Card>

                <Card>
                    <BlockStack gap="400">
                        <Text as="h2" variant="headingMd">
                            Ready to Get Started?
                        </Text>
                        <Text variant="bodyMd" as="p">
                            Once you've completed the setup steps above, you can return to the main app to manage your subscription and get additional help with embedding Pencil Shop into your store.
                        </Text>
                        <Button url="/app" variant="primary">
                            Return to Main App
                        </Button>
                    </BlockStack>
                </Card>
            </BlockStack>
        </Page>
    );
}
