import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { subscriptionPlans, planPricing } from '@/src/db/drizzle/migrations/schema';
import { eq, and, sql, asc } from 'drizzle-orm';
import { validateRequest } from '@/lib/utils/validate-request';
import { CreatePlanPricingDtoSchema, UpdatePlanPricingDtoSchema } from '@/lib/validations/plan.dto';
import { createAuditLog, getRequestMetadata } from '@/lib/utils/audit-logger';

// GET - Get all pricing options for a plan
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;
    const planId = id;

    // Check if plan exists
    const plan = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, planId))
      .limit(1);

    if (plan.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Plan not found' },
        { status: 404 }
      );
    }

    // Get all pricing options for this plan
    const pricingOptions = await db
      .select()
      .from(planPricing)
      .where(eq(planPricing.planId, planId))
      .orderBy(asc(planPricing.billingPeriodMonths));

    const formattedPricing = pricingOptions.map(p => ({
      id: p.id,
      billingCycle: p.billingCycle,
      billingPeriodMonths: p.billingPeriodMonths,
      price: Number(p.price),
      currency: p.currency,
      setupFee: Number(p.setupFee),
      discountPercentage: Number(p.discountPercentage),
      isActive: p.isActive,
      validFrom: p.validFrom,
      validUntil: p.validUntil,
      monthlyEquivalent: p.billingPeriodMonths > 0 
        ? (Number(p.price) / p.billingPeriodMonths) 
        : Number(p.price),
    }));

    return NextResponse.json({
      success: true,
      data: formattedPricing,
    });
  } catch (error) {
    console.error('Error fetching plan pricing:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch plan pricing',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// POST - Add new pricing option to a plan
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;
    const planId = id;

    // Validate request body
    let validation;
    try {
      validation = await validateRequest(req, CreatePlanPricingDtoSchema);
      if (!validation.success) {
        return validation.response;
      }
    } catch (parseError) {
      console.error('Error parsing request:', parseError);
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid request format',
          error: parseError instanceof Error ? parseError.message : 'Unknown error',
        },
        { status: 400 }
      );
    }

    const { billingCycle, billingPeriodMonths, price, currency, setupFee, discountPercentage, isActive, validFrom, validUntil } = validation.data;

    // Check if plan exists
    const plan = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, planId))
      .limit(1);

    if (plan.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Plan not found' },
        { status: 404 }
      );
    }

    // Prevent creating pricing for free plans
    if (plan[0].tier === 'free') {
      return NextResponse.json(
        { success: false, message: 'Cannot create pricing for free plans. Free plans do not require pricing options.' },
        { status: 400 }
      );
    }

    // Check if pricing for this billing cycle already exists
    const existing = await db
      .select()
      .from(planPricing)
      .where(
        and(
          eq(planPricing.planId, planId),
          eq(planPricing.billingCycle, billingCycle)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, message: `Pricing for ${billingCycle} billing cycle already exists for this plan` },
        { status: 409 }
      );
    }

    // Create new pricing option
    let newPricing;
    try {
      [newPricing] = await db
        .insert(planPricing)
        .values({
          planId: planId,
          billingCycle: billingCycle,
          billingPeriodMonths: billingPeriodMonths,
          price: Math.round(price), // Store in rupees (convert to paise only when sending to Razorpay)
          currency: currency,
          setupFee: Math.round(setupFee || 0), // Store in rupees
          discountPercentage: (discountPercentage || 0).toString(), // numeric type needs string
          isActive: isActive !== undefined ? isActive : true,
          validFrom: validFrom ? new Date(validFrom).toISOString() : new Date().toISOString(),
          validUntil: validUntil ? new Date(validUntil).toISOString() : null,
        })
        .returning();
    } catch (dbError) {
      console.error('Database error creating pricing:', dbError);
      return NextResponse.json(
        {
          success: false,
          message: 'Failed to create pricing option',
          error: dbError instanceof Error ? dbError.message : 'Database error',
        },
        { status: 500 }
      );
    }

    // Get request metadata
    const metadata = getRequestMetadata(req);
    const adminUserId = req.headers.get('x-user-id') || null;

    // Create audit log
    await createAuditLog({
      userId: adminUserId,
      actorType: 'admin',
      action: 'create',
      entityType: 'plan_pricing',
      entityId: newPricing.id,
      entityName: `${plan[0].name} - ${billingCycle}`,
      httpMethod: 'POST',
      endpoint: `/api/admin/plans/${planId}/pricing`,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      details: {
        planId: planId,
        planName: plan[0].name,
        billingCycle: billingCycle,
        price: Number(newPricing.price),
        currency: newPricing.currency,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Pricing option added successfully',
      data: {
        id: newPricing.id,
        billingCycle: newPricing.billingCycle,
        billingPeriodMonths: newPricing.billingPeriodMonths,
        price: Number(newPricing.price),
        currency: newPricing.currency,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating plan pricing:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to create plan pricing',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

