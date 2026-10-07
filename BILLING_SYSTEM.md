# Pencil Shop Billing System

This billing system implements Shopify's App Billing API to handle subscription plans with both recurring monthly fees and usage-based transaction fees.

## Pricing Plans

### Pencil Shop Plan
- **Monthly Fee**: $99/month
- **Transaction Fee**: 1.8% on sales
- **Transaction Fee Cap**: $5,000/month
- **AI Credits**: 1,000/month
- **Features**: Basic product publishing, made-to-order catalog, live pricing tools

### Pencil Shop Plus Plan
- **Monthly Fee**: $199/month
- **Transaction Fee**: 0.8% on sales
- **Transaction Fee Cap**: $5,000/month
- **AI Credits**: 2,000/month
- **Features**: Everything in Shop, plus ring builder, custom design app, detailed pricing controls, custom AI agent, dedicated account manager

## Architecture

### Core Components

1. **BillingService** (`app/services/billing.server.ts`)
   - Handles subscription creation and management
   - Creates usage records for transaction fees
   - Manages subscription status and billing

2. **Billing Utilities** (`app/utils/billing.ts`)
   - Transaction fee calculations
   - Currency formatting
   - Plan comparison utilities

3. **API Routes**
   - `/app/billing` - Plan selection and subscription management
   - `/api/transaction-fee` - Create transaction fee usage records
   - `/api/process-order-fee` - Process order fees (example implementation)
   - `/webhooks/billing` - Handle billing webhooks

### GraphQL Mutations Used

#### Create Subscription
```graphql
mutation AppSubscriptionCreate($name: String!, $lineItems: [AppSubscriptionLineItemInput!]!, $returnUrl: URL!) {
  appSubscriptionCreate(name: $name, returnUrl: $returnUrl, lineItems: $lineItems) {
    userErrors { field message }
    confirmationUrl
    appSubscription {
      id
      lineItems {
        id
        plan {
          pricingDetails {
            __typename
            ... on AppRecurringPricing {
              price { amount currencyCode }
              interval
            }
            ... on AppUsagePricing {
              terms
              cappedAmount { amount currencyCode }
            }
          }
        }
      }
    }
  }
}
```

#### Create Usage Record
```graphql
mutation AppUsageRecordCreate($subscriptionLineItemId: ID!, $description: String!, $price: MoneyInput!) {
  appUsageRecordCreate(
    subscriptionLineItemId: $subscriptionLineItemId
    description: $description
    price: $price
  ) {
    userErrors { field message }
    appUsageRecord {
      id
      price { amount currencyCode }
      description
      createdAt
    }
  }
}
```

## Usage Examples

### Creating a Subscription

```typescript
import { createBillingService } from "~/services/billing.server";

const billingService = await createBillingService(request);

const result = await billingService.createSubscription({
  planId: "pencilShop", // or "pencilShopPlus"
  shopDomain: "example.myshopify.com",
  returnUrl: "https://yourapp.com/billing/success"
});

// Redirect user to confirmationUrl for payment approval
window.location.href = result.confirmationUrl;
```

### Processing Transaction Fees

```typescript
import { calculateTransactionFee, formatCurrency } from "~/utils/billing";

// Calculate fee for an order
const orderAmount = 150.00;
const planId = "pencilShop";

const feeCalculation = calculateTransactionFee(orderAmount, planId);
console.log(`Fee: ${formatCurrency(feeCalculation.finalFee)}`);

// Create usage record
const billingService = await createBillingService(request);
await billingService.createUsageRecord({
  subscriptionLineItemId: "gid://shopify/AppSubscriptionLineItem/123456?v=1&index=1",
  description: `Transaction fee for order #${orderId} - ${formatCurrency(orderAmount)}`,
  amount: feeCalculation.finalFee,
  currencyCode: "USD"
});
```

### Monitoring Usage

```typescript
// Get current subscription
const subscription = await billingService.getCurrentSubscription();

// Get usage records
const usageRecords = await billingService.getUsageRecords(
  subscription.lineItems[1].id // Usage pricing line item
);

// Check if approaching cap
const totalUsage = usageRecords.reduce((sum, record) => 
  sum + parseFloat(record.price.amount), 0
);
const capAmount = parseFloat(subscription.lineItems[1].plan.pricingDetails.cappedAmount.amount);
const isApproachingCap = totalUsage > (capAmount * 0.9);
```

## Webhook Handling

The system handles these webhook topics:

- `APP_SUBSCRIPTIONS_UPDATE` - Subscription status changes
- `APP_SUBSCRIPTIONS_APPROACHING_CAPPED_AMOUNT` - Usage approaching cap
- `APP_SUBSCRIPTIONS_CAPPED_AMOUNT_UPDATED` - Cap amount changes

## Transaction Fee Calculation

Transaction fees are calculated as:
```
fee = min(orderAmount * feeRate, monthlyCap)
```

Where:
- `feeRate` is 0.018 (1.8%) for Pencil Shop or 0.008 (0.8%) for Pencil Shop Plus
- `monthlyCap` is $5,000 for both plans

## Error Handling

The system includes comprehensive error handling for:
- Invalid plan IDs
- Missing subscription line items
- Usage exceeding capped amounts
- GraphQL API errors
- Webhook processing failures

## Security Considerations

- All billing operations require authenticated Shopify sessions
- Transaction fee calculations are validated server-side
- Usage records include idempotency keys to prevent duplicate charges
- Webhook signatures should be verified in production

## Testing

Use Shopify's test mode for development:
```typescript
const result = await billingService.createSubscription({
  planId: "pencilShop",
  shopDomain: "test-shop.myshopify.com",
  returnUrl: "https://yourapp.com/billing/success"
}, { test: true }); // Enable test mode
```

## Production Deployment

1. Ensure your app has the `applications_billing` scope
2. Set up webhook endpoints for billing events
3. Configure proper error monitoring and logging
4. Test subscription flows thoroughly
5. Monitor usage patterns and cap limits
