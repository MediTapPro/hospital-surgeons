import { BasePaymentGateway } from "./base-payment-gateway";
import { RazorpayGateway } from "./gatways/razorpay";

export class PaymentManager {
  private gateways: Map<string, BasePaymentGateway> = new Map();
  private defaultGateway: string;

  constructor() {
    this.initializeGateways();
    this.defaultGateway = process.env.DEFAULT_PAYMENT_GATEWAY || 'razorpay';
  }

  private initializeGateways() {
    // // Stripe
    // if (process.env.STRIPE_SECRET_KEY) {
    //   this.gateways.set('stripe', new StripeGateway({
    //     name: 'stripe',
    //     enabled: true,
    //     apiKey: process.env.STRIPE_SECRET_KEY,
    //     webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    //   }));
    // }

    // Razorpay
    if (process.env.RAZORPAY_KEY_ID) {
      this.gateways.set('razorpay', new RazorpayGateway({
        name: 'razorpay',
        enabled: true,
        apiKey: process.env.RAZORPAY_KEY_ID,
        apiSecret: process.env.RAZORPAY_KEY_SECRET,
        webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
      }));
    }
  }

  getGateway(name?: string): BasePaymentGateway {
    const gatewayName = name || this.defaultGateway;
    const gateway = this.gateways.get(gatewayName);
    
    if (!gateway) {
      throw new Error(`Payment gateway ${gatewayName} not configured`);
    }
    
    return gateway;
  }

  getAvailableGateways(): string[] {
    return Array.from(this.gateways.keys());
  }
}

// Singleton instance
export const paymentManager = new PaymentManager();




