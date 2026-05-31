import bcrypt from 'bcrypt';
import { UsersRepository } from '@/lib/repositories/users.repository';
import { OtpRepository } from '@/lib/repositories/otp.repository';
import { signToken } from '@/lib/auth/jwt';
import { verifyToken } from '@/lib/auth/jwt';
import { getMailService } from '@/lib/services/unified-mail.service';

export interface CreateUserDto {
  email: string;
  password_hash: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
}

export interface LoginUserDto {
  email: string;
  password: string;
  accountType?: 'doctor' | 'hospital' | 'admin'; // Optional: expected account type for validation
}

export interface RefreshTokenDto {
  token: string;
}

export interface UpdateUserDto {
  email?: string;
  phone?: string;
}

export class UsersService {
  private userRepository = new UsersRepository();
  private otpRepository = new OtpRepository();
  private mailService = getMailService();

  async create(createUserDto: CreateUserDto, role: 'doctor' | 'hospital' | 'admin' = 'doctor') {
    try {
      // Validate password_hash is provided
      if (!createUserDto.password_hash || typeof createUserDto.password_hash !== 'string' || createUserDto.password_hash.trim() === '') {
        return {
          success: false,
          message: 'Password is required',
          data: null,
        };
      }

      const existingUser = await this.userRepository.findUserByEmail(createUserDto.email);

      if (existingUser.length > 0) {
        return {
          success: false,
          message: 'User with this email already exists',
          data: null,
        };
      }

      // Hash the password before saving
      const hashedPassword = await bcrypt.hash(createUserDto.password_hash, 10);

      const newUser = await this.userRepository.createUser({
        ...createUserDto,
        password_hash: hashedPassword,
      }, role);

      return {
        success: true,
        message: 'User created successfully',
        data: newUser,
      };
    } catch (error) {
      console.error('Error creating user:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorDetails = error instanceof Error && (error as any).cause ? (error as any).cause.message : '';
      return {
        success: false,
        message: 'Failed to create user',
        error: errorMessage + (errorDetails ? ` - ${errorDetails}` : ''),
        data: null,
      };
    }
  }

  async login(body: LoginUserDto) {
    try {
      const user = await this.userRepository.findUserByEmail(body.email);

      if (user.length === 0) {
        return {
          success: false,
          message: 'User not found',
          data: null,
        };
      }

      const isPasswordValid = await bcrypt.compare(
        body.password,
        user[0].passwordHash!,
      );

      if (!isPasswordValid) {
        return {
          success: false,
          message: 'Invalid password',
          data: null,
        };
      }

      // Validate account type if provided (for security - ensure user is logging in with correct role)
      if (body.accountType && body.accountType !== 'admin') {
        const roleToAccountType: Record<string, 'doctor' | 'hospital' | 'admin'> = {
          'doctor': 'doctor',
          'hospital': 'hospital',
          'admin': 'admin',
        };
        
        const expectedAccountType = roleToAccountType[user[0].role];
        
        if (expectedAccountType && body.accountType !== expectedAccountType) {
          return {
            success: false,
            message: `This account is registered as a ${user[0].role}. Please use the ${expectedAccountType} login.`,
            data: null,
          };
        }
      }

      const payload = { userId: user[0].id, userRole: user[0].role };
      const accessToken = signToken(
        payload,
        process.env.JWT_ACCESS_TOKEN_SECRET!,
        process.env.JWT_ACCESS_TOKEN_EXPIRATION || '1d'
      );

      const refreshToken = signToken(
        payload,
        process.env.JWT_REFRESH_TOKEN_SECRET!,
        process.env.JWT_REFRESH_TOKEN_EXPIRATION || '7d'
      );

      return {
        success: true,
        message: 'Login successful',
        data: { accessToken, refreshToken },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Login failed',
        error: error instanceof Error ? error.message : String(error),
        data: null,
      };
    }
  }

  async refreshToken(token:string) {
    try {
      console.log(token,"token")
      // Verify refresh token

      const payload = verifyToken(
        token,
        process.env.JWT_REFRESH_TOKEN_SECRET!
      );

      // Create new access token
      const accessToken = signToken(
        { userId: payload.userId, userRole: payload.userRole },
        process.env.JWT_ACCESS_TOKEN_SECRET!,
        process.env.JWT_ACCESS_TOKEN_EXPIRATION || '1d'
      );

      return { success: true, data: { accessToken } };
    } catch (err) {
      console.error('Error refreshing token:', err);
      return { success: false, message: 'Invalid refresh token' };
    }
  }

  async getProfile(userId: string) {
    const user = await this.userRepository.getUserById(userId);
    if (!user) {
      return {
        success: false,
        message: 'User not found',
        data: null,
      };
    }
    return {
      success: true,
      message: 'User profile fetched successfully',
      data: user,
    };
  }

  async findAll() {
    return await this.userRepository.findAll();
  }

  async findOne(id: string) {
    return await this.userRepository.getUserById(id);
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const result = await this.userRepository.updateUser(id, updateUserDto);
    if (result && result.length > 0) {
      return { success: true, data: result[0], message: 'User updated successfully' };
    }
    return { success: false, message: 'User not found' };
  }

  async remove(id: string) {
    return await this.userRepository.deleteUser(id);
  }

  /**
   * Send password reset link to user's email
   */
  async forgotPassword(email: string) {
    // Normalize email at the top level so it's available in catch block
    const normalizedEmail = email.toLowerCase().trim();
    
    try {
      console.log('📧 [USERS SERVICE] forgotPassword called for email:', email);
      console.log('📧 [USERS SERVICE] Normalized email:', normalizedEmail);
      console.log('📧 [USERS SERVICE] Original email:', email);

      // Find user by email
      console.log('📧 [USERS SERVICE] Searching for user in database...');
      const users = await this.userRepository.findUserByEmail(normalizedEmail);
      console.log('📧 [USERS SERVICE] User found:', users.length > 0 ? 'Yes' : 'No');
      console.log('📧 [USERS SERVICE] Users array length:', users.length);
      
      if (users.length > 0) {
        console.log('📧 [USERS SERVICE] Found user:', {
          id: users[0].id,
          email: users[0].email,
          role: users[0].role,
        });
      } else {
        console.log('⚠️ [USERS SERVICE] User not found in database with email:', normalizedEmail);
        console.log('⚠️ [USERS SERVICE] This could mean:');
        console.log('  1. User does not exist with this email');
        console.log('  2. Email case mismatch (though we normalize to lowercase)');
        console.log('  3. Email has extra spaces or special characters');
      }

      // Check if user exists
      const emailExists = users.length > 0;
      
      if (!emailExists) {
        console.log('📧 [USERS SERVICE] User not found, returning response with emailExists: false');
        return {
          success: false,
          message: 'Email does not exist in our system. Please check your email address or sign up for a new account.',
          data: {
            email: normalizedEmail,
            emailExists: false,
          },
        };
      }

      const user = users[0];
      console.log('📧 [USERS SERVICE] User ID:', user.id, 'Role:', user.role);

      // Generate password reset token (valid for 1 hour)
      const resetToken = signToken(
        {
          userId: user.id,
          userRole: user.role,
        },
        process.env.JWT_ACCESS_TOKEN_SECRET!,
        '1h', // Token expires in 1 hour
      );
      console.log('📧 [USERS SERVICE] Reset token generated (length):', resetToken.length);

      // Create reset password URL (link that will trigger OTP send)
      const baseUrl = process.env.FRONTEND_URL;
      if (!baseUrl) {
        throw new Error('FRONTEND_URL environment variable is not set');
      }
      const resetPasswordUrl = `${baseUrl}/reset-password-otp?token=${resetToken}`;
      console.log('📧 [USERS SERVICE] Reset password URL:', resetPasswordUrl);

      // Send password reset email
      try {
        const currentYear = new Date().getFullYear();
        const mailServiceType = (process.env.MAIL_SERVICE_TYPE || 'SENDGRID').toUpperCase().trim();
        
        // Determine template ID based on mail service type
        let templateId: string;
        let fromEmail: string;
        
        if (mailServiceType === 'NODEMAILER') {
          // For Nodemailer, use HTML template file name (without .html extension)
          templateId = 'password-reset'; // Uses email-templates/password-reset.html
          // IMPORTANT: For Gmail OAuth2, "from" email MUST match the authorized Gmail account
          // Don't use no-reply@yourapp.com - use the Gmail account (pavanforu511@gmail.com)
          fromEmail = process.env.SMTP_USER || process.env.SMTP_EMAIL || 'pavanforu511@gmail.com';
        } else {
          // For SendGrid, use template ID from env or fallback
          templateId = process.env.SENDGRID_PASSWORD_RESET_TEMPLATE_ID 
            || process.env.SENDGRID_PASSWORD_RESET_OTP_TEMPLATE_ID 
            || 'd-password-reset-template-id';
          fromEmail = process.env.SENDGRID_FROM_EMAIL || 'no-reply@yourapp.com';
        }
        
        console.log('📧 [USERS SERVICE] Attempting to send email...');
        console.log('📧 [USERS SERVICE] Mail service type:', mailServiceType);
        console.log('📧 [USERS SERVICE] Template ID:', templateId);
        console.log('📧 [USERS SERVICE] From email:', fromEmail);
        
        if (mailServiceType === 'SENDGRID' && templateId === 'd-password-reset-template-id') {
          console.error('❌ [USERS SERVICE] ERROR: Using default/fallback template ID. Please set SENDGRID_PASSWORD_RESET_TEMPLATE_ID in .env file!');
        }

        await this.mailService.sendTemplateMail({
          to: normalizedEmail,
          from: fromEmail,
          subject: 'Password Reset Request',
          templateId: templateId,
          dynamicData: {
            username: user.email, // User table doesn't have firstName/lastName, use email as username
            email: normalizedEmail,
            resetPasswordUrl: resetPasswordUrl,
            expiresIn: '1 hour',
            appName: process.env.APP_NAME || 'Healthcare Platform',
            year: currentYear.toString(),
          },
        });

        console.log('✅ [USERS SERVICE] Email sent successfully to:', normalizedEmail);

        return {
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent.',
          data: {
            email: normalizedEmail,
            emailExists: true,
            expiresIn: '1 hour',
          },
        };
      } catch (emailError: any) {
        console.error('❌ [USERS SERVICE] Failed to send password reset email:', emailError);
        
        // Check for SendGrid specific errors
        const errorBody = emailError?.response?.body;
        if (errorBody?.errors) {
          errorBody.errors.forEach((err: any) => {
            console.error('❌ [USERS SERVICE] SendGrid Error:', err.message);
            if (err.message.includes('credits') || err.message.includes('limit')) {
              console.error('⚠️ [USERS SERVICE] SendGrid account has reached its sending limit!');
              console.error('⚠️ [USERS SERVICE] Solutions:');
              console.error('   1. Check your SendGrid account dashboard for credit limits');
              console.error('   2. Upgrade your SendGrid plan if needed');
              console.error('   3. Wait for credits to reset (free tier: 100 emails/day)');
            }
            if (err.message.includes('sender') || err.message.includes('from')) {
              console.error('⚠️ [USERS SERVICE] Sender email issue!');
              console.error('⚠️ [USERS SERVICE] Solutions:');
              console.error('   1. Verify your sender email in SendGrid (Settings → Sender Authentication)');
              console.error('   2. Set SENDGRID_FROM_EMAIL in .env to a verified sender address');
            }
          });
        }
        
        console.error('❌ [USERS SERVICE] Email error details:', {
          message: emailError instanceof Error ? emailError.message : String(emailError),
          code: emailError?.code,
          responseBody: errorBody,
          stack: emailError instanceof Error ? emailError.stack : undefined,
        });
        // Still return success but indicate email exists
        return {
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent.',
          data: {
            email: normalizedEmail,
            emailExists: true,
          },
          note: 'Email sending failed - check server logs',
        };
      }
    } catch (error) {
      console.error('❌ [USERS SERVICE] Error in forgotPassword:', error);
      console.error('❌ [USERS SERVICE] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Return success but don't reveal email existence on error
      return {
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
        data: {
          email: normalizedEmail,
          emailExists: undefined, // Don't reveal on error
        },
      };
    }
  }

  /**
   * Reset user password using reset token
   */
  async resetPassword(token: string, newPassword: string) {
    try {
      // Validate password
      if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 8) {
        return {
          success: false,
          message: 'Password must be at least 8 characters long',
        };
      }

      // Verify and decode token
      let decoded;
      try {
        decoded = verifyToken(token, process.env.JWT_ACCESS_TOKEN_SECRET!);
      } catch (error: any) {
        if (error.name === 'TokenExpiredError') {
          return {
            success: false,
            message: 'Password reset link has expired. Please request a new one.',
          };
        }
        if (error.name === 'JsonWebTokenError') {
          return {
            success: false,
            message: 'Invalid password reset link',
          };
        }
        throw error;
      }

      // Find user
      const user = await this.userRepository.getUserById(decoded.userId);
      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password
      await this.userRepository.updatePassword(decoded.userId, hashedPassword);

      return {
        success: true,
        message: 'Password has been reset successfully',
      };
    } catch (error) {
      console.error('Error in resetPassword:', error);
      return {
        success: false,
        message: 'Failed to reset password',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Generate a random 6-digit OTP code
   */
  private generateOtpCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Send OTP for password reset
   */
  async sendPasswordResetOtp(email: string) {
    try {
      // Normalize email
      const normalizedEmail = email.toLowerCase().trim();

      // Find user by email
      const users = await this.userRepository.findUserByEmail(normalizedEmail);

      // Don't reveal if user exists (security best practice)
      if (users.length === 0) {
        return {
          success: true,
          message: 'If an account with that email exists, a password reset code has been sent.',
        };
      }

      const user = users[0];

      // Invalidate previous unused password reset OTPs
      await this.otpRepository.invalidateUserOtps(user.id, 'password_reset');

      // Generate new OTP
      const otpCode = this.generateOtpCode();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10); // OTP expires in 10 minutes

      // Save OTP to database
      await this.otpRepository.createOtp({
        userId: user.id,
        email: normalizedEmail,
        otpCode,
        otpType: 'password_reset',
        expiresAt: expiresAt.toISOString(),
      });

      // Send OTP via email
      try {
        const currentYear = new Date().getFullYear();
        const baseUrl = process.env.FRONTEND_URL;
        if (!baseUrl) {
          throw new Error('FRONTEND_URL environment variable is not set');
        }
        const resetPasswordUrl = `${baseUrl}/reset-password`;
        const mailServiceType = (process.env.MAIL_SERVICE_TYPE || 'SENDGRID').toUpperCase().trim();
        
        // Determine template ID and from email based on mail service type
        let templateId: string;
        let fromEmail: string;
        
        if (mailServiceType === 'NODEMAILER') {
          // For Nodemailer, use HTML template file name (without .html extension)
          templateId = 'password-reset-otp'; // Uses email-templates/password-reset-otp.html
          // IMPORTANT: For Gmail OAuth2, "from" email MUST match the authorized Gmail account
          fromEmail = process.env.SMTP_USER || process.env.SMTP_EMAIL || 'pavanforu511@gmail.com';
        } else {
          // For SendGrid, use template ID from env or fallback
          templateId = process.env.SENDGRID_PASSWORD_RESET_OTP_TEMPLATE_ID || 'd-password-reset-otp-template-id';
          fromEmail = process.env.SENDGRID_FROM_EMAIL || 'no-reply@yourapp.com';
        }

        await this.mailService.sendTemplateMail({
          to: normalizedEmail,
          from: fromEmail,
          subject: 'Password Reset - Verification Code',
          templateId: templateId,
          dynamicData: {
            username: user.email, // Use email as username
            email: normalizedEmail,
            otpCode: otpCode,
            expiresIn: '10 minutes',
            resetPasswordUrl: resetPasswordUrl,
            stationName: process.env.APP_NAME || 'Healthcare Platform',
            appName: process.env.APP_NAME || 'Healthcare Platform',
            year: currentYear.toString(),
          },
        });

        return {
          success: true,
          message: 'If an account with that email exists, a password reset code has been sent.',
          data: {
            email: normalizedEmail,
            expiresIn: '10 minutes',
          },
        };
      } catch (emailError) {
        console.error('Failed to send password reset OTP email:', emailError);
        // Still return success to not reveal if user exists
        return {
          success: true,
          message: 'If an account with that email exists, a password reset code has been sent.',
          note: 'Email sending failed - check server logs',
        };
      }
    } catch (error) {
      console.error('Error sending password reset OTP:', error);
      // Return success anyway to not reveal if user exists
      return {
        success: true,
        message: 'If an account with that email exists, a password reset code has been sent.',
      };
    }
  }

  /**
   * Verify OTP for password reset
   */
  async verifyPasswordResetOtp(email: string, otpCode: string) {
    try {
      // Validate OTP format
      const normalizedOtpCode = otpCode.trim();
      if (!/^\d{6}$/.test(normalizedOtpCode)) {
        return {
          success: false,
          message: 'Invalid OTP format. OTP must be exactly 6 digits.',
        };
      }

      // Normalize email
      const normalizedEmail = email.toLowerCase().trim();

      // Find user by email
      const users = await this.userRepository.findUserByEmail(normalizedEmail);

      if (users.length === 0) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      const user = users[0];

      // Find valid OTP
      const otp = await this.otpRepository.findValidOtp(normalizedEmail, normalizedOtpCode);

      if (!otp) {
        return {
          success: false,
          message: 'Invalid or expired OTP. Please request a new password reset code.',
        };
      }

      // Verify OTP belongs to this user
      if (otp.userId !== user.id) {
        return {
          success: false,
          message: 'OTP does not belong to this user',
        };
      }

      // Verify OTP type matches
      if (otp.otpType !== 'password_reset') {
        return {
          success: false,
          message: 'Invalid OTP type for password reset',
        };
      }

      // Mark OTP as used
      await this.otpRepository.markOtpAsUsed(otp.id);

      return {
        success: true,
        message: 'OTP verified successfully. You can now reset your password.',
      };
    } catch (error) {
      console.error('Error verifying password reset OTP:', error);
      return {
        success: false,
        message: 'Failed to verify password reset code',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Reset password using verified OTP
   */
  async resetPasswordWithOtp(email: string, otpCode: string, newPassword: string) {
    try {
      // Validate password
      if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 8) {
        return {
          success: false,
          message: 'Password must be at least 8 characters long',
        };
      }

      // Validate OTP format
      const normalizedOtpCode = otpCode.trim();
      if (!/^\d{6}$/.test(normalizedOtpCode)) {
        return {
          success: false,
          message: 'Invalid OTP format. OTP must be exactly 6 digits.',
        };
      }

      // Normalize email
      const normalizedEmail = email.toLowerCase().trim();

      // Find user by email
      const users = await this.userRepository.findUserByEmail(normalizedEmail);

      if (users.length === 0) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      const user = users[0];

      // Find valid OTP (but don't mark as used yet - we'll do it after password reset)
      const otp = await this.otpRepository.findValidOtp(normalizedEmail, normalizedOtpCode);

      if (!otp) {
        return {
          success: false,
          message: 'Invalid or expired OTP. Please request a new password reset code.',
        };
      }

      // Verify OTP belongs to this user
      if (otp.userId !== user.id) {
        return {
          success: false,
          message: 'OTP does not belong to this user',
        };
      }

      // Verify OTP type matches
      if (otp.otpType !== 'password_reset') {
        return {
          success: false,
          message: 'Invalid OTP type for password reset',
        };
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password
      await this.userRepository.updatePassword(user.id, hashedPassword);

      // Mark OTP as used
      await this.otpRepository.markOtpAsUsed(otp.id);

      return {
        success: true,
        message: 'Password has been reset successfully',
      };
    } catch (error) {
      console.error('Error resetting password with OTP:', error);
      return {
        success: false,
        message: 'Failed to reset password',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Verify reset token and send OTP (called when user clicks link in email)
   */
  async verifyTokenAndSendOtp(token: string) {
    try {
      // Verify and decode token
      let decoded;
      try {
        decoded = verifyToken(token, process.env.JWT_ACCESS_TOKEN_SECRET!);
      } catch (error: any) {
        if (error.name === 'TokenExpiredError') {
          return {
            success: false,
            message: 'Password reset link has expired. Please request a new one.',
          };
        }
        if (error.name === 'JsonWebTokenError') {
          return {
            success: false,
            message: 'Invalid password reset link',
          };
        }
        throw error;
      }

      // Find user
      const user = await this.userRepository.getUserById(decoded.userId);
      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      // Now send OTP using the existing sendPasswordResetOtp method
      // But we need to send it directly without invalidating previous OTPs
      // Let's create the OTP and send it
      const normalizedEmail = user.email.toLowerCase().trim();

      // Invalidate previous unused password reset OTPs
      await this.otpRepository.invalidateUserOtps(user.id, 'password_reset');

      // Generate new OTP
      const otpCode = this.generateOtpCode();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10); // OTP expires in 10 minutes

      // Save OTP to database
      await this.otpRepository.createOtp({
        userId: user.id,
        email: normalizedEmail,
        otpCode,
        otpType: 'password_reset',
        expiresAt: expiresAt.toISOString(),
      });

      // Send OTP via email
      try {
        const currentYear = new Date().getFullYear();
        const baseUrl = process.env.FRONTEND_URL;
        if (!baseUrl) {
          throw new Error('FRONTEND_URL environment variable is not set');
        }
        const resetPasswordUrl = `${baseUrl}/reset-password-otp`;
        const mailServiceType = (process.env.MAIL_SERVICE_TYPE || 'SENDGRID').toUpperCase().trim();
        
        // Determine template ID and from email based on mail service type
        let templateId: string;
        let fromEmail: string;
        
        if (mailServiceType === 'NODEMAILER') {
          // For Nodemailer, use HTML template file name (without .html extension)
          templateId = 'password-reset-otp'; // Uses email-templates/password-reset-otp.html
          // IMPORTANT: For Gmail OAuth2, "from" email MUST match the authorized Gmail account
          fromEmail = process.env.SMTP_USER || process.env.SMTP_EMAIL || 'pavanforu511@gmail.com';
        } else {
          // For SendGrid, use template ID from env or fallback
          templateId = process.env.SENDGRID_PASSWORD_RESET_OTP_TEMPLATE_ID || 'd-password-reset-otp-template-id';
          fromEmail = process.env.SENDGRID_FROM_EMAIL || 'no-reply@yourapp.com';
        }

        await this.mailService.sendTemplateMail({
          to: normalizedEmail,
          from: fromEmail,
          subject: 'Password Reset - Verification Code',
          templateId: templateId,
          dynamicData: {
            username: user.email,
            email: normalizedEmail,
            otpCode: otpCode,
            expiresIn: '10 minutes',
            resetPasswordUrl: resetPasswordUrl,
            stationName: process.env.APP_NAME || 'Healthcare Platform',
            appName: process.env.APP_NAME || 'Healthcare Platform',
            year: currentYear.toString(),
          },
        });

        return {
          success: true,
          message: 'OTP sent to your email. Please check your inbox.',
          data: {
            email: normalizedEmail,
            expiresIn: '10 minutes',
            token: token, // Return token so frontend can use it
          },
        };
      } catch (emailError) {
        console.error('Failed to send OTP email:', emailError);
        return {
          success: false,
          message: 'Failed to send OTP. Please try again.',
        };
      }
    } catch (error) {
      console.error('Error verifying token and sending OTP:', error);
      return {
        success: false,
        message: 'Failed to verify reset link',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Reset password using token and OTP (both must be valid)
   */
  async resetPasswordWithTokenAndOtp(token: string, otpCode: string, newPassword: string) {
    try {
      // Validate password
      if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 8) {
        return {
          success: false,
          message: 'Password must be at least 8 characters long',
        };
      }

      // Validate OTP format
      const normalizedOtpCode = otpCode.trim();
      if (!/^\d{6}$/.test(normalizedOtpCode)) {
        return {
          success: false,
          message: 'Invalid OTP format. OTP must be exactly 6 digits.',
        };
      }

      // Verify and decode token
      let decoded;
      try {
        decoded = verifyToken(token, process.env.JWT_ACCESS_TOKEN_SECRET!);
      } catch (error: any) {
        if (error.name === 'TokenExpiredError') {
          return {
            success: false,
            message: 'Password reset link has expired. Please request a new one.',
          };
        }
        if (error.name === 'JsonWebTokenError') {
          return {
            success: false,
            message: 'Invalid password reset link',
          };
        }
        throw error;
      }

      // Find user
      const user = await this.userRepository.getUserById(decoded.userId);
      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      const normalizedEmail = user.email.toLowerCase().trim();

      // Find valid OTP
      const otp = await this.otpRepository.findValidOtp(normalizedEmail, normalizedOtpCode);

      if (!otp) {
        return {
          success: false,
          message: 'Invalid or expired OTP. Please request a new password reset link.',
        };
      }

      // Verify OTP belongs to this user
      if (otp.userId !== user.id) {
        return {
          success: false,
          message: 'OTP does not belong to this user',
        };
      }

      // Verify OTP type matches
      if (otp.otpType !== 'password_reset') {
        return {
          success: false,
          message: 'Invalid OTP type for password reset',
        };
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password
      await this.userRepository.updatePassword(user.id, hashedPassword);

      // Mark OTP as used
      await this.otpRepository.markOtpAsUsed(otp.id);

      return {
        success: true,
        message: 'Password has been reset successfully',
      };
    } catch (error) {
      console.error('Error resetting password with token and OTP:', error);
      return {
        success: false,
        message: 'Failed to reset password',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

