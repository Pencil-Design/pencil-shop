interface PencilAPIConfig {
  baseUrl: string;
  apiKey: string;
}

interface ManageUserRequest {
  email: string;
  firstName?: string;
  lastName?: string;
  planType?: 'BASIC' | 'PROFESSIONAL' | 'CUSTOM_DESIGN_STUDIO' | 'PENCIL_SHOP' | 'PENCIL_SHOP_PLUS';
  stripePriceId?: string;
  stripeSubscriptionId?: string;
  allowedModels?: number;
  price?: number;
  periodStart?: string;
  expirationDate?: string;
  cancelPlan?: boolean;
}

interface ManageUserResponse {
  success: boolean;
  data?: {
    userId: string;
    email: string;
    planType?: string;
    partnerPath?: string;
    message: string;
  };
  error?: string;
  message?: string;
}

export class PencilAPIService {
  private config: PencilAPIConfig;

  constructor(config: PencilAPIConfig) {
    this.config = config;
  }

  /**
   * Create or update a user in the Pencil API
   */
  async manageUser(request: ManageUserRequest): Promise<ManageUserResponse> {
    try {
      const response = await fetch(`${this.config.baseUrl}/external/user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
        },
        body: JSON.stringify(request),
      });

      const responseText = await response.text();

      if (!response.ok) {
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch {
          errorData = { message: responseText || `HTTP ${response.status}: ${response.statusText}` };
        }
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return JSON.parse(responseText);
    } catch (error) {
      console.error('Error calling Pencil API:', error);
      throw error;
    }
  }

  /**
   * Map Shopify plan ID to Pencil API plan type
   */
  private mapPlanIdToPencilType(planId: string): ManageUserRequest['planType'] {
    switch (planId) {
      case 'pencil-shop':
      case 'pencilShop':
        return 'PENCIL_SHOP';
      case 'pencil-shop-plus':
      case 'pencilShopPlus':
        return 'PENCIL_SHOP_PLUS';
      default:
        throw new Error(`Unknown plan ID: ${planId}`);
    }
  }

  /**
   * Handle subscription creation/update from Shopify
   */
  async handleSubscriptionActivation({
    email,
    firstName,
    lastName,
    planId,
    subscriptionId,
    price,
    periodStart,
    periodEnd,
  }: {
    email: string;
    firstName?: string;
    lastName?: string;
    planId: string;
    subscriptionId?: string;
    price?: number;
    periodStart?: Date;
    periodEnd?: Date;
  }): Promise<ManageUserResponse> {
    const planType = this.mapPlanIdToPencilType(planId);

    const request: ManageUserRequest = {
      email,
      firstName,
      lastName,
      planType,
      stripeSubscriptionId: subscriptionId,
      price,
      periodStart: periodStart?.toISOString(),
      expirationDate: periodEnd?.toISOString(),
    };

    return this.manageUser(request);
  }

  /**
   * Handle subscription cancellation
   */
  async handleSubscriptionCancellation({
    email,
    firstName,
    lastName,
  }: {
    email: string;
    firstName?: string;
    lastName?: string;
  }): Promise<ManageUserResponse> {
    const request: ManageUserRequest = {
      email,
      firstName,
      lastName,
      cancelPlan: true,
    };

    return this.manageUser(request);
  }

  /**
   * Delete a user from the Pencil API (for GDPR compliance)
   */
  async deleteUser(email: string): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await fetch(`${this.config.baseUrl}/external/user`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
        },
        body: JSON.stringify({ email }),
      });

      const responseText = await response.text();

      if (!response.ok) {
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch {
          errorData = { message: responseText || `HTTP ${response.status}: ${response.statusText}` };
        }
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = responseText ? JSON.parse(responseText) : { success: true };
      return result;
    } catch (error) {
      console.error('Error deleting user from Pencil API:', error);
      throw error;
    }
  }

  /**
   * Get user data from the Pencil API (for GDPR data requests)
   */
  async getUserData(email: string): Promise<any> {
    try {
      const response = await fetch(`${this.config.baseUrl}/external/user?email=${encodeURIComponent(email)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
        },
      });

      const responseText = await response.text();

      if (!response.ok) {
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch {
          errorData = { message: responseText || `HTTP ${response.status}: ${response.statusText}` };
        }
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return responseText ? JSON.parse(responseText) : null;
    } catch (error) {
      console.error('Error fetching user data from Pencil API:', error);
      throw error;
    }
  }

  /**
   * Test the connection to Pencil API
   */
  async healthCheck(): Promise<{ status: string; timestamp: string; version: string }> {
    try {
      const response = await fetch(`${this.config.baseUrl}/external/health`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Pencil API health check failed:', error);
      throw error;
    }
  }
}

/**
 * Factory function to create PencilAPIService with environment configuration
 */
export function createPencilAPIService(): PencilAPIService {
  const baseUrl = process.env.PENCIL_API_BASE_URL;
  const apiKey = process.env.PENCIL_API_SECRET_KEY;

  if (!baseUrl) {
    throw new Error('PENCIL_API_BASE_URL environment variable is required');
  }

  if (!apiKey) {
    throw new Error('PENCIL_API_SECRET_KEY environment variable is required');
  }

  return new PencilAPIService({
    baseUrl,
    apiKey,
  });
}