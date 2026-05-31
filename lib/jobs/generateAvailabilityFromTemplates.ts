import { DoctorsRepository, CreateDoctorAvailabilityData } from '@/lib/repositories/doctors.repository';

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

type TemplateRecord = NonNullable<Awaited<ReturnType<DoctorsRepository['getTemplatesActiveBetween']>>[number]>;

export interface AvailabilityGenerationOptions {
  startDate?: Date;
  endDate?: Date; // Optional end date - if provided, calculates days from startDate to endDate
  days?: number; // Optional days - used if endDate not provided (default: 7)
  doctorIds?: string[];
  templateIds?: string[]; // Optional: generate only for specific templates
}

export interface TemplateGenerationSummary {
  templateId: string;
  doctorId: string;
  templateName: string;
  created: number;
  skippedExisting: number;
  consideredDates: string[];
}

export interface AvailabilityGenerationSummary {
  startDate: string;
  endDate: string;
  templatesProcessed: number;
  slotsCreated: number;
  templates: TemplateGenerationSummary[];
}

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeDays = (days: string[] | undefined) =>
  (days || []).map((day) => day.toLowerCase());

const shouldGenerateOnDate = (template: TemplateRecord, date: Date) => {
  const currentDayName = DAY_NAMES[date.getDay()];
  const recurrenceDays = normalizeDays(template.recurrenceDays as string[]);
  const validFrom = new Date(template.validFrom);
  const validUntil = template.validUntil ? new Date(template.validUntil) : null;

  if (date < validFrom) return false;
  if (validUntil && date > validUntil) return false;

  switch (template.recurrencePattern) {
    case 'daily':
      return true;
    case 'weekly':
    case 'custom':
      return recurrenceDays.includes(currentDayName);
    case 'monthly':
      return date.getDate() === validFrom.getDate();
    default:
      return false;
  }
};

export async function generateAvailabilityFromTemplates(
  options: AvailabilityGenerationOptions = {}
): Promise<AvailabilityGenerationSummary> {
  const doctorsRepository = new DoctorsRepository();
  
  // Determine start date
  const start = startOfDay(options.startDate ?? new Date());
  
  // Determine end date: use endDate if provided, otherwise calculate from days
  let end: Date;
  if (options.endDate) {
    end = startOfDay(options.endDate);
  } else {
    const days = Math.max(1, options.days ?? 7);
    end = addDays(start, days - 1);
  }
  
  // Ensure end is not before start
  if (end < start) {
    end = start;
  }
  
  // Calculate actual days between start and end
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  const startStr = formatDate(start);
  const endStr = formatDate(end);

  const templatesRaw = await doctorsRepository.getTemplatesActiveBetween(startStr, endStr);
  const templates = (templatesRaw.filter(Boolean) as TemplateRecord[]).filter((template) => {
    // Filter by doctor IDs if provided
    if (options.doctorIds && !options.doctorIds.includes(template.doctorId)) {
      return false;
    }
    // Filter by template IDs if provided
    if (options.templateIds && !options.templateIds.includes(template.id)) {
      return false;
    }
    return true;
  });

  const summary: AvailabilityGenerationSummary = {
    startDate: startStr,
    endDate: endStr,
    templatesProcessed: templates.length,
    slotsCreated: 0,
    templates: [],
  };

  for (const template of templates) {
    const templateSummary: TemplateGenerationSummary = {
      templateId: template.id,
      doctorId: template.doctorId,
      templateName: template.templateName,
      created: 0,
      skippedExisting: 0,
      consideredDates: [],
    };

    for (let offset = 0; offset < days; offset++) {
      const candidateDate = addDays(start, offset);
      if (!shouldGenerateOnDate(template, candidateDate)) {
        continue;
      }

      const slotDate = formatDate(candidateDate);
      templateSummary.consideredDates.push(slotDate);

      // Check if doctor is on leave on this date
      const isOnLeave = await doctorsRepository.isDateOnLeave(template.doctorId, slotDate);
      if (isOnLeave) {
        templateSummary.skippedExisting += 1;
        continue;
      }

      // Check for exact duplicate slot from same template (prevent duplicates)
      const hasExactDuplicate = await doctorsRepository.hasExactAvailabilitySlot(
        template.doctorId,
        slotDate,
        template.startTime,
        template.endTime,
        template.id
      );

      if (hasExactDuplicate) {
        templateSummary.skippedExisting += 1;
        continue;
      }

      // Check for overlapping availability slots (prevent time conflicts)
      const hasOverlap = await doctorsRepository.hasAvailabilityOverlap(
        template.doctorId,
        slotDate,
        template.startTime,
        template.endTime
      );

      if (hasOverlap) {
        templateSummary.skippedExisting += 1;
        continue;
      }

      const availabilityPayload: CreateDoctorAvailabilityData = {
        slotDate,
        startTime: template.startTime,
        endTime: template.endTime,
        templateId: template.id,
        status: 'available',
        isManual: false,
        notes: `Auto-generated from template ${template.templateName}`,
        parentSlotId: null, // Parent slots have NULL parentSlotId
      };

      try {
        await doctorsRepository.createAvailability(availabilityPayload, template.doctorId);
        templateSummary.created += 1;
        summary.slotsCreated += 1;
      } catch (error: any) {
        // Handle race condition: if slot was created by another request between check and insert
        // PostgreSQL unique constraint violation (23505) or other duplicate errors
        if (error?.code === '23505' || error?.message?.includes('duplicate') || error?.message?.includes('unique')) {
          // Slot already exists (likely created by concurrent request), skip it
          templateSummary.skippedExisting += 1;
        } else {
          // Re-throw other errors
          throw error;
        }
      }
    }

    summary.templates.push(templateSummary);
  }

  return summary;
}


