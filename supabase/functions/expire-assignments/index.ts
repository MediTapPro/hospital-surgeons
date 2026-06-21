import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data, error } = await supabase.rpc('expire_pending_assignments')

  if (error) {
    console.error('expire_pending_assignments error:', error)
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const result = data as { expired_count: number; cancelled_count: number; released_slots: number }

  return new Response(
    JSON.stringify({
      success: true,
      message: `Cancelled ${result.cancelled_count} expired assignments, released ${result.released_slots} slots`,
      data: {
        expiredCount: result.expired_count,
        cancelledCount: result.cancelled_count,
        releasedSlots: result.released_slots,
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})
