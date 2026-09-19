import {
  HOME_VISIT_PAYMENT_TIMINGS,
  type HomeVisitPaymentTiming,
} from '@/lib/utils/constants';
import {
  HomeVisitSettingsRepository,
  type HomeVisitSettingsValues,
} from '@/lib/repositories/home-visit-settings.repository';

const DEFAULT_HOME_VISIT_SETTINGS: HomeVisitSettingsValues = {
  homeVisitEnabled: true,
  freeTrialEnabled: true,
  freeTrialVisitLimit: 1,
  freeTrialActiveBookingLimit: 1,
  paidPaymentTiming: 'pay_after_completion',
  allowEarlyAssignmentCompletion: false,
};

const paymentTimings = new Set<string>(
  HOME_VISIT_PAYMENT_TIMINGS.map((timing) => timing.value)
);

export class HomeVisitSettingsService {
  private repository = new HomeVisitSettingsRepository();

  async getSettings(tx?: any) {
    try {
      const settings = await this.repository.findGlobal(tx);
      const data = settings && settings.paidPaymentTiming === 'pay_after_completion'
        ? settings
        : await this.repository.upsertGlobal(
            settings
              ? {
                  homeVisitEnabled: settings.homeVisitEnabled,
                  freeTrialEnabled: settings.freeTrialEnabled,
                  freeTrialVisitLimit: settings.freeTrialVisitLimit,
                  freeTrialActiveBookingLimit: settings.freeTrialActiveBookingLimit,
                  paidPaymentTiming: DEFAULT_HOME_VISIT_SETTINGS.paidPaymentTiming,
                  allowEarlyAssignmentCompletion: settings.allowEarlyAssignmentCompletion,
                }
              : DEFAULT_HOME_VISIT_SETTINGS,
            tx
          );

      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve home visit settings',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async updateSettings(values: HomeVisitSettingsValues) {
    if (
      typeof values.homeVisitEnabled !== 'boolean'
      || typeof values.freeTrialEnabled !== 'boolean'
      || typeof values.allowEarlyAssignmentCompletion !== 'boolean'
    ) {
      return {
        success: false,
        message: 'Boolean platform settings must be true or false.',
      };
    }

    if (!Number.isInteger(values.freeTrialVisitLimit) || values.freeTrialVisitLimit < 0) {
      return {
        success: false,
        message: 'Free trial visit limit must be a whole number of zero or more.',
      };
    }

    if (!Number.isInteger(values.freeTrialActiveBookingLimit) || values.freeTrialActiveBookingLimit < 1) {
      return {
        success: false,
        message: 'Active free-trial booking limit must be at least one.',
      };
    }

    if (!paymentTimings.has(values.paidPaymentTiming)) {
      return {
        success: false,
        message: 'Invalid paid booking payment timing.',
      };
    }

    try {
      const data = await this.repository.upsertGlobal(values);

      return {
        success: true,
        message: 'Home visit settings updated successfully',
        data,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to update home visit settings',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
