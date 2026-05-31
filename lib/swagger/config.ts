import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Load Swagger spec from pre-generated JSON file
 * This works on Vercel because we're reading a static file, not scanning source files
 */
function loadSwaggerSpec(): any {
  try {
    // Load pre-generated swagger.json from public folder
    const specPath = resolve(process.cwd(), 'public/swagger.json');
    const spec = JSON.parse(readFileSync(specPath, 'utf8'));
    
    // Update server URL dynamically based on environment
    // Priority: FRONTEND_URL > VERCEL_URL > default from file
    if (process.env.FRONTEND_URL) {
      // Use custom FRONTEND_URL if set (highest priority)
      spec.servers = [{ 
        url: process.env.FRONTEND_URL, 
        description: 'API Server' 
      }];
    } else if (process.env.VERCEL_URL) {
      // Vercel provides VERCEL_URL automatically (fallback)
      spec.servers = [{ 
        url: `https://${process.env.VERCEL_URL}`, 
        description: 'API Server' 
      }];
    }
    // Otherwise keep the default from the file
    
    console.log('✅ [SWAGGER] Loaded pre-generated spec from public/swagger.json');
    const pathCount = spec.paths ? Object.keys(spec.paths).length : 0;
    console.log(`📚 [SWAGGER] Spec contains ${pathCount} API paths`);
    
    return spec;
  } catch (error: any) {
    console.error('❌ [SWAGGER] Error loading swagger.json:', error.message);
    console.error('❌ [SWAGGER] Make sure public/swagger.json exists. Run the generate command.');
    
    // Return minimal fallback spec
    return {
      openapi: '3.0.0',
      info: {
        title: 'Hospital Surgeons API',
        version: '1.0.0',
        description: 'API documentation for Hospital Surgeons application',
      },
      servers: [{ 
        url: process.env.FRONTEND_URL 
          || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://hospital-surgoen.onrender.com')
      }],
      paths: {},
    };
  }
}

export const swaggerSpec = loadSwaggerSpec();
