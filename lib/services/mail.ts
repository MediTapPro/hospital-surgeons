import sgMail from '@sendgrid/mail';

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.warn('SENDGRID_API_KEY is not defined in .env');
}

export interface SendTemplateMailOptions {
  to: string | string[];
  from?: string;
  subject?: string;
  templateId: string;
  dynamicData: Record<string, any>;
  bcc?: string | string[];
}

export async function sendTemplateMail(options: SendTemplateMailOptions) {
  if (!process.env.SENDGRID_API_KEY) {
    throw new Error('SENDGRID_API_KEY is not defined in .env');
  }

  const msg = {
    to: options.to,
    from: options.from || 'no-reply@yourapp.com',
    subject: options.subject,
    templateId: options.templateId,
    dynamicTemplateData: options.dynamicData,
    bcc: options.bcc,
  };

  try {
    await sgMail.send(msg);
    console.log('Template email sent successfully!');
    return { success: true };
  } catch (error) {
    console.error('Error sending template email:', error);
    throw error;
  }
}









































