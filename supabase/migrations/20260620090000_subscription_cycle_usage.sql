-- Migration: Add subscription-cycle-aligned usage tracking columns

-- Add new columns for subscription-cycle alignment
ALTER TABLE doctor_assignment_usage
  ADD COLUMN subscription_id UUID REFERENCES subscriptions(id),
  ADD COLUMN period_start TIMESTAMPTZ,
  ADD COLUMN period_end TIMESTAMPTZ;

ALTER TABLE hospital_usage_tracking
  ADD COLUMN subscription_id UUID REFERENCES subscriptions(id),
  ADD COLUMN period_start TIMESTAMPTZ,
  ADD COLUMN period_end TIMESTAMPTZ;

-- Drop old calendar-month unique constraints (conflict with subscription-cycle records)
ALTER TABLE doctor_assignment_usage
  DROP CONSTRAINT IF EXISTS doctor_assignment_usage_doctor_id_month_key;

ALTER TABLE hospital_usage_tracking
  DROP CONSTRAINT IF EXISTS hospital_usage_tracking_hospital_id_month_key;

-- Add new unique constraints scoped to subscription + period
ALTER TABLE doctor_assignment_usage
  ADD CONSTRAINT doctor_assignment_usage_sub_period_key UNIQUE (subscription_id, period_start);

ALTER TABLE hospital_usage_tracking
  ADD CONSTRAINT hospital_usage_tracking_sub_period_key UNIQUE (subscription_id, period_start);

CREATE INDEX IF NOT EXISTS idx_dau_subscription ON doctor_assignment_usage(subscription_id);
CREATE INDEX IF NOT EXISTS idx_dau_period ON doctor_assignment_usage(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_hut_subscription ON hospital_usage_tracking(subscription_id);
CREATE INDEX IF NOT EXISTS idx_hut_period ON hospital_usage_tracking(period_start, period_end);
