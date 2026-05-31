import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getDb } from '@/lib/db';
import { paymentTransactions } from '@/src/db/drizzle/migrations/schema';
import { eq, desc, sql } from 'drizzle-orm';

async function getHandler(req: AuthenticatedRequest) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'User not authenticated' },
        { status: 401 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20;
    const offset = (page - 1) * limit;

    // Fetch payment transactions - query only from paymentTransactions table
    const transactions = await getDb()
      .select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.userId, userId))
      .orderBy(desc(paymentTransactions.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const totalResult = await getDb()
      .select({ count: sql<number>`count(*)` })
      .from(paymentTransactions)
      .where(eq(paymentTransactions.userId, userId));

    const total = Number(totalResult[0]?.count || 0);

    // Format response - only from paymentTransactions table
    const formattedTransactions = transactions.map((transaction) => {
      // Build description from transaction data
      let description = 'Payment';
      if (transaction.gatewayResponse && typeof transaction.gatewayResponse === 'object') {
        const gatewayData = transaction.gatewayResponse as any;
        if (gatewayData.notes?.planId || gatewayData.description) {
          description = gatewayData.description || 'Subscription Payment';
        }
      }

      return {
        id: transaction.id,
        transactionId: transaction.paymentId,
        orderId: transaction.orderId,
        amount: Number(transaction.amount), // Already in rupees
        currency: transaction.currency,
        status: transaction.status, // 'success', 'pending', 'failed', 'refunded'
        paymentMethod: transaction.paymentMethod,
        paymentGateway: transaction.paymentGateway,
        gatewayName: transaction.gatewayName,
        gatewayPaymentId: transaction.gatewayPaymentId,
        gatewayOrderId: transaction.gatewayOrderId,
        createdAt: transaction.createdAt,
        verifiedAt: transaction.verifiedAt,
        verifiedVia: transaction.verifiedVia,
        planId: transaction.planId,
        pricingId: transaction.pricingId,
        subscriptionId: transaction.subscriptionId,
        description,
      };
    });

    return NextResponse.json({
      success: true,
      data: formattedTransactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Fetch transactions error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler);

