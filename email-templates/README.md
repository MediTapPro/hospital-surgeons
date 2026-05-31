# Email Templates

This folder contains HTML email templates for SendGrid dynamic templates.

## Template Structure

Each template is a standalone HTML file that can be copied into SendGrid's dynamic template editor.

## Available Templates

### 1. Password Reset - Link Based (`password-reset.html`)

**Purpose:** Sent when a user requests a password reset (uses magic link/JWT token).

**Dynamic Variables:**
- `{{appName}}` - Application name
- `{{username}}` - User's name or email
- `{{email}}` - User's email address
- `{{resetPasswordUrl}}` - Password reset link URL
- `{{expiresIn}}` - Token expiration time (e.g., "1 hour")
- `{{year}}` - Current year

**Status:** ✅ Currently implemented in code

---

### 2. Password Reset - OTP Based (`password-reset-otp.html`)

**Purpose:** Sent when a user requests a password reset (uses 6-digit OTP code).

**Dynamic Variables:**
- `{{username}}` - User's name or email
- `{{email}}` - User's email address
- `{{otpCode}}` - 6-digit verification code
- `{{stationName}}` or `{{appName}}` - Application name
- `{{resetPasswordUrl}}` - Optional password reset page URL
- `{{expiresIn}}` - OTP expiration time (e.g., "10 minutes")
- `{{year}}` - Current year

**Status:** ❌ Template ready, but OTP functionality NOT yet implemented in code

**Note:** This template requires:
- OTP database table
- OTP repository with create/find/validate methods
- OTP generation and verification logic
- New API endpoints for OTP-based password reset

**Usage:**
1. Copy the HTML content from `password-reset.html`
2. Paste into SendGrid Dynamic Template editor
3. Replace `{{variableName}}` with SendGrid's handlebars syntax: `{{variableName}}`
4. SendGrid will automatically recognize the variables

## How to Use in SendGrid

1. **Log in to SendGrid**
   - Go to https://app.sendgrid.com/
   - Navigate to **Email API** > **Dynamic Templates**

2. **Create a New Template**
   - Click "Create a Dynamic Template"
   - Give it a name (e.g., "Password Reset")
   - Click "Add Version" > "Code Editor"

3. **Paste Template Code**
   - Copy the HTML from the template file
   - Paste into the HTML editor
   - SendGrid will automatically detect variables

4. **Set Variables**
   - In the template editor, you can test with sample data
   - Variables are automatically detected from `{{variableName}}` syntax

5. **Get Template ID**
   - After saving, copy the Template ID (starts with `d-`)
   - Add it to your `.env` file:
     ```
     SENDGRID_PASSWORD_RESET_TEMPLATE_ID=d-your-template-id-here
     ```

## Template Design Guidelines

- **Responsive Design:** All templates use responsive CSS for mobile and desktop
- **Email Client Compatibility:** Tested for major email clients (Gmail, Outlook, Apple Mail)
- **Branding:** Uses gradient colors that can be customized
- **Accessibility:** Uses semantic HTML and proper contrast ratios
- **Plain Text Alternative:** Consider creating plain text versions for better deliverability

## Adding New Templates

1. Create a new HTML file in this folder (e.g., `welcome-email.html`)
2. Follow the same structure and styling as existing templates
3. Document the dynamic variables in this README
4. Update the service code to use the new template ID

## Variables Used in Code

The following variables are available in the mail service:

```typescript
dynamicData: {
  username: string;      // User's name or email
  email: string;         // User's email address
  appName: string;       // Application name
  year: string;          // Current year
  // Template-specific variables:
  resetPasswordUrl?: string;  // For password reset
  otpCode?: string;          // For OTP emails
  magicLink?: string;        // For magic link emails
  expiresIn?: string;        // Expiration time
}
```

## Testing Templates

1. **SendGrid Testing:**
   - Use SendGrid's "Test Data" feature
   - Preview on different devices and email clients

2. **Local Testing:**
   - Copy template HTML to a local file
   - Replace variables with test data
   - Open in browser to preview

3. **Production Testing:**
   - Send test emails to yourself
   - Check rendering in various email clients
   - Verify all links work correctly

## Notes

- **DO NOT** commit sensitive data or API keys
- Templates use inline CSS for better email client compatibility
- Always test templates in multiple email clients before going live
- Keep templates updated with your brand colors and styling
- Consider creating both HTML and plain text versions

