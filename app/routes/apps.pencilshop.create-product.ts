import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function action({ request }: ActionFunctionArgs) {
    try {
        console.log('POST /apps/pencilshop/create-product - starting action');

        // This is an app proxy request, use authenticate.public.appProxy
        const context = await authenticate.public.appProxy(request);

        if (!context.admin) {
            console.log('❌ No admin access available in app proxy context');
            return new Response(JSON.stringify({
                error: "App not installed or no admin access available",
                details: "The app proxy context does not have admin access. Make sure the app is properly installed and has the required permissions."
            }), {
                status: 403,
                headers: { "content-type": "application/json" },
            });
        }

        const admin = context.admin;

        // Extract shop domain from the request URL (app proxy includes shop parameter)
        const url = new URL(request.url);
        const shop = url.searchParams.get('shop') || 'unknown';

        // Parse the request body to get product data
        const body = await request.json();
        const { productName, title, description, vendor, price, compareAtPrice, productType, tags, modelId, currency, source } = body;

        // Use productName as the primary title, fallback to title
        const productTitle = productName || title;

        // Log the incoming data for debugging
        console.log('📦 Product data received:', {
            productName,
            title,
            productTitle,
            price,
            currency,
            modelId,
            source
        });

        // Validate required fields
        if (!productTitle) {
            return new Response(JSON.stringify({
                error: "Product title is required"
            }), {
                status: 400,
                headers: { "content-type": "application/json" },
            });
        }

        // Generate a unique handle to avoid conflicts
        const baseHandle = productTitle.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        const uniqueHandle = `${baseHandle}-${Date.now()}`;

        // Create the product using GraphQL mutation
        const productResponse = await admin.graphql(`
            mutation productCreate($product: ProductCreateInput!) {
                productCreate(product: $product) {
                    product {
                        id
                        title
                        descriptionHtml
                        vendor
                        productType
                        tags
                        status
                        createdAt
                        handle
                    }
                    userErrors {
                        field
                        message
                    }
                }
            }
        `, {
            variables: {
                product: {
                    title: productTitle,
                    handle: uniqueHandle,
                    descriptionHtml: description || "",
                    vendor: vendor || "",
                    productType: productType || "",
                    tags: [
                        ...(tags ? tags.split(',').map((tag: string) => tag.trim()) : []),
                        "pencil-shop-product",
                        "hidden-from-shop"
                    ],
                    metafields: [
                        {
                            namespace: "seo",
                            key: "hidden",
                            value: "true",
                            type: "boolean"
                        },
                        {
                            namespace: "custom",
                            key: "hidden_from_shop",
                            value: "true",
                            type: "boolean"
                        }
                    ],
                    status: "ACTIVE"
                }
            }
        });

        const productData = await productResponse.json() as any;

        // Check for GraphQL errors
        if (productData.errors) {
            console.error('GraphQL errors:', productData.errors);
            return new Response(JSON.stringify({
                error: "GraphQL errors occurred",
                details: productData.errors
            }), {
                status: 500,
                headers: { "content-type": "application/json" },
            });
        }

        // Check for user errors from the mutation
        if (productData.data.productCreate.userErrors.length > 0) {
            console.error('User errors:', productData.data.productCreate.userErrors);
            return new Response(JSON.stringify({
                error: "Product creation failed",
                details: productData.data.productCreate.userErrors
            }), {
                status: 400,
                headers: { "content-type": "application/json" },
            });
        }

        const product = productData.data.productCreate.product;
        console.log('✅ Product created:', product.id, '-', product.title);

        // Check if product already has variants
        const existingVariantsResponse = await admin.graphql(`
            query getProductVariants($productId: ID!) {
                product(id: $productId) {
                    variants(first: 10) {
                        nodes {
                            id
                            title
                            price
                            compareAtPrice
                            availableForSale
                            inventoryQuantity
                        }
                    }
                }
            }
        `, {
            variables: {
                productId: product.id
            }
        });

        const existingVariantsData = await existingVariantsResponse.json() as any;
        const existingVariants = existingVariantsData.data.product.variants.nodes;

        let variant;
        if (existingVariants.length > 0) {
            // Use existing variant and update its price
            variant = existingVariants[0];
            console.log('✅ Using existing variant:', variant.id, '- Updating price to:', price || "0.00");

            // Update the variant price using bulk update
            const updateResponse = await admin.graphql(`
                   mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
                       productVariantsBulkUpdate(productId: $productId, variants: $variants) {
                           productVariants {
                               id
                               title
                               price
                               compareAtPrice
                           }
                           userErrors {
                               field
                               message
                           }
                       }
                   }
               `, {
                variables: {
                    productId: product.id,
                    variants: [{
                        id: variant.id,
                        price: price || "0.00",
                        compareAtPrice: compareAtPrice || null
                    }]
                }
            });

            const updateData = await updateResponse.json() as any;
            if (updateData.data.productVariantsBulkUpdate.userErrors.length > 0) {
                console.error('Variant update errors:', updateData.data.productVariantsBulkUpdate.userErrors);
            } else {
                variant = updateData.data.productVariantsBulkUpdate.productVariants[0];
                console.log('✅ Variant price updated:', variant.id, '- Price:', variant.price);
            }
        } else {
            // Create new variant
            const variantResponse = await admin.graphql(`
                mutation productVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
                    productVariantsBulkCreate(productId: $productId, variants: $variants) {
                        productVariants {
                            id
                            title
                            price
                            compareAtPrice
                            availableForSale
                            inventoryQuantity
                        }
                        userErrors {
                            field
                            message
                        }
                    }
                }
            `, {
                variables: {
                    productId: product.id,
                    variants: [{
                        price: price || "0.00",
                        compareAtPrice: compareAtPrice || null,
                        inventoryPolicy: "CONTINUE",
                        inventoryManagement: "SHOPIFY",
                        inventoryQuantity: 999
                    }]
                }
            });

            const variantData = await variantResponse.json() as any;

            // Check for variant creation errors
            if (variantData.errors) {
                console.error('❌ Variant GraphQL errors:', variantData.errors);
                return new Response(JSON.stringify({
                    error: "Variant creation failed",
                    details: variantData.errors
                }), {
                    status: 500,
                    headers: { "content-type": "application/json" },
                });
            }

            if (variantData.data.productVariantsBulkCreate.userErrors.length > 0) {
                console.error('❌ Variant user errors:', variantData.data.productVariantsBulkCreate.userErrors);
                return new Response(JSON.stringify({
                    error: "Variant creation failed",
                    details: variantData.data.productVariantsBulkCreate.userErrors
                }), {
                    status: 400,
                    headers: { "content-type": "application/json" },
                });
            }

            variant = variantData.data.productVariantsBulkCreate.productVariants[0];
            console.log('✅ Variant created:', variant.id, '- Price:', variant.price);

        }

        // First, get the Online Store publication ID
        console.log('📢 Getting Online Store publication...');
        const publicationsResponse = await admin.graphql(`
        query getPublications {
            publications(first: 10) {
                nodes {
                    id
                    name
                    supportsFuturePublishing
                }
            }
        }
    `);

        const publicationsData = await publicationsResponse.json() as any;
        console.log('📊 Available publications:', JSON.stringify(publicationsData, null, 2));

        // Find the Online Store publication (usually named "Online Store")
        const onlineStorePublication = publicationsData.data.publications.nodes.find(
            (pub: any) => pub.name === "Online Store" || pub.name === "online store"
        );

        if (!onlineStorePublication) {
            console.error('❌ Online Store publication not found');
            return new Response(JSON.stringify({
                error: "Online Store publication not found",
                details: "Cannot publish product - Online Store channel not available"
            }), {
                status: 400,
                headers: { "content-type": "application/json" },
            });
        }

        console.log('📢 Publishing product to Online Store publication:', onlineStorePublication.id);
        const publishResponse = await admin.graphql(`
        mutation publishablePublish($id: ID!, $input: [PublicationInput!]!) {
            publishablePublish(id: $id, input: $input) {
                publishable {
                    availablePublicationsCount {
                        count
                    }
                    resourcePublicationsCount {
                        count
                    }
                }
                shop {
                    publicationCount
                }
                userErrors {
                    field
                    message
                }
            }
        }
    `, {
            variables: {
                id: product.id,
                input: [{ publicationId: onlineStorePublication.id }]
            }
        });

        const publishData = await publishResponse.json() as any;

        if (publishData.errors) {
            console.error('❌ Publish GraphQL errors:', publishData.errors);
            return new Response(JSON.stringify({
                error: "Product created but failed to publish",
                details: publishData.errors
            }), {
                status: 500,
                headers: { "content-type": "application/json" },
            });
        }

        if (publishData.data.publishablePublish.userErrors.length > 0) {
            console.error('❌ Publish user errors:', publishData.data.publishablePublish.userErrors);
            return new Response(JSON.stringify({
                error: "Product created but not published to Online Store",
                details: publishData.data.publishablePublish.userErrors,
                productId: product.id,
                variantId: variant.id,
                handle: product.handle
            }), {
                status: 400,
                headers: { "content-type": "application/json" },
            });
        }

        console.log('✅ Product published to Online Store successfully!');

        // Handle collection management for hidden-from-shop products
        await hideProductFromShopfront(admin, product.id);

        // Save to database
        try {
            const modelData = {
                shop: shop,
                modelId: modelId || `model-${Date.now()}`,
                productId: product.id.replace('gid://shopify/Product/', ''),
                variantId: variant.id.replace('gid://shopify/ProductVariant/', ''),
                productName: productTitle,
                price: price || "0.00",
                currency: currency || "USD",
                source: source || "pencil-shop",
                designerUrl: "", // Can be populated if available
                shopifyProductGid: product.id,
                shopifyVariantGid: variant.id
            };

            await prisma.model.upsert({
                where: { modelId: modelData.modelId },
                update: {
                    shop: modelData.shop,
                    productId: modelData.productId,
                    variantId: modelData.variantId,
                    productName: modelData.productName,
                    price: modelData.price,
                    currency: modelData.currency,
                    source: modelData.source,
                    shopifyProductGid: modelData.shopifyProductGid,
                    shopifyVariantGid: modelData.shopifyVariantGid,
                    updatedAt: new Date()
                },
                create: modelData
            });

            console.log('✅ Model saved to database:', modelData.modelId);
        } catch (dbError) {
            console.error('❌ Database save error:', dbError);
            // Don't fail the request if database save fails
        }

        // Return success response with created product
        const responseData = {
            success: true,
            product: {
                ...product,
                variants: {
                    nodes: [variant]
                }
            },
            productId: product.id,
            handle: product.handle,
            variantId: variant.id.replace('gid://shopify/ProductVariant/', ''),
            modelId: modelId || `model-${Date.now()}`,
            metadata: {
                source: source || "pencil-shop",
                currency: currency || "USD",
                price: price || "0.00",
                createdAt: new Date().toISOString()
            }
        };

        console.log('🆔 Returning variant ID:', responseData.variantId, 'from full GID:', variant.id);

        return new Response(JSON.stringify(responseData), {
            status: 201,
            headers: { "content-type": "application/json" },
        });

    } catch (error) {
        console.error('❌ Error in create-product action:', error);
        return new Response(JSON.stringify({
            error: "Failed to create product",
            details: (error as Error).message
        }), {
            status: 500,
            headers: { "content-type": "application/json" },
        });
    }
}

/**
 * Complete workflow to hide a product from shopfront while keeping it published
 */
async function hideProductFromShopfront(admin: any, productId: string): Promise<void> {
    try {
        console.log(`🚀 Starting hide workflow for product: ${productId}`);

        // 1. Set seo.hidden metafield
        await setSeoHiddenMetafield(admin, productId);

        // 2. Remove from manual collections
        await removeFromManualCollections(admin, productId);

        // 3. Update smart collections
        await updateSmartCollectionsToExcludeHidden(admin, productId);

        console.log('✅ Hide workflow completed');
    } catch (error) {
        console.error('❌ Error in hide workflow:', error);
        // Don't fail the entire request if hide workflow fails
    }
}

/**
 * Sets the seo.hidden metafield on a product to hide it from search
 */
async function setSeoHiddenMetafield(admin: any, productId: string): Promise<void> {
    try {
        console.log(`🔍 Setting seo.hidden metafield for product: ${productId}`);

        const metafieldResponse = await admin.graphql(`
            mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
                metafieldsSet(metafields: $metafields) {
                    metafields {
                        id
                        namespace
                        key
                        value
                    }
                    userErrors {
                        field
                        message
                    }
                }
            }
        `, {
            variables: {
                metafields: [{
                    ownerId: productId,
                    namespace: "seo",
                    key: "hidden",
                    value: "true",
                    type: "boolean"
                }]
            }
        });

        const metafieldData = await metafieldResponse.json() as any;

        if (metafieldData.data.metafieldsSet.userErrors.length > 0) {
            console.error('❌ Error setting seo.hidden metafield:', metafieldData.data.metafieldsSet.userErrors);
        } else {
            console.log('✅ seo.hidden metafield set successfully');
        }
    } catch (error) {
        console.error('❌ Error setting seo.hidden metafield:', error);
    }
}

/**
 * Removes a product from all manual collections
 */
async function removeFromManualCollections(admin: any, productId: string): Promise<void> {
    try {
        console.log(`🗑️ Removing product from manual collections: ${productId}`);

        // Get ALL collections in the store and check which ones contain this product
        const allCollectionsResponse = await admin.graphql(`
            query getAllCollectionsWithProduct($productId: String!) {
                collections(first: 100) {
                    nodes {
                        id
                        title
                        handle
                        publishedAt
                        ruleSet {
                            appliedDisjunctively
                            rules {
                                column
                                relation
                                condition
                            }
                        }
                        products(first: 1, query: "id:${productId.replace('gid://shopify/Product/', '')}") {
                            nodes {
                                id
                            }
                        }
                    }
                }
            }
        `);

        const allCollectionsData = await allCollectionsResponse.json() as any;
        const allCollections = allCollectionsData.data.collections.nodes;

        // Find collections that actually contain this product
        const collectionsWithProduct = allCollections.filter((collection: any) =>
            collection.products.nodes.length > 0
        );

        // Filter to only manual collections (no rules)
        const manualCollections = collectionsWithProduct.filter((collection: any) =>
            !collection.ruleSet || !collection.ruleSet.rules || collection.ruleSet.rules.length === 0
        );

        console.log(`📦 Found ${manualCollections.length} manual collections containing this product`);

        for (const collection of manualCollections) {
            console.log(`🗑️ Removing from manual collection: ${collection.title} (${collection.handle})`);
            await removeProductFromManualCollection(admin, collection.id, productId);
        }
    } catch (error) {
        console.error('❌ Error removing from manual collections:', error);
    }
}

/**
 * Updates smart collections to exclude products with hidden-from-shop tag
 */
async function updateSmartCollectionsToExcludeHidden(admin: any, productId: string): Promise<void> {
    try {
        console.log(`🔧 Updating smart collections to exclude hidden products: ${productId}`);

        // Get ALL collections in the store and check which ones contain this product
        const allCollectionsResponse = await admin.graphql(`
            query getAllCollectionsWithProduct($productId: String!) {
                collections(first: 100) {
                    nodes {
                        id
                        title
                        handle
                        publishedAt
                        ruleSet {
                            appliedDisjunctively
                            rules {
                                column
                                relation
                                condition
                            }
                        }
                        products(first: 1, query: "id:${productId.replace('gid://shopify/Product/', '')}") {
                            nodes {
                                id
                            }
                        }
                    }
                }
            }
        `);

        const allCollectionsData = await allCollectionsResponse.json() as any;
        const allCollections = allCollectionsData.data.collections.nodes;

        // Find collections that actually contain this product
        const collectionsWithProduct = allCollections.filter((collection: any) =>
            collection.products.nodes.length > 0
        );

        // Filter to only smart collections (has rules)
        const smartCollections = collectionsWithProduct.filter((collection: any) =>
            collection.ruleSet && collection.ruleSet.rules && collection.ruleSet.rules.length > 0
        );

        console.log(`📦 Found ${smartCollections.length} smart collections containing this product`);

        for (const collection of smartCollections) {
            console.log(`🔧 Updating smart collection: ${collection.title} (${collection.handle})`);
            await updateSmartCollectionRules(admin, collection);
        }
    } catch (error) {
        console.error('❌ Error updating smart collections:', error);
    }
}

/**
 * Removes a product from a specific manual collection
 */
async function removeProductFromManualCollection(admin: any, collectionId: string, productId: string): Promise<void> {
    try {
        const removeResponse = await admin.graphql(`
            mutation collectionRemoveProducts($id: ID!, $productIds: [ID!]!) {
                collectionRemoveProducts(id: $id, productIds: $productIds) {
                    job {
                        id
                    }
                    userErrors {
                        field
                        message
                    }
                }
            }
        `, {
            variables: {
                id: collectionId,
                productIds: [productId]
            }
        });

        const removeData = await removeResponse.json() as any;

        if (removeData.data.collectionRemoveProducts.userErrors.length > 0) {
            console.error('❌ Error removing product from collection:', removeData.data.collectionRemoveProducts.userErrors);
        } else {
            console.log('✅ Product removed from manual collection');
        }
    } catch (error) {
        console.error('❌ Error removing product from manual collection:', error);
    }
}

/**
 * Updates smart collection rules to exclude products with hidden-from-shop tag
 */
async function updateSmartCollectionRules(admin: any, collection: any): Promise<void> {
    try {
        const existingRules = collection.ruleSet.rules || [];

        // Check if we already have a rule to exclude hidden-from-shop products
        const hasHiddenRule = existingRules.some((rule: any) =>
            rule.column === 'TAG' &&
            rule.relation === 'NOT_EQUALS' &&
            rule.condition === 'hidden-from-shop'
        );

        if (hasHiddenRule) {
            console.log('✅ Collection already has rule to exclude hidden-from-shop products');
            return;
        }

        // Add new rule to exclude hidden-from-shop products
        const updatedRules = [
            ...existingRules,
            {
                column: 'TAG',
                relation: 'NOT_EQUALS',
                condition: 'hidden-from-shop'
            }
        ];

        const updateResponse = await admin.graphql(`
            mutation collectionUpdate($input: CollectionInput!) {
                collectionUpdate(input: $input) {
                    collection {
                        id
                        title
                        ruleSet {
                            appliedDisjunctively
                            rules {
                                column
                                relation
                                condition
                            }
                        }
                    }
                    userErrors {
                        field
                        message
                    }
                }
            }
        `, {
            variables: {
                input: {
                    id: collection.id,
                    ruleSet: {
                        appliedDisjunctively: collection.ruleSet.appliedDisjunctively,
                        rules: updatedRules
                    }
                }
            }
        });

        const updateData = await updateResponse.json() as any;

        if (updateData.data.collectionUpdate.userErrors.length > 0) {
            console.error('❌ Error updating smart collection rules:', updateData.data.collectionUpdate.userErrors);
        } else {
            console.log('✅ Smart collection rules updated to exclude hidden-from-shop products');
        }
    } catch (error) {
        console.error('❌ Error updating smart collection rules:', error);
    }
}
