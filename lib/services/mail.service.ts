import sgMail from '@sendgrid/mail';

export interface SendTemplateMailOptions {
  to: string | string[];
  from?: string;
  subject?: string;
  templateId: string;
  dynamicData: Record<string, any>; // dynamic fields to replace placeholders
  bcc?: string | string[];
}

export class MailService {
  constructor() {
    const apiKey = process.env.SENDGRID_API_KEY;
    console.log('SendGrid API Key:', apiKey ? 'Set' : 'Not set');
    if (!apiKey) {
      throw new Error('SENDGRID_API_KEY is not defined in .env');
    }
    console.log('SendGrid initialized successfully');
    sgMail.setApiKey(apiKey);
  }

  async sendTemplateMail(options: SendTemplateMailOptions) {
    console.log('📬 [MAIL SERVICE] sendTemplateMail called');
    console.log('📬 [MAIL SERVICE] Email options:', {
      to: options.to,
      from: options.from || 'no-reply@yourapp.com',
      subject: options.subject,
      templateId: options.templateId,
      hasDynamicData: !!options.dynamicData,
      dynamicDataKeys: options.dynamicData ? Object.keys(options.dynamicData) : [],
    });

    // Validate required fields
    if (!options.to) {
      const error = new Error('Email "to" field is required');
      console.error('❌ [MAIL SERVICE] Validation error:', error.message);
      throw error;
    }

    if (!options.templateId) {
      const error = new Error('Template ID is required');
      console.error('❌ [MAIL SERVICE] Validation error:', error.message);
      throw error;
    }

    const fromEmail = options.from || process.env.SENDGRID_FROM_EMAIL || 'no-reply@yourapp.com';
    console.log('📬 [MAIL SERVICE] Using from email:', fromEmail);

    const msg = {
      to: options.to,
      from: fromEmail, // verified sender
      subject: options.subject, // optional, can override template's subject
      templateId: options.templateId, // SendGrid dynamic template ID
      dynamicTemplateData: options.dynamicData, // fill placeholders
      bcc: options.bcc,
    };

    try {
      console.log('📬 [MAIL SERVICE] Sending email via SendGrid...');
      console.log('📬 [MAIL SERVICE] SendGrid message:', {
        to: msg.to,
        from: msg.from,
        subject: msg.subject,
        templateId: msg.templateId,
        hasDynamicData: !!msg.dynamicTemplateData,
        dynamicDataKeys: msg.dynamicTemplateData ? Object.keys(msg.dynamicTemplateData) : [],
      });
      
      console.log('📬 [MAIL SERVICE] Checking SendGrid API key...');
      const apiKey = process.env.SENDGRID_API_KEY;
      if (!apiKey) {
        throw new Error('SENDGRID_API_KEY is not set in environment variables');
      }
      console.log('📬 [MAIL SERVICE] SendGrid API key is set (length:', apiKey.length, ')');
      
      const result = await sgMail.send(msg);
      console.log('✅ [MAIL SERVICE] Email sent successfully via SendGrid!');
      console.log('✅ [MAIL SERVICE] SendGrid response:', JSON.stringify(result, null, 2));
      
      if (result && Array.isArray(result) && result.length > 0) {
        console.log('✅ [MAIL SERVICE] Response details:', {
          statusCode: result[0]?.statusCode,
          headers: result[0]?.headers,
        });
      }
      
      return result;
    } catch (error: any) {
      console.error('❌ [MAIL SERVICE] Error sending template email:', error);
      console.error('❌ [MAIL SERVICE] Error type:', error?.constructor?.name);
      console.error('❌ [MAIL SERVICE] Error message:', error?.message);
      
      if (error?.response) {
        console.error('❌ [MAIL SERVICE] SendGrid API Error Response:', {
          statusCode: error.response.statusCode,
          statusMessage: error.response.statusMessage,
          body: error.response.body,
          headers: error.response.headers,
        });
        
        if (error.response.body) {
          console.error('❌ [MAIL SERVICE] Error body (JSON):', JSON.stringify(error.response.body, null, 2));
        }
      }
      
      if (error?.stack) {
        console.error('❌ [MAIL SERVICE] Error stack:', error.stack);
      }
      
      throw error;
    }
  }
}

