import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function action({ request }: ActionFunctionArgs) {
    try {
        console.log('POST /apps/pencilshop2/create-product - starting action');

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
                    tags: tags ? tags.split(',').map((tag: string) => tag.trim()) : []
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
                        compareAtPrice: compareAtPrice || null
                    }]
                }
            });

            const variantData = await variantResponse.json() as any;

            // Check for variant creation errors
            if (variantData.errors) {
                console.error('Variant GraphQL errors:', variantData.errors);
                return new Response(JSON.stringify({
                    error: "Variant creation failed",
                    details: variantData.errors
                }), {
                    status: 500,
                    headers: { "content-type": "application/json" },
                });
            }

            if (variantData.data.productVariantsBulkCreate.userErrors.length > 0) {
                console.error('Variant user errors:', variantData.data.productVariantsBulkCreate.userErrors);
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

        // Save to database
        try {
            const modelData = {
                modelId: modelId || `model-${Date.now()}`,
                productId: product.id.replace('gid://shopify/Product/', ''),
                variantId: variant.id.replace('gid://shopify/ProductVariant/', ''),
                productName: productTitle,
                price: price || "0.00",
                currency: currency || "USD",
                source: source || "iframe",
                designerUrl: "", // Can be populated if available
                shopifyProductGid: product.id,
                shopifyVariantGid: variant.id
            };

            await prisma.model.upsert({
                where: { modelId: modelData.modelId },
                update: {
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
        return new Response(JSON.stringify({
            success: true,
            product: {
                ...product,
                variants: {
                    nodes: [variant]
                }
            },
            productId: product.id,
            handle: product.handle,
            variantId: variant.id,
            modelId: modelId || `model-${Date.now()}`,
            metadata: {
                source: source || "iframe",
                currency: currency || "USD",
                price: price || "0.00",
                createdAt: new Date().toISOString()
            }
        }), {
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
