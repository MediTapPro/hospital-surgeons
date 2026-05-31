import { MailService } from './mail.service';
import { NodemailerService } from './nodemailer.service';

export interface SendTemplateMailOptions {
  to: string | string[];
  from?: string;
  subject?: string;
  templateId: string;
  dynamicData: Record<string, any>;
  bcc?: string | string[];
}

/**
 * Unified Mail Service Factory
 * 
 * Switches between SendGrid and Nodemailer based on MAIL_SERVICE_TYPE environment variable.
 * 
 * Environment Variables:
 * - MAIL_SERVICE_TYPE: 'SENDGRID' | 'NODEMAILER' (default: 'SENDGRID')
 * 
 * For SendGrid:
 * - SENDGRID_API_KEY: Required
 * - SENDGRID_FROM_EMAIL: Optional
 * 
 * For Nodemailer:
 * - SMTP_HOST: Optional (default: smtp.gmail.com)
 * - SMTP_PORT: Optional (default: 587)
 * - SMTP_USER or SMTP_EMAIL: Required (unless using OAuth2)
 * - SMTP_PASSWORD: Required (unless using OAuth2)
 * - SMTP_SECURE: Optional (default: false)
 * - SMTP_FROM_EMAIL: Optional
 * 
 * For Nodemailer OAuth2 (Gmail):
 * - CLIENT_ID or SMTP_CLIENT_ID: Required for OAuth2
 * - CLIENT_SECREAT or CLIENT_SECRET or SMTP_CLIENT_SECRET: Required for OAuth2 (handles typo)
 * - REFRESH_TOKEN or SMTP_REFRESH_TOKEN: Required for OAuth2 (quotes are automatically stripped)
 * - SMTP_ACCESS_TOKEN: Optional (will be generated automatically)
 */
export class UnifiedMailService {
  private mailService: MailService | NodemailerService;
  private serviceType: 'sendgrid' | 'nodemailer';

  constructor() {
    const mailServiceType = (process.env.MAIL_SERVICE_TYPE || 'SENDGRID').toUpperCase().trim();
    
    if (mailServiceType === 'NODEMAILER') {
      this.serviceType = 'nodemailer';
      console.log('📧 [UNIFIED MAIL] Initializing Nodemailer service...');
      this.mailService = new NodemailerService();
      console.log('✅ [UNIFIED MAIL] Using Nodemailer for email sending');
    } else {
      this.serviceType = 'sendgrid';
      console.log('📧 [UNIFIED MAIL] Initializing SendGrid service...');
      this.mailService = new MailService();
      console.log('✅ [UNIFIED MAIL] Using SendGrid for email sending');
    }
  }

  /**
   * Send email using template
   * Works with both SendGrid and Nodemailer
   */
  async sendTemplateMail(options: SendTemplateMailOptions) {
    console.log(`📧 [UNIFIED MAIL] Sending email via ${this.serviceType.toUpperCase()}...`);
    return await this.mailService.sendTemplateMail(options);
  }

  /**
   * Get the current service type
   */
  getServiceType(): 'sendgrid' | 'nodemailer' {
    return this.serviceType;
  }

  /**
   * Verify connection (only available for Nodemailer)
   */
  async verifyConnection(): Promise<boolean> {
    if (this.serviceType === 'nodemailer' && 'verifyConnection' in this.mailService) {
      return await (this.mailService as NodemailerService).verifyConnection();
    }
    console.log('⚠️ [UNIFIED MAIL] Connection verification only available for Nodemailer');
    return false;
  }
}

/**
 * Factory function to get the appropriate mail service instance
 * This is a singleton pattern to avoid creating multiple instances
 */
let mailServiceInstance: UnifiedMailService | null = null;

export function getMailService(): UnifiedMailService {
  if (!mailServiceInstance) {
    mailServiceInstance = new UnifiedMailService();
  }
  return mailServiceInstance;
}

