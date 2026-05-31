import { z, ZodError } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Standardized error response format
 */
interface ValidationErrorResponse {
  error: {
    code: string;
    type: string;
    message: string;
    field?: string;
  };
}

/**
 * Generate user-friendly error message based on error code and field
 */
function getUserFriendlyMessage(code: string, field: string, zodMessage: string): string {
  const fieldLabel = field.replace(/_/g, ' ').charAt(0).toUpperCase() + field.slice(1);

  if (code === '100') {
    return `${fieldLabel} is required`;
  } else if (code === '102') {
    return `${fieldLabel} format is invalid`;
  } else if (code === '103') {
    return `${fieldLabel} value is not allowed`;
  } else if (code === '104') {
    // Parse Zod message for length requirements
    if (zodMessage.includes('too small')) {
      return `${fieldLabel} is too short`;
    } else if (zodMessage.includes('too big')) {
      return `${fieldLabel} is too long`;
    }
    return `${fieldLabel} length is invalid`;
  }

  return zodMessage; // Fallback to original message
}

/**
 * Create standardized validation error
 */
function createValidationError(
  code: string,
  message: string,
  field?: string
): ValidationErrorResponse {
  // Generate user-friendly message if field is provided
  const userMessage = field ? getUserFriendlyMessage(code, field, message) : message;

  return {
    error: {
      code,
      type: 'VALIDATION_ERROR',
      message: userMessage,
      ...(field && { field }),
    },
  };
}

/**
 * Validates request body against a Zod schema
 * Returns validated data or error response in standardized format
 * Error codes: 100=missing, 102=format, 103=value, 104=length
 */
export async function validateRequest<T>(
  req: NextRequest,
  schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; response: NextResponse }> {
  try {
    const body = await req.json();
    const validated = schema.parse(body);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof ZodError) {
      // Convert first Zod error to standardized format
      const firstError = error.issues[0];
      const fieldName = firstError.path.join('.');
      
      // Determine error code based on Zod error code
      let errorCode = '102'; // Default to INVALID_FORMAT
      
      if (firstError.code === 'invalid_type') {
        // Check if it's a missing field (expected but not provided)
        errorCode = '100'; // MISSING_REQUIRED_FIELD
      } else if (firstError.code === 'too_small' || firstError.code === 'too_big') {
        errorCode = '104'; // INVALID_LENGTH
      } else if (firstError.code === 'invalid_value') {
        errorCode = '103'; // INVALID_VALUE
      }
      
      // Create standardized error response
      const validationError = createValidationError(
        errorCode,
        firstError.message,
        fieldName
      );

      return {
        success: false,
        response: NextResponse.json(validationError, { status: 400 }),
      };
    }

    // Handle JSON parse errors
    const error_response = createValidationError(
      '102',
      'Invalid JSON in request body'
    );
    
    return {
      success: false,
      response: NextResponse.json(error_response, { status: 400 }),
    };
  }
}

/**
 * Validates query parameters against a Zod schema
 */
export function validateQuery<T>(
  searchParams: URLSearchParams,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; response: NextResponse } {
  try {
    // Convert URLSearchParams to object
    const query: Record<string, string | string[]> = {};
    searchParams.forEach((value, key) => {
      if (query[key]) {
        // If key already exists, convert to array
        const existing = query[key];
        query[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
      } else {
        query[key] = value;
      }
    });

    const validated = schema.parse(query);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = error.issues.map((err) => {
        const path = err.path.join('.');
        return `${path}: ${err.message}`;
      });

      return {
        success: false,
        response: NextResponse.json(
          {
            success: false,
            message: 'Invalid query parameters',
            errors: errors,
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
          message: 'Invalid query parameters',
        },
        { status: 400 }
      ),
    };
  }
}

