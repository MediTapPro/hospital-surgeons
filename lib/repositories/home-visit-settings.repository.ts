import { getDb } from '@/lib/db';
import { HOME_VISIT_SETTINGS_SCOPE } from '@/lib/utils/constants';
import type { HomeVisitPaymentTiming } from '@/lib/utils/constants';
import { platformHomeVisitSettings } from '@/src/db/drizzle/migrations/schema';
import { eq } from 'drizzle-orm';

export interface HomeVisitSettingsValues {
  homeVisitEnabled: boolean;
  freeTrialEnabled: boolean;
  freeTrialVisitLimit: number;
  freeTrialActiveBookingLimit: number;
  paidPaymentTiming: HomeVisitPaymentTiming;
}

export class HomeVisitSettingsRepository {
  constructor(private db: any = getDb()) {}

  async findGlobal(tx?: any) {
    const client = tx || this.db;
    const [settings] = await client
      .select()
      .from(platformHomeVisitSettings)
      .where(eq(platformHomeVisitSettings.scope, HOME_VISIT_SETTINGS_SCOPE))
      .limit(1);

    return settings ?? null;
  }

  async upsertGlobal(values: HomeVisitSettingsValues, tx?: any) {
    const client = tx || this.db;
    const [settings] = await client
      .insert(platformHomeVisitSettings)
      .values({
        scope: HOME_VISIT_SETTINGS_SCOPE,
        ...values,
      })
      .onConflictDoUpdate({
        target: platformHomeVisitSettings.scope,
        set: {
          ...values,
          updatedAt: new Date().toISOString(),
        },
      })
      .returning();

    return settings;
  }
}
