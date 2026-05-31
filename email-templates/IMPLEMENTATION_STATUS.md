# Password Reset Implementation Status

## Current Implementation

### ✅ Link-Based Password Reset (Currently Active)

**What you have:**
- `/api/users/forgot-password` - Sends password reset link via email
- `/api/users/reset-password` - Resets password using JWT token from link
- Template: `password-reset.html` (link-based)

**How it works:**
1. User requests password reset
2. System generates JWT token (valid 1 hour)
3. Email sent with reset link containing token
4. User clicks link → redirected to reset page
5. User enters new password
6. System verifies token and updates password

**Template Variables Used:**
- `{{appName}}`
- `{{username}}`
- `{{email}}`
- `{{resetPasswordUrl}}`
- `{{expiresIn}}`
- `{{year}}`

---

## OTP-Based Password Reset

### ❌ Not Yet Implemented

**Your Template:** `password-reset-otp.html` ✅ Saved and ready

**Template Variables Required:**
- `{{username}}` - User's name or email
- `{{email}}` - User's email address
- `{{otpCode}}` - 6-digit verification code ⚠️ **REQUIRED**
- `{{stationName}}` or `{{appName}}` - Application name
- `{{resetPasswordUrl}}` - Optional (password reset page URL)
- `{{expiresIn}}` - OTP expiration time (e.g., "10 minutes")
- `{{year}}` - Current year

**What's Missing for OTP Implementation:**

1. **Database Schema**
   - OTP table to store:
     - `id` (UUID)
     - `user_id` (UUID, foreign key to users)
     - `email` (string)
     - `otp_code` (string, 6 digits)
     - `otp_type` (enum: 'password_reset', 'email_verification', etc.)
     - `expires_at` (timestamp)
     - `is_used` (boolean)
     - `created_at` (timestamp)

2. **OTP Repository** (`lib/repositories/otp.repository.ts`)
   - `createOtp()` - Generate and save OTP
   - `findValidOtp()` - Find valid, unused OTP by email/code
   - `invalidateUserOtps()` - Mark old OTPs as used
   - `markOtpAsUsed()` - Mark OTP as used after verification

3. **OTP Service Methods** (add to `UsersService`)
   - `sendPasswordResetOtp(email)` - Generate and send OTP
   - `verifyPasswordResetOtp(email, otpCode)` - Verify OTP code
   - `resetPasswordWithOtp(email, otpCode, newPassword)` - Complete reset flow

4. **API Routes**
   - `POST /api/users/forgot-password-otp` - Request OTP
   - `POST /api/users/verify-otp` - Verify OTP code
   - `POST /api/users/reset-password-otp` - Reset password with verified OTP

5. **OTP Generation Logic**
   - Generate random 6-digit code
   - Set expiration (typically 10 minutes)
   - Hash or store securely
   - Send via email

---

## Comparison

| Feature | Link-Based (Current) | OTP-Based (Template Ready) |
|---------|---------------------|---------------------------|
| **Implementation** | ✅ Implemented | ❌ Not implemented |
| **Template** | ✅ `password-reset.html` | ✅ `password-reset-otp.html` |
| **User Experience** | Click link → Reset | Enter code → Reset |
| **Security** | JWT token in URL | 6-digit code in email |
| **Database** | No extra table needed | Requires OTP table |
| **Expiration** | 1 hour | 10 minutes (typical) |
| **Complexity** | Lower | Higher (needs OTP management) |

---

## Recommendation

**Option 1: Use Current Link-Based System** ✅
- Already working
- Simpler implementation
- Just update template variables in `password-reset.html`

**Option 2: Switch to OTP-Based** 
- More secure (code expires faster)
- Better UX for some users
- Requires database schema + repository + service implementation

**Option 3: Support Both** 
- Allow users to choose
- More complex to maintain
- Both templates available

---

## Next Steps

If you want OTP-based password reset implemented:

1. ✅ Template is ready (`password-reset-otp.html`)
2. ❌ Need to implement:
   - OTP database table
   - OTP repository
   - OTP service methods
   - API routes
   - Update mail service to send OTP template

**Note:** Your reference NestJS code shows OTP implementation, but the Next.js version currently only has link-based reset.



