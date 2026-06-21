import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data, error } = await supabase.rpc('process_expired_subscriptions')

  if (error) {
    console.error('process_expired_subscriptions error:', error)
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const result = data as { processed_count: number; results: any[] }

  return new Response(
    JSON.stringify({
      success: true,
      message: `Processed ${result.processed_count} expired subscriptions`,
      data: result.results,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})
