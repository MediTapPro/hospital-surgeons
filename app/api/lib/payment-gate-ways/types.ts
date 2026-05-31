export interface PaymentGatewayConfig {
    name: string;
    enabled: boolean;
    apiKey: string;
    webhookSecret?: string;
    apiSecret?: string;
  }
  
  export interface CreateCheckoutParams {
    amount: number;
    currency: string;
    customerId?: string;
    metadata?: Record<string, any>;
    successUrl: string;
    cancelUrl: string;
    planId?: string;
  }
  
  export interface CheckoutSession {
    id: string;
    gateway: string;
    checkoutData: {
      orderId: string;
      planId?: string;
      userRole?: string;
      email?: string;
    };
  }
  
  export interface WebhookEvent {
    type: string;
    data: any;
    gateway: string;
  }
  
  