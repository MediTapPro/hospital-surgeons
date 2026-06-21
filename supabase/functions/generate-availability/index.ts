import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function formatDate(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function shouldGenerateOnDate(template: any, date: Date) {
  const currentDayName = DAY_NAMES[date.getDay()]
  const recurrenceDays = (template.recurrence_days || []).map((d: string) => d.toLowerCase())
  const validFrom = new Date(template.valid_from)
  const validUntil = template.valid_until ? new Date(template.valid_until) : null

  if (date < validFrom) return false
  if (validUntil && date > validUntil) return false

  switch (template.recurrence_pattern) {
    case 'daily':
      return true
    case 'weekly':
    case 'custom':
      return recurrenceDays.includes(currentDayName)
    case 'monthly':
      return date.getDate() === validFrom.getDate()
    default:
      return false
  }
}

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const start = startOfDay(new Date())
  const end = addDays(start, 6)
  const startStr = formatDate(start)
  const endStr = formatDate(end)
  const days = 7

  // Get active templates
  const { data: templates, error: tmplError } = await supabase
    .from('availability_templates')
    .select('*')
    .lte('valid_from', endStr)
    .or(`valid_until.is.null,valid_until.gte.${startStr}`)

  if (tmplError) {
    console.error('templates query error:', tmplError)
    return new Response(JSON.stringify({ success: false, error: tmplError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const summary = {
    startDate: startStr,
    endDate: endStr,
    templatesProcessed: templates?.length || 0,
    slotsCreated: 0,
    templates: [] as any[],
  }

  for (const template of templates || []) {
    const templateSummary = {
      templateId: template.id,
      doctorId: template.doctor_id,
      templateName: template.template_name,
      created: 0,
      skippedExisting: 0,
      consideredDates: [] as string[],
    }

    for (let offset = 0; offset < days; offset++) {
      const candidateDate = addDays(start, offset)
      if (!shouldGenerateOnDate(template, candidateDate)) continue

      const slotDate = formatDate(candidateDate)
      templateSummary.consideredDates.push(slotDate)

      // Check if doctor is on leave
      const { data: leaveData } = await supabase
        .from('doctor_leaves')
        .select('id')
        .eq('doctor_id', template.doctor_id)
        .lte('start_date', slotDate)
        .gte('end_date', slotDate)
        .limit(1)

      if (leaveData && leaveData.length > 0) {
        templateSummary.skippedExisting += 1
        continue
      }

      // Check for exact duplicate
      const { data: exactDup } = await supabase
        .from('doctor_availability')
        .select('id')
        .eq('doctor_id', template.doctor_id)
        .eq('slot_date', slotDate)
        .eq('start_time', template.start_time)
        .eq('end_time', template.end_time)
        .eq('template_id', template.id)
        .is('parent_slot_id', null)
        .limit(1)

      if (exactDup && exactDup.length > 0) {
        templateSummary.skippedExisting += 1
        continue
      }

      // Check for overlap
      const { data: overlap } = await supabase
        .from('doctor_availability')
        .select('id')
        .eq('doctor_id', template.doctor_id)
        .eq('slot_date', slotDate)
        .is('parent_slot_id', null)
        .lt('start_time', template.end_time)
        .gt('end_time', template.start_time)
        .limit(1)

      if (overlap && overlap.length > 0) {
        templateSummary.skippedExisting += 1
        continue
      }

      // Create slot
      const { error: createError } = await supabase
        .from('doctor_availability')
        .insert({
          doctor_id: template.doctor_id,
          slot_date: slotDate,
          start_time: template.start_time,
          end_time: template.end_time,
          template_id: template.id,
          status: 'available',
          is_manual: false,
          notes: `Auto-generated from template ${template.template_name}`,
          parent_slot_id: null,
        })

      if (createError) {
        if (createError.code === '23505' || createError.message?.includes('duplicate') || createError.message?.includes('unique')) {
          templateSummary.skippedExisting += 1
        } else {
          console.error(`Create slot error for template ${template.id}:`, createError)
          templateSummary.skippedExisting += 1
        }
      } else {
        templateSummary.created += 1
        summary.slotsCreated += 1
      }
    }

    summary.templates.push(templateSummary)
  }

  return new Response(JSON.stringify({ success: true, data: summary }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
