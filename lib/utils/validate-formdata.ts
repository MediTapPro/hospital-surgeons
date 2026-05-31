import { z, ZodError } from 'zod';
import { NextResponse } from 'next/server';

/**
 * Validates FormData fields against a Zod schema
 * Returns validated data or error response
 */
export function validateFormData<T>(
  formData: FormData,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; response: NextResponse } {
  try {
    // Convert FormData to object
    const data: Record<string, any> = {};
    formData.forEach((value, key) => {
      // If key already exists, convert to array
      if (data[key]) {
        const existing = data[key];
        data[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
      } else {
        data[key] = value;
      }
    });

    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof ZodError) {
      // Format Zod errors into user-friendly messages
      const errors = error.issues.map((err) => {
        const path = err.path.join('.');
        return `${path}: ${err.message}`;
      });

      return {
        success: false,
        response: NextResponse.json(
          {
            success: false,
            message: 'Validation failed',
            errors: errors,
            details: error.issues,
          },
          { status: 400 }
        ),
      };
    }

    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          message: 'Invalid form data',
        },
        { status: 400 }
      ),
    };
  }
}

