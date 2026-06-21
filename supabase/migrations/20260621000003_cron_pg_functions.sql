-- Migration: Add PG functions with transaction + FOR UPDATE for cron jobs

-- Function: expire_pending_assignments()
-- Uses FOR UPDATE SKIP LOCKED to prevent race conditions with concurrent bookings
CREATE OR REPLACE FUNCTION expire_pending_assignments()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  WITH expired AS (
    SELECT id, availability_slot_id
    FROM assignments
    WHERE status = 'pending'
      AND expires_at IS NOT NULL
      AND expires_at < NOW()
    FOR UPDATE SKIP LOCKED
  ),
  cancelled AS (
    UPDATE assignments
    SET status = 'cancelled',
        cancelled_by = 'system',
        cancelled_at = NOW(),
        cancellation_reason = 'Assignment expired - doctor did not respond within the time limit'
    WHERE id IN (SELECT id FROM expired)
    RETURNING id, availability_slot_id
  ),
  released AS (
    UPDATE doctor_availability
    SET status = 'available',
        booked_by_hospital_id = NULL,
        booked_at = NULL
    WHERE id IN (
      SELECT availability_slot_id
      FROM cancelled
      WHERE availability_slot_id IS NOT NULL
    )
    RETURNING id
  )
  SELECT json_build_object(
    'expired_count', (SELECT count(*) FROM expired),
    'cancelled_count', (SELECT count(*) FROM cancelled),
    'released_slots', (SELECT count(*) FROM released)
  ) INTO result;

  RETURN result;
END;
$$;

-- Function: process_expired_subscriptions()
-- Runs inside a single implicit transaction (BEGIN/COMMIT/ROLLBACK handled by PG)
-- Uses FOR UPDATE to lock rows being processed
CREATE OR REPLACE FUNCTION process_expired_subscriptions()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sub_record RECORD;
  plan_record RECORD;
  pricing_record RECORD;
  new_sub_id UUID;
  results jsonb := '[]'::jsonb;
  doctor_id UUID;
  hospital_id UUID;
  limit_count INT;
  patients_limit INT;
  assignments_limit INT;
  period_start DATE;
  period_end DATE;
  sub_end_date DATE;
  billing_months INT;
BEGIN
  FOR sub_record IN
    SELECT * FROM subscriptions
    WHERE status = 'active'
      AND end_date <= NOW()
      AND plan_change_status = 'pending'
      AND next_plan_id IS NOT NULL
      AND next_pricing_id IS NOT NULL
    FOR UPDATE
  LOOP
    BEGIN
      -- Validate plan exists and is active
      SELECT * INTO plan_record FROM subscription_plans WHERE id = sub_record.next_plan_id;
      IF NOT FOUND OR plan_record.is_active = false THEN
        UPDATE subscriptions SET status = 'expired', plan_change_status = 'failed' WHERE id = sub_record.id;
        results := results || jsonb_build_object('subscription_id', sub_record.id, 'status', 'failed', 'reason', 'Plan no longer exists or inactive');
        CONTINUE;
      END IF;

      -- Validate pricing exists and is active
      SELECT * INTO pricing_record FROM plan_pricing
      WHERE id = sub_record.next_pricing_id
        AND plan_id = sub_record.next_plan_id
        AND is_active = true;

      IF NOT FOUND THEN
        UPDATE subscriptions SET status = 'expired', plan_change_status = 'failed' WHERE id = sub_record.id;
        results := results || jsonb_build_object('subscription_id', sub_record.id, 'status', 'failed', 'reason', 'Pricing no longer exists or inactive');
        CONTINUE;
      END IF;

      billing_months := COALESCE(pricing_record.billing_period_months, 1);

      -- Create new subscription
      INSERT INTO subscriptions (
        user_id, plan_id, pricing_id, status, start_date, end_date,
        auto_renew, billing_period_months
      ) VALUES (
        sub_record.user_id, sub_record.next_plan_id, sub_record.next_pricing_id, 'active',
        sub_record.end_date, sub_record.end_date + (billing_months || ' months')::interval,
        true, billing_months
      ) RETURNING id INTO new_sub_id;

      -- Expire old subscription
      UPDATE subscriptions
      SET status = 'expired',
          replaced_by_subscription_id = new_sub_id,
          next_plan_id = NULL,
          next_pricing_id = NULL,
          plan_change_status = NULL
      WHERE id = sub_record.id;

      -- Generate usage records (always monthly periods, matching original behavior)
      period_start := sub_record.end_date::date;
      sub_end_date := (sub_record.end_date + (billing_months || ' months')::interval)::date;

      WHILE period_start < sub_end_date LOOP
        period_end := (period_start + '1 month'::interval)::date;
        IF period_end > sub_end_date THEN
          period_end := sub_end_date;
        END IF;

        IF plan_record.user_role = 'doctor' THEN
          SELECT id INTO doctor_id FROM doctors WHERE user_id = sub_record.user_id;
          IF FOUND THEN
            SELECT max_assignments_per_month INTO limit_count FROM doctor_plan_features WHERE plan_id = sub_record.next_plan_id;
            limit_count := COALESCE(limit_count, 5);

            INSERT INTO doctor_assignment_usage
              (doctor_id, subscription_id, month, count, limit_count, reset_date, period_start, period_end)
            VALUES
              (doctor_id, new_sub_id, to_char(period_start, 'YYYY-MM'), 0, limit_count, period_end, period_start, period_end)
            ON CONFLICT (subscription_id, period_start) DO NOTHING;
          END IF;

        ELSIF plan_record.user_role = 'hospital' THEN
          SELECT id INTO hospital_id FROM hospitals WHERE user_id = sub_record.user_id;
          IF FOUND THEN
            SELECT max_patients_per_month, max_assignments_per_month
            INTO patients_limit, assignments_limit
            FROM hospital_plan_features
            WHERE plan_id = sub_record.next_plan_id;

            patients_limit := COALESCE(patients_limit, 10);
            assignments_limit := COALESCE(assignments_limit, 20);

            INSERT INTO hospital_usage_tracking
              (hospital_id, subscription_id, month, patients_count, assignments_count, patients_limit, assignments_limit, reset_date, period_start, period_end)
            VALUES
              (hospital_id, new_sub_id, to_char(period_start, 'YYYY-MM'), 0, 0, patients_limit, assignments_limit, period_end, period_start, period_end)
            ON CONFLICT (subscription_id, period_start) DO NOTHING;
          END IF;
        END IF;

        period_start := period_end;
      END LOOP;

      results := results || jsonb_build_object('subscription_id', sub_record.id, 'status', 'success', 'new_subscription_id', new_sub_id);

    EXCEPTION WHEN OTHERS THEN
      results := results || jsonb_build_object('subscription_id', sub_record.id, 'status', 'error', 'error', SQLERRM);
    END;
  END LOOP;

  RETURN json_build_object('processed_count', jsonb_array_length(results), 'results', results);
END;
$$;
