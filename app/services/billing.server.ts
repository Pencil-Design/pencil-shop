import { authenticate } from "../shopify.server";

export interface PricingPlan {
  id: string;
  name: string;
  monthlyPrice: number;
  transactionFeeRate: number; // as decimal (0.018 for 1.8%)
  transactionFeeCap: number; // $5000
  features: string[];
  aiCredits: number;
}

export const PRICING_PLANS: Record<string, PricingPlan> = {
  pencilShop: {
    id: "pencil-shop",
    name: "Pencil Shop",
    monthlyPrice: 99,
    transactionFeeRate: 0.018, // 1.8%
    transactionFeeCap: 5000,
    features: [
      "1000 AI credits per month",
      "Publish designs directly to your website as products",
      "Made-to-order product catalog",
      "Live pricing and add-to-cart tools"
    ],
    aiCredits: 1000
  },
  pencilShopPlus: {
    id: "pencil-shop-plus",
    name: "Pencil Shop Plus",
    monthlyPrice: 199,
    transactionFeeRate: 0.008, // 0.8%
    transactionFeeCap: 5000,
    features: [
      "2000 AI credits per month",
      "Everything in Shop, plus:",
      "Ring builder app",
      "Online custom design app",
      "Detailed pricing calculator and controls",
      "Custom AI agent",
      "Dedicated account manager"
    ],
    aiCredits: 2000
  }
};

export interface SubscriptionData {
  planId: string;
  shopDomain: string;
  returnUrl: string;
}

export interface UsageRecordData {
  subscriptionLineItemId: string;
  description: string;
  amount: number;
  currencyCode: string;
}

export class BillingService {
  private admin: any;

  constructor(admin: any) {
    this.admin = admin;
  }

  /**
   * Create a subscription with both recurring and usage-based pricing
   */
  async createSubscription(data: SubscriptionData) {
    const plan = PRICING_PLANS[data.planId];
    if (!plan) {
      throw new Error(`Invalid plan ID: ${data.planId}`);
    }

    const mutation = `
      mutation AppSubscriptionCreate($name: String!, $lineItems: [AppSubscriptionLineItemInput!]!, $returnUrl: URL!, $test: Boolean!) {
        appSubscriptionCreate(name: $name, returnUrl: $returnUrl, lineItems: $lineItems, test: $test) {
          userErrors {
            field
            message
          }
          confirmationUrl
          appSubscription {
            id
            lineItems {
              id
              plan {
                pricingDetails {
                  __typename
                  ... on AppRecurringPricing {
                    price {
                      amount
                      currencyCode
                    }
                    interval
                  }
                  ... on AppUsagePricing {
                    terms
                    cappedAmount {
                      amount
                      currencyCode
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const variables = {
      name: `${plan.name} Subscription`,
      returnUrl: data.returnUrl,
      test: false, // Production mode - real billing
      lineItems: [
        {
          plan: {
            appRecurringPricingDetails: {
              price: {
                amount: plan.monthlyPrice,
                currencyCode: "USD"
              },
              interval: "EVERY_30_DAYS"
            }
          }
        },
        {
          plan: {
            appUsagePricingDetails: {
              terms: `${(plan.transactionFeeRate * 100).toFixed(1)}% transaction fee on sales, capped at $${plan.transactionFeeCap.toLocaleString()} per month`,
              cappedAmount: {
                amount: plan.transactionFeeCap,
                currencyCode: "USD"
              }
            }
          }
        }
      ]
    };

    const response = await this.admin.graphql(mutation, { variables });
    const result = await response.json();

    if (result.data?.appSubscriptionCreate?.userErrors?.length > 0) {
      throw new Error(`Subscription creation failed: ${result.data.appSubscriptionCreate.userErrors.map((e: any) => e.message).join(', ')}`);
    }

    return result.data.appSubscriptionCreate;
  }

  /**
   * Create a usage record for transaction fees
   */
  async createUsageRecord(data: UsageRecordData) {
    const mutation = `
      mutation AppUsageRecordCreate($subscriptionLineItemId: ID!, $description: String!, $price: MoneyInput!) {
        appUsageRecordCreate(
          subscriptionLineItemId: $subscriptionLineItemId
          description: $description
          price: $price
        ) {
          userErrors {
            field
            message
          }
          appUsageRecord {
            id
            price {
              amount
              currencyCode
            }
            description
            createdAt
          }
        }
      }
    `;

    const variables = {
      subscriptionLineItemId: data.subscriptionLineItemId,
      description: data.description,
      price: {
        amount: data.amount,
        currencyCode: data.currencyCode
      }
    };

    const response = await this.admin.graphql(mutation, { variables });
    const result = await response.json();

    if (result.data?.appUsageRecordCreate?.userErrors?.length > 0) {
      throw new Error(`Usage record creation failed: ${result.data.appUsageRecordCreate.userErrors.map((e: any) => e.message).join(', ')}`);
    }

    return result.data.appUsageRecordCreate;
  }

  /**
   * Get current subscription details
   */
  async getCurrentSubscription() {
    const query = `
      query CurrentAppInstallation {
        currentAppInstallation {
          activeSubscriptions {
            id
            name
            status
            createdAt
            currentPeriodEnd
            lineItems {
              id
              plan {
                pricingDetails {
                  __typename
                  ... on AppRecurringPricing {
                    price {
                      amount
                      currencyCode
                    }
                    interval
                  }
                  ... on AppUsagePricing {
                    terms
                    cappedAmount {
                      amount
                      currencyCode
                    }
                    balanceUsed {
                      amount
                      currencyCode
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    try {
      const response = await this.admin.graphql(query);
      const result = await response.json();

      // Check for GraphQL errors
      if (result.errors && result.errors.length > 0) {
        console.error("GraphQL errors in getCurrentSubscription:", result.errors);
        throw new Error(`GraphQL error: ${result.errors.map((e: any) => e.message).join(', ')}`);
      }

      // Check for user errors in the response
      if (result.data?.currentAppInstallation?.userErrors?.length > 0) {
        console.error("User errors in getCurrentSubscription:", result.data.currentAppInstallation.userErrors);
        throw new Error(`User error: ${result.data.currentAppInstallation.userErrors.map((e: any) => e.message).join(', ')}`);
      }

      return result.data?.currentAppInstallation?.activeSubscriptions?.[0] || null;
    } catch (error) {
      console.error("Error in getCurrentSubscription:", error);
      throw error;
    }
  }

  /**
   * Calculate transaction fee for a given order amount
   */
  calculateTransactionFee(orderAmount: number, planId: string): number {
    const plan = PRICING_PLANS[planId];
    if (!plan) {
      throw new Error(`Invalid plan ID: ${planId}`);
    }

    const fee = orderAmount * plan.transactionFeeRate;
    return Math.min(fee, plan.transactionFeeCap);
  }

  /**
   * Cancel an active subscription
   */
  async cancelSubscription(subscriptionId: string) {
    const mutation = `
      mutation AppSubscriptionCancel($id: ID!) {
        appSubscriptionCancel(id: $id) {
          userErrors {
            field
            message
          }
          appSubscription {
            id
            status
          }
        }
      }
    `;

    const variables = {
      id: subscriptionId
    };

    const response = await this.admin.graphql(mutation, { variables });
    const result = await response.json();

    if (result.data?.appSubscriptionCancel?.userErrors?.length > 0) {
      throw new Error(`Subscription cancellation failed: ${result.data.appSubscriptionCancel.userErrors.map((e: any) => e.message).join(', ')}`);
    }

    return result.data.appSubscriptionCancel;
  }

  /**
   * Get usage records for a subscription line item
   */
  async getUsageRecords(subscriptionLineItemId: string) {
    const query = `
      query GetUsageRecords($id: ID!) {
        node(id: $id) {
          ... on AppSubscriptionLineItem {
            usageRecords(first: 50) {
              edges {
                node {
                  id
                  description
                  price {
                    amount
                    currencyCode
                  }
                  createdAt
                }
              }
            }
          }
        }
      }
    `;

    const response = await this.admin.graphql(query, {
      variables: { id: subscriptionLineItemId }
    });
    const result = await response.json();

    return result.data?.node?.usageRecords?.edges?.map((edge: any) => edge.node) || [];
  }
}

/**
 * Factory function to create a billing service instance
 */
export async function createBillingService(request: Request): Promise<BillingService> {
  const { admin } = await authenticate.admin(request);
  return new BillingService(admin);
}
