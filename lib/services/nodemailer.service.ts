import nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import { google } from 'googleapis';

export interface SendTemplateMailOptions {
  to: string | string[];
  from?: string;
  subject?: string;
  templateId: string; // For Nodemailer, this will be the template file name
  dynamicData: Record<string, any>; // dynamic fields to replace placeholders
  bcc?: string | string[];
}

export class NodemailerService {
  private transporter: nodemailer.Transporter;
  private oauth2Client: any = null; // Initialize as null to check if OAuth2 is being used
  private cachedAccessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    // Get SMTP configuration from environment variables
    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = parseInt(process.env.SMTP_PORT || '587');
    // Support multiple env variable names for email/user
    const smtpUser = process.env.SMTP_USER || process.env.SMTP_EMAIL || 'pavanforu511@gmail.com';
    const smtpPassword = process.env.SMTP_PASSWORD;
    const smtpSecure = process.env.SMTP_SECURE === 'true'; // true for 465, false for other ports

    // OAuth2 configuration (for Gmail OAuth2)
    // Support both formats: CLIENT_ID/CLIENT_SECREAT/REFRESH_TOKEN (without SMTP_ prefix)
    // and SMTP_CLIENT_ID/SMTP_CLIENT_SECRET/SMTP_REFRESH_TOKEN (with SMTP_ prefix)
    const oauthClientId = process.env.CLIENT_ID || process.env.SMTP_CLIENT_ID;
    // Handle typo: CLIENT_SECREAT (user has typo in env file)
    const oauthClientSecret = process.env.CLIENT_SECREAT || process.env.CLIENT_SECRET || process.env.SMTP_CLIENT_SECRET;
    // Handle REFRESH_TOKEN (may have quotes, strip them)
    const rawRefreshToken = process.env.REFRESH_TOKEN || process.env.SMTP_REFRESH_TOKEN;
    const oauthRefreshToken = rawRefreshToken ? rawRefreshToken.replace(/^["']|["']$/g, '') : undefined;
    const oauthAccessToken = process.env.SMTP_ACCESS_TOKEN; // Optional, will be generated if not provided

    console.log('📧 [NODEMAILER] Initializing Nodemailer service...');
    console.log('📧 [NODEMAILER] SMTP Host:', smtpHost);
    console.log('📧 [NODEMAILER] SMTP Port:', smtpPort);
    console.log('📧 [NODEMAILER] SMTP User:', smtpUser ? 'Set' : 'Not set');
    console.log('📧 [NODEMAILER] SMTP Password:', smtpPassword ? 'Set' : 'Not set');
    console.log('📧 [NODEMAILER] SMTP Secure:', smtpSecure);
    console.log('📧 [NODEMAILER] OAuth2 Client ID:', oauthClientId ? 'Set' : 'Not set');
    console.log('📧 [NODEMAILER] OAuth2 Client Secret:', oauthClientSecret ? 'Set' : 'Not set');
    console.log('📧 [NODEMAILER] OAuth2 Refresh Token:', oauthRefreshToken ? 'Set' : 'Not set');

    // Determine authentication method
    // PRIORITY: Use password-based auth if SMTP_PASSWORD is provided
    // Only use OAuth2 if password is NOT provided
    const usePasswordAuth = !!smtpPassword;
    const useOAuth2 = !usePasswordAuth && oauthClientId && oauthClientSecret && oauthRefreshToken;

    if (usePasswordAuth) {
      // Use password-based authentication (PRIORITY)
      if (!smtpUser || !smtpPassword) {
        throw new Error('SMTP_USER (or SMTP_EMAIL) and SMTP_PASSWORD must be defined in .env');
      }

      console.log('📧 [NODEMAILER] Using password-based authentication (SMTP_PASSWORD provided)');

      // Create transporter with password
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure, // true for 465, false for other ports
        auth: {
          user: smtpUser,
          pass: smtpPassword,
        },
      });
    } else if (useOAuth2) {
      console.log('📧 [NODEMAILER] Using OAuth2 authentication');
      
      // Ensure user email is set for OAuth2 (default to pavanforu511@gmail.com)
      const oauthUser = smtpUser || 'pavanforu511@gmail.com';
      console.log('📧 [NODEMAILER] OAuth2 User:', oauthUser);
      
      // Create OAuth2 client for generating access tokens
      this.oauth2Client = new google.auth.OAuth2(
        oauthClientId,
        oauthClientSecret,
        'https://developers.google.com/oauthplayground' // Redirect URI (not used but required)
      );
      
      // Set refresh token
      this.oauth2Client.setCredentials({
        refresh_token: oauthRefreshToken,
      });
      
      // For OAuth2, generate access token upfront (synchronously if possible, or on first send)
      console.log('📧 [NODEMAILER] OAuth2 configured');
      console.log('📧 [NODEMAILER] OAuth2 Client ID:', oauthClientId ? `${oauthClientId.substring(0, 30)}...` : 'Not set');
      console.log('📧 [NODEMAILER] OAuth2 Client Secret:', oauthClientSecret ? `${oauthClientSecret.substring(0, 10)}...` : 'Not set');
      console.log('📧 [NODEMAILER] OAuth2 Refresh Token:', oauthRefreshToken ? `${oauthRefreshToken.substring(0, 20)}...` : 'Not set');
      console.log('📧 [NODEMAILER] OAuth2 User:', oauthUser);
      
      // Store initial access token if provided
      if (oauthAccessToken) {
        console.log('📧 [NODEMAILER] Using provided access token from env');
        this.cachedAccessToken = oauthAccessToken;
        this.tokenExpiry = Date.now() + (50 * 60 * 1000);
      } else {
        console.log('📧 [NODEMAILER] Access token will be generated on first send');
        // Try to generate token immediately (async, but don't wait)
        this.oauth2Client.getAccessToken()
          .then((response: { token?: string | null }) => {
            if (response.token) {
              this.cachedAccessToken = response.token;
              this.tokenExpiry = Date.now() + (50 * 60 * 1000);
              console.log('✅ [NODEMAILER] Initial access token generated in background');
            }
          })
          .catch((error: any) => {
            console.warn('⚠️ [NODEMAILER] Failed to generate initial access token (will retry on send):', error.message);
          });
      }
      
      // Create transporter with OAuth2
      // IMPORTANT: We'll generate access token before sending and recreate transporter
      // For now, create with empty token - will be updated in sendTemplateMail
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: oauthUser,
          clientId: oauthClientId!,
          clientSecret: oauthClientSecret!,
          refreshToken: oauthRefreshToken!,
          accessToken: oauthAccessToken || 'PLACEHOLDER_WILL_BE_REPLACED', // Placeholder - will be replaced before sending
        },
      } as any);
      
      console.log('📧 [NODEMAILER] OAuth2 transporter created (access token will be generated before first send)');
    } else {
      // Neither password nor OAuth2 credentials provided
      throw new Error('Either SMTP_PASSWORD must be defined, or OAuth2 credentials (CLIENT_ID, CLIENT_SECREAT/CLIENT_SECRET, REFRESH_TOKEN) must be provided in .env');
    }

    console.log('✅ [NODEMAILER] Nodemailer service initialized successfully');
  }

  /**
   * Load and process HTML template
   * Replaces placeholders like {{variableName}} with values from dynamicData
   */
  private loadTemplate(templateId: string, dynamicData: Record<string, any>): string {
    const templatesDir = path.join(process.cwd(), 'email-templates');
    const templatePath = path.join(templatesDir, `${templateId}.html`);

    console.log('📧 [NODEMAILER] Loading template:', templatePath);

    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found: ${templatePath}`);
    }

    let html = fs.readFileSync(templatePath, 'utf-8');

    // Replace placeholders: {{variableName}} or {{ variableName }}
    // Supports both {{var}} and {{ var }} formats
    Object.keys(dynamicData).forEach((key) => {
      const value = dynamicData[key];
      // Replace {{key}} and {{ key }} patterns
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      html = html.replace(regex, String(value || ''));
    });

    console.log('📧 [NODEMAILER] Template processed with', Object.keys(dynamicData).length, 'variables');

    return html;
  }

  /**
   * Send email using template
   * Similar interface to SendGrid MailService for easy switching
   */
  async sendTemplateMail(options: SendTemplateMailOptions) {
    console.log('📧 [NODEMAILER] ========== sendTemplateMail called ==========');
    console.log('📧 [NODEMAILER] OAuth2 client status:', {
      hasOAuth2Client: !!this.oauth2Client,
      oauth2ClientType: this.oauth2Client ? typeof this.oauth2Client : 'null',
    });
    console.log('📧 [NODEMAILER] Email options:', {
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
      console.error('❌ [NODEMAILER] Validation error:', error.message);
      throw error;
    }

    if (!options.templateId) {
      const error = new Error('Template ID is required');
      console.error('❌ [NODEMAILER] Validation error:', error.message);
      throw error;
    }

    try {
      // Load and process template
      const html = this.loadTemplate(options.templateId, options.dynamicData);

      // Prepare email options
      // CRITICAL: For Gmail OAuth2, the "from" email MUST match the OAuth2 authorized email
      // Using a different email (like no-reply@yourapp.com) causes authentication errors
      let fromEmail = options.from;
      
      // Check if we're using OAuth2
      const isOAuth2 = this.oauth2Client !== undefined && this.oauth2Client !== null;
      
      if (isOAuth2) {
        // For OAuth2, ALWAYS use the Gmail account that was authorized (pavanforu511@gmail.com)
        // Override any provided "from" email to ensure it matches OAuth2 account
        const oauth2GmailAccount = process.env.SMTP_USER || process.env.SMTP_EMAIL || 'pavanforu511@gmail.com';
        fromEmail = oauth2GmailAccount;
        
        if (options.from && options.from !== oauth2GmailAccount) {
          console.warn(`⚠️ [NODEMAILER] OAuth2 requires from email to match authorized account. Overriding "${options.from}" with "${oauth2GmailAccount}"`);
        }
        
        console.log('📧 [NODEMAILER] OAuth2 mode - from email set to authorized Gmail account:', fromEmail);
      } else {
        // For password-based authentication, use provided email or fallback
        if (!fromEmail) {
          fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_EMAIL || process.env.SMTP_USER || 'pavanforu511@gmail.com';
        }
        console.log('📧 [NODEMAILER] Password-based auth - from email:', fromEmail);
      }
      const subject = options.subject || 'Notification';

      // Convert to array if single email
      const toEmails = Array.isArray(options.to) ? options.to : [options.to];
      const bccEmails = options.bcc ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc]) : undefined;

      // If using OAuth2, generate/refresh access token BEFORE sending
      // This is critical - must generate token upfront and pass as string, not function
      console.log('📧 [NODEMAILER] Checking OAuth2 client:', {
        hasOAuth2Client: !!this.oauth2Client,
        hasCachedToken: !!this.cachedAccessToken,
        tokenExpiry: this.tokenExpiry ? new Date(this.tokenExpiry).toISOString() : 'Not set',
        currentTime: new Date().toISOString(),
      });
      
      if (this.oauth2Client) {
        // ALWAYS generate token if not cached, or if expired/expiring soon
        const needsToken = !this.cachedAccessToken || Date.now() >= this.tokenExpiry - (5 * 60 * 1000);
        
        if (needsToken) {
          console.log('📧 [NODEMAILER] ⚠️ Access token missing or expired - generating now...');
          console.log('📧 [NODEMAILER] Generating/refreshing access token before sending...');
          try {
            // Verify OAuth2 client is properly configured
            console.log('📧 [NODEMAILER] Verifying OAuth2 client configuration...');
            const credentials = this.oauth2Client.credentials;
            console.log('📧 [NODEMAILER] OAuth2 client credentials:', {
              hasRefreshToken: !!credentials.refresh_token,
              refreshTokenLength: credentials.refresh_token?.length || 0,
              refreshTokenPreview: credentials.refresh_token ? `${credentials.refresh_token.substring(0, 20)}...` : 'None',
            });
            
            console.log('📧 [NODEMAILER] Calling getAccessToken()...');
            const accessTokenResponse = await this.oauth2Client.getAccessToken();
            console.log('📧 [NODEMAILER] Access token response received:', {
              hasToken: !!accessTokenResponse.token,
              tokenLength: accessTokenResponse.token?.length || 0,
            });
            
            if (!accessTokenResponse.token) {
              console.error('❌ [NODEMAILER] Access token response:', accessTokenResponse);
              throw new Error('Failed to generate access token from refresh token - token is null/undefined');
            }
            
            console.log('📧 [NODEMAILER] Access token generated successfully, length:', accessTokenResponse.token.length);
            this.cachedAccessToken = accessTokenResponse.token;
            this.tokenExpiry = Date.now() + (50 * 60 * 1000); // 50 minutes
            
            // Recreate transporter with new token (as STRING, not function)
            const oauthUser = process.env.SMTP_USER || process.env.SMTP_EMAIL || 'pavanforu511@gmail.com';
            const oauthClientId = process.env.CLIENT_ID || process.env.SMTP_CLIENT_ID!;
            const oauthClientSecret = process.env.CLIENT_SECREAT || process.env.CLIENT_SECRET || process.env.SMTP_CLIENT_SECRET!;
            const rawRefreshToken = process.env.REFRESH_TOKEN || process.env.SMTP_REFRESH_TOKEN;
            const oauthRefreshToken = rawRefreshToken ? rawRefreshToken.replace(/^["']|["']$/g, '') : undefined;
            
            this.transporter = nodemailer.createTransport({
              service: 'gmail',
              auth: {
                type: 'OAuth2',
                user: oauthUser,
                clientId: oauthClientId,
                clientSecret: oauthClientSecret,
                refreshToken: oauthRefreshToken!,
                accessToken: this.cachedAccessToken, // Pass as STRING, not function
              },
            } as any); // Type assertion needed for OAuth2 config
            
            console.log('✅ [NODEMAILER] Access token generated and transporter updated');
          } catch (error: any) {
            console.error('❌ [NODEMAILER] Error generating access token:', error);
            console.error('❌ [NODEMAILER] Error details:', {
              message: error.message,
              code: error.code,
              response: error.response,
            });
            
            // Check if it's an OAuth2 credential error
            if (error.message?.includes('invalid_grant') || error.message?.includes('invalid_client') || error.message?.includes('unauthorized_client')) {
              console.error('❌ [NODEMAILER] OAuth2 credentials are invalid!');
              console.error('❌ [NODEMAILER] Please check:');
              console.error('   1. CLIENT_ID is correct');
              console.error('   2. CLIENT_SECRET (or CLIENT_SECREAT) is correct');
              console.error('   3. REFRESH_TOKEN is valid and not expired');
              console.error('   4. OAuth2 app has Gmail API enabled');
              throw new Error(`OAuth2 credentials are invalid. Please verify your CLIENT_ID, CLIENT_SECRET, and REFRESH_TOKEN in .env.local. Error: ${error.message}`);
            }
            
            throw new Error(`Failed to generate access token: ${error.message}`);
          }
        } else {
          // CRITICAL: Even with cached token, we MUST recreate transporter
          // The transporter was created with a placeholder token in constructor
          console.log('📧 [NODEMAILER] Using cached access token, but recreating transporter to ensure it uses the token...');
          const oauthUser = process.env.SMTP_USER || process.env.SMTP_EMAIL || 'pavanforu511@gmail.com';
          const oauthClientId = process.env.CLIENT_ID || process.env.SMTP_CLIENT_ID!;
          const oauthClientSecret = process.env.CLIENT_SECREAT || process.env.CLIENT_SECRET || process.env.SMTP_CLIENT_SECRET!;
          const rawRefreshToken = process.env.REFRESH_TOKEN || process.env.SMTP_REFRESH_TOKEN;
          const oauthRefreshToken = rawRefreshToken ? rawRefreshToken.replace(/^["']|["']$/g, '') : undefined;
          
          this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              type: 'OAuth2',
              user: oauthUser,
              clientId: oauthClientId,
              clientSecret: oauthClientSecret,
              refreshToken: oauthRefreshToken!,
              accessToken: this.cachedAccessToken!, // Use cached token
            },
          } as any);
          console.log('✅ [NODEMAILER] Transporter recreated with cached access token');
        }
      }

      const mailOptions: nodemailer.SendMailOptions = {
        from: fromEmail,
        to: toEmails.join(', '),
        subject: subject,
        html: html,
        bcc: bccEmails?.join(', '),
      };

      console.log('📧 [NODEMAILER] Sending email via Nodemailer...');
      console.log('📧 [NODEMAILER] Mail options:', {
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject,
        hasHtml: !!mailOptions.html,
        htmlLength: typeof mailOptions.html === 'string' ? mailOptions.html.length : 0,
        hasBcc: !!mailOptions.bcc,
      });

      // Send email
      const result = await this.transporter.sendMail(mailOptions);

      console.log('✅ [NODEMAILER] Email sent successfully!');
      console.log('✅ [NODEMAILER] Message ID:', result.messageId);
      console.log('✅ [NODEMAILER] Response:', {
        messageId: result.messageId,
        accepted: result.accepted,
        rejected: result.rejected,
        pending: result.pending,
        response: result.response,
      });

      return result;
    } catch (error: any) {
      console.error('❌ [NODEMAILER] Error sending email:', error);
      console.error('❌ [NODEMAILER] Error type:', error?.constructor?.name);
      console.error('❌ [NODEMAILER] Error message:', error?.message);

      if (error?.code) {
        console.error('❌ [NODEMAILER] Error code:', error.code);
      }

      if (error?.response) {
        console.error('❌ [NODEMAILER] SMTP Error Response:', error.response);
      }

      if (error?.command) {
        console.error('❌ [NODEMAILER] SMTP Command:', error.command);
      }

      if (error?.stack) {
        console.error('❌ [NODEMAILER] Error stack:', error.stack);
      }

      throw error;
    }
  }

  /**
   * Verify SMTP connection
   * Useful for testing configuration
   */
  async verifyConnection(): Promise<boolean> {
    try {
      console.log('📧 [NODEMAILER] Verifying SMTP connection...');
      await this.transporter.verify();
      console.log('✅ [NODEMAILER] SMTP connection verified successfully');
      return true;
    } catch (error: any) {
      console.error('❌ [NODEMAILER] SMTP connection verification failed:', error.message);
      return false;
    }
  }
}

