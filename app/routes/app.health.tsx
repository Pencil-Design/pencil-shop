import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { createPencilAPIService } from "~/services/pencil-api.server";
import {
    Page,
    Text,
    Card,
    BlockStack,
    Banner,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

export async function loader({ request }: LoaderFunctionArgs) {
    await authenticate.admin(request);

    const results = {
        pencilAPI: null as any,
        error: null as string | null,
    };

    try {
        const pencilAPI = createPencilAPIService();
        results.pencilAPI = await pencilAPI.healthCheck();
    } catch (error) {
        results.error = error instanceof Error ? error.message : 'Unknown error';
        console.error('Pencil API health check failed:', error);
    }

    return json(results);
}

export default function HealthPage() {
    const { pencilAPI, error } = useLoaderData<typeof loader>();

    return (
        <Page>
            <TitleBar title="Health Check" />
            
            <BlockStack gap="500">
                <Card>
                    <BlockStack gap="300">
                        <Text variant="headingMd" as="h2">
                            Pencil API Integration
                        </Text>
                        
                        {error ? (
                            <Banner tone="critical">
                                <Text variant="bodyMd" as="p">
                                    <strong>Connection Failed:</strong> {error}
                                </Text>
                            </Banner>
                        ) : pencilAPI ? (
                            <Banner tone="success">
                                <Text variant="bodyMd" as="p">
                                    <strong>Connection Successful!</strong>
                                </Text>
                                <BlockStack gap="100">
                                    <Text variant="bodyMd" as="p">
                                        Status: {pencilAPI.status}
                                    </Text>
                                    <Text variant="bodyMd" as="p">
                                        Version: {pencilAPI.version}
                                    </Text>
                                    <Text variant="bodyMd" as="p">
                                        Timestamp: {new Date(pencilAPI.timestamp).toLocaleString()}
                                    </Text>
                                </BlockStack>
                            </Banner>
                        ) : (
                            <Banner tone="info">
                                <Text variant="bodyMd" as="p">
                                    Checking connection...
                                </Text>
                            </Banner>
                        )}
                    </BlockStack>
                </Card>

                <Card>
                    <BlockStack gap="300">
                        <Text variant="headingMd" as="h2">
                            Configuration
                        </Text>
                        
                        <BlockStack gap="200">
                            <Text variant="bodyMd" as="p">
                                <strong>Base URL:</strong> {process.env.PENCIL_API_BASE_URL || 'Not configured'}
                            </Text>
                            <Text variant="bodyMd" as="p">
                                <strong>API Key:</strong> {process.env.PENCIL_API_SECRET_KEY ? '✓ Configured' : '✗ Not configured'}
                            </Text>
                        </BlockStack>
                    </BlockStack>
                </Card>
            </BlockStack>
        </Page>
    );
}