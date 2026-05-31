/**
 * Distance calculation utilities
 * Uses Haversine formula to calculate distance between two coordinates
 */

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in kilometers, or null if coordinates are invalid
 */
export function calculateDistance(
  lat1: number | null | undefined,
  lon1: number | null | undefined,
  lat2: number | null | undefined,
  lon2: number | null | undefined
): number | null {
  // Handle null/undefined coordinates
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) {
    return null;
  }

  // Validate coordinates are numbers
  if (typeof lat1 !== 'number' || typeof lon1 !== 'number' || 
      typeof lat2 !== 'number' || typeof lon2 !== 'number') {
    return null;
  }

  // Validate coordinate ranges
  if (lat1 < -90 || lat1 > 90 || lat2 < -90 || lat2 > 90) {
    return null;
  }
  if (lon1 < -180 || lon1 > 180 || lon2 < -180 || lon2 > 180) {
    return null;
  }

  // Earth's radius in kilometers
  const R = 6371;

  // Convert degrees to radians
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  // Haversine formula
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  // Round to 2 decimal places
  return Math.round(distance * 100) / 100;
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}
