import { CheckoutSession, CreateCheckoutParams, PaymentGatewayConfig, WebhookEvent } from "./types";

export abstract class BasePaymentGateway {
    protected config: PaymentGatewayConfig;

    constructor(config: PaymentGatewayConfig) {
        this.config = config;
    }

    abstract createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSession>;
    abstract verifyWebhook(payload: any, signature: string): Promise<WebhookEvent>;
    abstract createCustomer(email: string, name?: string): Promise<string>;
    abstract cancelSubscription(subscriptionId: string): Promise<void>;
    abstract getSubscription(subscriptionId: string): Promise<any>;
  
}