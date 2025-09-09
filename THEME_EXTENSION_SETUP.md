# Theme App Extension Setup - Pencil Shop

This document outlines the Theme App Extension setup for the Pencil Shop Shopify app, allowing customers to design custom pencils directly in the storefront.

## Components Created

### 1. Theme App Extension (`extensions/pencil-extension/`)

- **Extension Type**: Theme App Extension
- **Location**: `extensions/pencil-extension/blocks/designer.liquid`
- **Purpose**: Embeds a 3D pencil designer iframe in the storefront

#### Features:
- Configurable iframe source URL
- Adjustable height setting
- PostMessage communication for cart operations
- Support for both existing variants and dynamic product creation

### 2. App Proxy Route (`app/routes/proxy.create-product.tsx`)

- **Endpoint**: `/apps/designer/create-product`
- **Purpose**: Creates products and variants dynamically via Shopify Admin API
- **Authentication**: Uses `authenticate.public.appProxy()` for secure proxy requests

## Setup Instructions

### 1. Configure App Proxy in Partner Dashboard

In your Shopify Partner Dashboard, configure the App Proxy:

- **Subpath prefix**: `apps`
- **Subpath**: `designer`
- **Proxy URL**: `https://<your-app-host>/proxy/` (note the trailing slash)

This maps storefront requests from `/apps/designer/*` to your app's `/proxy/*` routes.

### 2. Deploy the Extension

```bash
# Start development server
shopify app dev

# In the theme editor, add the "Pencil Designer" block to any section
```

### 3. Update Configuration

Edit `extensions/pencil-extension/blocks/designer.liquid`:

1. Update the `ALLOWED` origins array with your actual designer domain:
   ```javascript
   const ALLOWED = ["https://your-actual-designer-domain.com"];
   ```

2. Update the default iframe source in the schema:
   ```json
   "default": "https://your-actual-designer-domain.com/embed"
   ```

## Usage

### For Existing Variants

Your iframe content can add existing variants to cart:

```javascript
window.parent.postMessage({
  type: "CART:ADD_VARIANT",
  payload: {
    variantId: 1234567890,            // numeric variant ID
    quantity: 1,
    properties: { 
      "Pencil Type": "Mechanical", 
      "Lead Size": "0.5mm",
      "Color": "Black"
    }
  }
}, "https://store-domain.myshopify.com");
```

### For Dynamic Product Creation

Your iframe content can create new products on-the-fly:

```javascript
window.parent.postMessage({
  type: "PRODUCT:CREATE_AND_ADD",
  payload: {
    title: "Custom Mechanical Pencil",
    price: "19.99",
    sku: "CUSTOM-MECH-001",
    options: ["Type", "Lead Size", "Color"],
    variantOptions: ["Mechanical", "0.5mm", "Black"],
    quantity: 1,
    properties: { 
      "Custom Engraving": "John's Pencil",
      "Design Type": "Custom"
    }
  }
}, "https://store-domain.myshopify.com");
```

## Sample Designer

A sample designer interface is available at `/public/sample-designer.html` demonstrating:

- Pencil customization options (type, lead size, color, engraving)
- Both existing variant and custom product workflows
- Proper postMessage communication

## Security Notes

1. **Origin Validation**: Always validate `event.origin` in the postMessage listener
2. **Target Origin**: Use specific domains instead of `"*"` in production
3. **App Proxy**: The proxy route automatically validates Shopify's HMAC signature

## File Structure

```
pencil-shop/
├── extensions/pencil-extension/
│   ├── blocks/designer.liquid          # Main app block
│   └── shopify.extension.toml          # Extension config
├── app/routes/
│   └── proxy.create-product.tsx        # App proxy endpoint
└── public/
    └── sample-designer.html            # Sample iframe content
```

## Next Steps

1. Replace `https://pencil-designer.example.com` with your actual designer domain
2. Configure the App Proxy in your Partner Dashboard
3. Deploy your designer interface at the configured domain
4. Test the integration using `shopify app dev`
5. Add the "Pencil Designer" block to your theme sections in the theme editor
