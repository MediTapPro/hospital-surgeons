import Razorpay from "razorpay";
import { BasePaymentGateway } from "../base-payment-gateway";
import { CheckoutSession, CreateCheckoutParams, PaymentGatewayConfig, WebhookEvent } from "../types";
import crypto from "crypto";

export class RazorpayGateway extends BasePaymentGateway {
    private razorpay: Razorpay;
    constructor(config: PaymentGatewayConfig) {
        super(config);
        this.razorpay = new Razorpay({
            key_id: config.apiKey,
            key_secret: config.apiSecret || "",
        });
    }

    async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSession> {
        const currency = params.currency.toUpperCase();
        // Amount is in rupees from database, convert to paise for Razorpay
        const amountInRupees = params.amount;
        const amountInPaise = Math.round(amountInRupees * 100); // Convert rupees to paise
        const amount = Math.max(amountInPaise, 100); // Razorpay minimum amount is 100 paise (1 INR)
        
        // Use DB order ID as receipt for easy debugging and linking
        const receipt = params.metadata?.orderId || `receipt_${Date.now()}`;
        
        // Create Razorpay order
        // Convert rupees to paise (Razorpay expects amount in paise)
        const order = await this.razorpay.orders.create({
            amount: amount, // Amount in paise (converted from rupees)
            currency: currency,
            receipt: receipt, // Use DB order ID as receipt
            notes: params.metadata || {},
        });

        // Include all necessary data for checkout (for mobile apps and web)
        const planId = params.metadata?.planId;
        const userRole = params.metadata?.userRole;
        const email = params.metadata?.email;
        
        // Return checkout data as object (frontend will construct URL from this)
        const checkoutData = {
            orderId: order.id,
            planId: planId,
            userRole: userRole,
            email: email,
        };

        return {
            id: order.id,
            gateway: 'razorpay',
            checkoutData: checkoutData,
        };
    }

    async verifyWebhook(payload: any, signature: string): Promise<WebhookEvent> {
        if (!this.config.webhookSecret) {
            throw new Error('Webhook secret not configured');
        }

        // Verify webhook signature
        const expectedSignature = crypto
            .createHmac('sha256', this.config.webhookSecret)
            .update(JSON.stringify(payload))
            .digest('hex');

        if (expectedSignature !== signature) {
            throw new Error('Invalid webhook signature');
        }

        return {
            type: payload.event,
            data: payload.payload,
            gateway: 'razorpay',
        };
    }

    async createCustomer(email: string, name?: string): Promise<string> {
        const customer = await this.razorpay.customers.create({
            email,
            name: name || email,
        });

        return customer.id;
    }

    async cancelSubscription(subscriptionId: string): Promise<void> {
        await this.razorpay.subscriptions.cancel(subscriptionId);
    }

    async getSubscription(subscriptionId: string): Promise<any> {
        const subscription = await this.razorpay.subscriptions.fetch(subscriptionId);
        return subscription;
    }

    /**
     * Fetch payment details from Razorpay
     * Used for payment verification
     */
    async fetchPayment(paymentId: string): Promise<any> {
        const payment = await this.razorpay.payments.fetch(paymentId);
        return payment;
    }

    /**
     * Get the Razorpay instance (for direct access if needed)
     */
    getRazorpayInstance(): Razorpay {
        return this.razorpay;
    }
}