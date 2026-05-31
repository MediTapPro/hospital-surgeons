/**
 * PostGIS utility functions for fixed radius queries
 * Supports distance-based filtering and counting in PostgreSQL
 */

import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';

/**
 * Check if PostGIS extension is installed
 */
export async function isPostGISInstalled(): Promise<boolean> {
  try {
    const db = getDb();
    const result = await db.execute(sql`
      SELECT EXISTS(
        SELECT 1 
        FROM pg_extension 
        WHERE extname = 'postgis'
      ) as installed
    `);
    
    return result.rows[0]?.installed === true;
  } catch (error) {
    return false;
  }
}

/**
 * Fixed radius for simple pagination (in kilometers)
 */
export const FIXED_RADIUS_KM = 50;

/**
 * Get PostGIS point from latitude and longitude
 */
function getPostGISPoint(lat: number, lon: number): string {
  return `ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)`;
}

/**
 * Count doctors within fixed radius (50km) with location
 * Excludes doctors without location
 */
export async function countDoctorsInFixedRadius(
  hospitalLat: number,
  hospitalLon: number,
  radiusKm: number,
  baseWhereClause: any
): Promise<number> {
  const db = getDb();
  const hospitalPoint = getPostGISPoint(hospitalLat, hospitalLon);
  const radiusMeters = radiusKm * 1000;
  
  const countQuery = sql`
    SELECT COUNT(DISTINCT d.id) as total
    FROM doctors d
      WHERE 1=1 ${baseWhereClause}
    AND d.latitude IS NOT NULL
    AND d.longitude IS NOT NULL
    AND ST_DWithin(
      ST_SetSRID(ST_MakePoint(d.longitude::numeric, d.latitude::numeric), 4326)::geography,
      ${sql.raw(hospitalPoint)}::geography,
      ${radiusMeters}
    )
  `;
  
  try {
    const result = await db.execute(countQuery);
    return parseInt(String(result.rows[0]?.total || '0'), 10);
  } catch (error) {
    console.error('Error counting doctors in fixed radius:', error);
    return 0;
  }
}

/**
 * Fetch doctors within fixed radius with OFFSET/LIMIT pagination
 * Excludes doctors without location
 * Uses standard SQL pagination for efficient querying
 */
export async function fetchDoctorsInFixedRadius(
  hospitalLat: number,
  hospitalLon: number,
  radiusKm: number,
  baseWhereClause: any,
  limit: number,
  offset: number,
  favoriteDoctorIds: string[] = []
): Promise<any[]> {
  const db = getDb();
  const hospitalPoint = getPostGISPoint(hospitalLat, hospitalLon);
  const radiusMeters = radiusKm * 1000;
  
  // Calculate distance in kilometers for each doctor
  const distanceExpr = sql`
    ST_Distance(
      ST_SetSRID(ST_MakePoint(d.longitude::numeric, d.latitude::numeric), 4326)::geography,
      ${sql.raw(hospitalPoint)}::geography
    ) / 1000.0
  `;
  
  // Single optimized query with favorite prioritization using CASE in ORDER BY
  if (favoriteDoctorIds.length > 0) {
    console.log('Fetching doctors with favorite prioritization');
    // Build array literal for PostgreSQL ANY clause
    const favoriteArrayLiteral = `ARRAY[${favoriteDoctorIds.map(id => `'${id}'::uuid`).join(', ')}]`;
    
    const query = sql`
      SELECT 
        d.id,
        d.first_name as "firstName",
        d.last_name as "lastName",
        d.years_of_experience as "yearsOfExperience",
        d.average_rating as "averageRating",
        d.total_ratings as "totalRatings",
        d.completed_assignments as "completedAssignments",
        d.license_verification_status as "licenseVerificationStatus",
        d.latitude,
        d.longitude,
        (${distanceExpr}) as distance,
        (
          SELECT json_agg(json_build_object('id', s.id, 'name', s.name))
          FROM specialties s 
          INNER JOIN doctor_specialties ds ON s.id = ds.specialty_id 
          WHERE ds.doctor_id = d.id
        ) as specialties,
        (
          SELECT f.url
          FROM files f
          WHERE f.id = d.profile_photo_id
        ) as photo
      FROM doctors d
        WHERE 1=1 ${baseWhereClause}
      AND d.latitude IS NOT NULL
      AND d.longitude IS NOT NULL
      AND ST_DWithin(
        ST_SetSRID(ST_MakePoint(d.longitude::numeric, d.latitude::numeric), 4326)::geography,
        ${sql.raw(hospitalPoint)}::geography,
        ${radiusMeters}
      )
      ORDER BY 
        CASE WHEN d.id = ANY(${sql.raw(favoriteArrayLiteral)}) THEN 0 ELSE 1 END ASC,
        distance ASC,
        id ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `;
    
    try {
      const result = await db.execute(query);
      return result.rows || [];
    } catch (error) {
      console.error('Error fetching doctors in fixed radius:', error);
      return [];
    }
  } else {
    // No favorites - just return all doctors sorted by distance
    const query = sql`
      SELECT 
        d.id,
        d.first_name as "firstName",
        d.last_name as "lastName",
        d.years_of_experience as "yearsOfExperience",
        d.average_rating as "averageRating",
        d.total_ratings as "totalRatings",
        d.completed_assignments as "completedAssignments",
        d.license_verification_status as "licenseVerificationStatus",
        d.latitude,
        d.longitude,
        (${distanceExpr}) as distance,
        (
          SELECT json_agg(json_build_object('id', s.id, 'name', s.name))
          FROM specialties s 
          INNER JOIN doctor_specialties ds ON s.id = ds.specialty_id 
          WHERE ds.doctor_id = d.id
        ) as specialties,
        (
          SELECT f.url
          FROM files f
          WHERE f.id = d.profile_photo_id
        ) as photo
      FROM doctors d
        WHERE 1=1 ${baseWhereClause}
      AND d.latitude IS NOT NULL
      AND d.longitude IS NOT NULL
      AND ST_DWithin(
        ST_SetSRID(ST_MakePoint(d.longitude::numeric, d.latitude::numeric), 4326)::geography,
        ${sql.raw(hospitalPoint)}::geography,
        ${radiusMeters}
      )
      ORDER BY distance ASC, id ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `;
    
      try {
        const result = await db.execute(query);
    console.log('Fetched doctors count:', result.rows.length);
        return result.rows || [];
      } catch (error) {
      console.error('Error fetching doctors in fixed radius:', error);
      return [];
    }
  }
}
