import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';

// For now, we'll use a simple key-value approach
// In production, you might want to create a settings table
const DEFAULT_SETTINGS = {
  general: {
    siteName: 'Healthcare Admin',
    siteUrl: 'https://admin.healthcare.com',
    maintenanceMode: false,
  },
  email: {
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPassword: '',
    fromEmail: 'noreply@healthcare.com',
    fromName: 'Healthcare Admin',
  },
  payment: {
    currency: 'USD',
    paymentGateway: 'stripe',
    stripePublicKey: '',
    stripeSecretKey: '',
  },
  notifications: {
    emailEnabled: true,
    pushEnabled: true,
    smsEnabled: false,
  },
  security: {
    sessionTimeout: 3600,
    maxLoginAttempts: 5,
    requireTwoFactor: false,
  },
};

export async function GET(req: NextRequest) {
  try {
    // In a real application, you would fetch from a settings table
    // For now, return default settings
    return NextResponse.json({
      success: true,
      data: DEFAULT_SETTINGS,
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch settings',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { section, settings } = body;

    if (!section || !settings) {
      return NextResponse.json(
        { success: false, message: 'Section and settings are required' },
        { status: 400 }
      );
    }

    // In a real application, you would save to a settings table
    // For now, just return success
    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully',
      data: {
        section,
        settings,
      },
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to update settings',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}





