# Pencil API Integration

This document describes how the Shopify app integrates with the Pencil API to manage user subscriptions and partner accounts.

## Overview

When merchants subscribe to Pencil Shop or Pencil Shop Plus plans through this Shopify app, the integration automatically:

1. **Creates/updates users** in the Pencil system
2. **Assigns appropriate plans** (PENCIL_SHOP or PENCIL_SHOP_PLUS)
3. **Creates partner accounts** with unique shop paths for shop plans
4. **Handles cancellations** by updating plan status and removing partners

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Pencil API Integration
PENCIL_API_BASE_URL=http://localhost:5000  # Change to production URL
PENCIL_API_SECRET_KEY=your-secret-key-here  # Must match pencil-api EXTERNAL_API_SECRET_KEY
```

### Setting Up Local Development

1. **Start Pencil API** (must be running first):
   ```bash
   cd ~/code/pencil-api
   npm run dev  # Runs on port 5000
   ```

2. **Set environment variables** in pencil-shop:
   ```bash
   # In ~/code/pencil-shop/.env
   PENCIL_API_BASE_URL=http://localhost:5000
   PENCIL_API_SECRET_KEY=test-secret-key-12345  # Same as pencil-api
   ```

3. **Start Shopify app**:
   ```bash
   cd ~/code/pencil-shop
   npm run dev
   ```

## Integration Points

### 1. Subscription Creation
**File:** `app/routes/app.billing.tsx`

When a merchant subscribes to a plan:
- Creates user in Pencil API with merchant's email
- Assigns PENCIL_SHOP or PENCIL_SHOP_PLUS plan
- Auto-creates partner with unique shop path (for shop plans)

### 2. Subscription Updates
**File:** `app/routes/webhooks.billing.ts`

Handles Shopify webhook events:
- `APP_SUBSCRIPTIONS_UPDATE`: Updates plan status in Pencil API
- Activates/deactivates users based on subscription status

### 3. Subscription Cancellation
**File:** `app/routes/app.billing.tsx`

When a merchant cancels:
- Sets plan status to CANCELED in Pencil API
- Removes partner account (shop becomes inactive)
- Preserves user and plan history

## API Service

### PencilAPIService Class
**File:** `app/services/pencil-api.server.ts`

Provides methods for:
- `handleSubscriptionActivation()` - Create/update active subscription
- `handleSubscriptionCancellation()` - Cancel subscription
- `healthCheck()` - Test API connectivity

### Usage Example

```typescript
import { createPencilAPIService } from '~/services/pencil-api.server';

const pencilAPI = createPencilAPIService();

// Activate subscription
await pencilAPI.handleSubscriptionActivation({
  email: 'merchant@example.com',
  firstName: 'John',
  lastName: 'Doe', 
  planId: 'pencilShop',
  subscriptionId: 'sub_123',
  price: 99
});

// Cancel subscription
await pencilAPI.handleSubscriptionCancellation({
  email: 'merchant@example.com',
  firstName: 'John',
  lastName: 'Doe'
});
```

## Testing

### Health Check Page
Visit `/app/health` in your Shopify app to test:
- ✅ Pencil API connectivity
- ✅ Environment configuration
- ✅ Service status

### Manual Testing Flow

1. **Subscribe to a plan** in the Shopify app
2. **Check Pencil API logs** for user creation
3. **Verify in database** that user and partner were created
4. **Cancel subscription** in the app
5. **Verify** plan is canceled and partner removed

## Error Handling

The integration is designed to be **non-blocking**:
- ❌ Pencil API errors **don't fail** Shopify subscription operations  
- 📝 All errors are logged for monitoring
- 🔄 Webhook retries handle temporary failures

## Data Flow

```
Shopify App Subscription
         ↓
  PencilAPIService
         ↓ 
   Pencil API External Endpoint
         ↓
  User + Plan + Partner Creation
```

## Plan Mapping

| Shopify Plan ID | Pencil API Plan Type | Partner Created |
|-----------------|---------------------|-----------------|
| `pencilShop` | `PENCIL_SHOP` | ✅ Yes |
| `pencilShopPlus` | `PENCIL_SHOP_PLUS` | ✅ Yes |

## Partner Shop URLs

When users subscribe to shop plans, they get unique shop URLs:
- Pattern: `https://yourdomain.com/partner/{random-8-chars}`
- Example: `https://pencildesign.co/partner/abc12345`

## Troubleshooting

### Common Issues

1. **"Connection failed" error**:
   - Check if pencil-api is running
   - Verify `PENCIL_API_BASE_URL` is correct

2. **"Invalid API key" error**:
   - Ensure `PENCIL_API_SECRET_KEY` matches between apps

3. **"User creation failed" error**:
   - Check pencil-api logs for detailed error
   - Verify database connection in pencil-api

### Debug Logs

Enable detailed logging in both applications:
- Shopify app logs subscription events
- Pencil API logs user management operations

## Production Deployment

1. **Update environment variables**:
   ```bash
   PENCIL_API_BASE_URL=https://api.pencildesign.co
   PENCIL_API_SECRET_KEY=production-secret-key
   ```

2. **Ensure API key security**:
   - Use environment variables only
   - Never commit secrets to version control
   - Rotate keys regularly

3. **Monitor integration**:
   - Set up alerts for API failures
   - Monitor webhook success rates
   - Track user creation metrics