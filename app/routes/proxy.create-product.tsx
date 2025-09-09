import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function action({ request }: ActionFunctionArgs) {
  try {
    const { admin } = await authenticate.public.appProxy(request);

    if (!admin) {
      return json({ error: "Unauthenticated" }, { status: 401 });
    }

    const payload = await request.json();

    const titleForHandle = (payload.title || "Custom Design").toLowerCase();
    const handleBase = titleForHandle
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const uniqueSuffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const uniqueHandle = `${handleBase}-${uniqueSuffix}`.slice(0, 255);

    const createProduct = await admin.graphql(
      `
      mutation createProduct($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product {
            id
            title
            handle
            variants(first: 1) { edges { node { id } } }
          }
          userErrors { field message }
        }
      }
    `,
      {
        variables: {
          product: {
            title: payload.title ?
              (payload.modelId ? `${payload.title} (Model: ${payload.modelId})` : payload.title) :
              (payload.modelId ? `Custom Design (Model: ${payload.modelId})` : "Custom Design"),
            descriptionHtml: `<p>Your custom design${payload.modelId ? `<br><strong>Reference design ID:</strong> ${payload.modelId}` : ''}</p>`,
            handle: uniqueHandle,
            status: "ACTIVE",
            productType: "Custom Design",
            vendor: "Pencil Designer",
          },
        },
      }
    );

    const createData = await createProduct.json();
    const productGid = createData?.data?.productCreate?.product?.id;
    const productHandleFromApi = createData?.data?.productCreate?.product?.handle;
    const firstVariantGid = createData?.data?.productCreate?.product?.variants?.edges?.[0]?.node?.id;
    if (!productGid) {
      return json({ error: "productCreate failed", details: createData }, { status: 400 });
    }

    let effectiveVariantGid: string | null = firstVariantGid ?? null;
    if (firstVariantGid) {
      const updateRes = await admin.graphql(
        `
        mutation updateVariants($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkUpdate(productId: $productId, variants: $variants) {
            productVariants { id price }
            userErrors { field message }
          }
        }
      `,
        {
          variables: {
            productId: productGid,
            variants: [
              {
                id: firstVariantGid,
                price: parseFloat(payload.price),
                inventoryItem: {
                  sku: payload.sku || (payload.modelId ? `MODEL-${payload.modelId}` : `CUSTOM-${Date.now()}`)
                },
              },
            ],
          },
        }
      );
      const updateData = await updateRes.json();
      const updatedVariantGid = updateData?.data?.productVariantsBulkUpdate?.productVariants?.[0]?.id;
      if (!updatedVariantGid) {
        return json({ error: "productVariantsBulkUpdate failed", details: updateData }, { status: 400 });
      }
      effectiveVariantGid = updatedVariantGid;
    }

    const productIdString = productGid.split("/").pop();
    const variantIdString = effectiveVariantGid ? effectiveVariantGid.split("/").pop() : undefined;

    try {
      const publicationsRes = await admin.graphql(`
        query getPublications {
          publications(first: 10) {
            edges {
              node {
                id
                name
              }
            }
          }
        }
      `);

      const publicationsData = await publicationsRes.json();
      const onlineStorePublication = publicationsData?.data?.publications?.edges?.find(
        (edge: any) => edge.node.name === "Online Store"
      )?.node;

      if (!onlineStorePublication) {
        return json({
          error: "Online Store publication not found",
          productId: productIdString,
          variantId: variantIdString,
          handle: productHandleFromApi || uniqueHandle
        }, { status: 400 });
      }

      const publishRes = await admin.graphql(`
        mutation publishProduct($id: ID!, $input: [PublicationInput!]!) {
          publishablePublish(id: $id, input: $input) {
            publishable {
              ... on Product {
                id
                title
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
          id: productGid,
          input: [{ publicationId: onlineStorePublication.id }]
        }
      });

      const publishData = await publishRes.json();
      if (publishData?.data?.publishablePublish?.userErrors?.length > 0) {
        return json({
          error: "Product created but not published to Online Store",
          details: publishData.data.publishablePublish.userErrors,
          productId: productIdString,
          variantId: variantIdString,
          handle: productHandleFromApi || uniqueHandle
        }, { status: 400 });
      }
    } catch (e) {
      return json({
        error: "Product created but publish failed",
        details: (e as Error).message,
        productId: productIdString,
        variantId: variantIdString,
        handle: productHandleFromApi || uniqueHandle
      }, { status: 400 });
    }

    if (payload.modelId) {
      try {
        await prisma.model.upsert({
          where: { modelId: payload.modelId },
          update: {
            productId: productIdString!,
            variantId: variantIdString!,
            productName: payload.title || "Custom Design",
            price: payload.price,
            currency: payload.currency || "USD",
            source: payload.source || "shop-page",
            designerUrl: `${process.env.DESIGNER_BASE_URL || 'https://designer.example.com'}/shop/${payload.modelId}`,
            shopifyProductGid: productGid,
            shopifyVariantGid: effectiveVariantGid ?? undefined,
          },
          create: {
            modelId: payload.modelId,
            productId: productIdString!,
            variantId: variantIdString!,
            productName: payload.title || "Custom Design",
            price: payload.price,
            currency: payload.currency || "USD",
            source: payload.source || "shop-page",
            designerUrl: `${process.env.DESIGNER_BASE_URL || 'https://designer.example.com'}/shop/${payload.modelId}`,
            shopifyProductGid: productGid,
            shopifyVariantGid: effectiveVariantGid ?? "",
          }
        });

      } catch (error) {
      }
    }

    if (payload.modelId) {
      try {
        const metafieldResponse = await admin.graphql(
          `#graphql
            mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
              metafieldsSet(metafields: $metafields) {
                metafields {
                  id
                  key
                  value
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `,
          {
            variables: {
              metafields: [
                {
                  ownerId: productGid,
                  namespace: "custom_design",
                  key: "model_id",
                  value: payload.modelId,
                  type: "single_line_text_field"
                }
              ]
            }
          }
        );

        await metafieldResponse.json();
      } catch (error) {
      }
    }

    try {
      const verifyRes = await admin.graphql(`
        query verifyProduct($id: ID!) {
          product(id: $id) {
            id
            title
            publishedAt
            onlineStoreUrl
            publishedOnPublication(publicationId: "gid://shopify/Publication/1")
          }
        }
      `, {
        variables: { id: productGid }
      });

      const verifyData = await verifyRes.json();
      const product = verifyData?.data?.product;

      if (product?.publishedOnPublication !== true) {
        return json({
          error: "Product not published to Online Store",
          productId: productIdString,
          variantId: variantIdString,
          handle: productHandleFromApi || uniqueHandle
        }, { status: 400 });
      }

    } catch (e) {
    }

    const adminProductUrl = `https://admin.shopify.com/store/${process.env.SHOP?.replace('.myshopify.com', '')}/products/${productIdString}`;
    const designerUrl = payload.modelId ?
      `${process.env.DESIGNER_BASE_URL || 'https://designer.example.com'}/shop/${payload.modelId}` :
      null;

    return json({
      variantId: variantIdString || undefined,
      productId: productIdString,
      handle: productHandleFromApi || uniqueHandle,
      adminUrl: adminProductUrl,
      designerUrl: designerUrl,
      modelId: payload.modelId
    });
  } catch (error) {
    return json({ error: "Failed to create product", details: (error as Error).message }, { status: 500 });
  }
}
