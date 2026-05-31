export interface GeocodedLocation {
  latitude: number;
  longitude: number;
}

export interface LocationComponents {
  fullAddress?: string;
  city?: string;
  state?: string;
  pincode?: string;
  primaryLocation?: string; // Fallback to original location string
}



/**
 * Attempts geocoding with a specific query string
 */
async function attemptGeocode(query: string): Promise<GeocodedLocation | null> {
  if (!query || !query.trim()) return null;

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      query.trim(),
    )}&limit=1&addressdetails=1`;

    const res = await fetch(url, {
      headers: {
        // Nominatim requires a valid User-Agent identifying the application
        'User-Agent': 'hospital-surgeons-app/1.0 (contact: admin@hospital-surgeons.local)',
      },
    });

    if (!res.ok) {
      return null;
    }

    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!Array.isArray(data) || !data[0]) return null;

    const lat = parseFloat(data[0].lat);
    const lon = parseFloat(data[0].lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return null;

    return { 
      latitude: lat, 
      longitude: lon,
    };
  } catch (err) {
    return null;
  }
}

/**
 * Enhanced geocoding helper using OpenStreetMap Nominatim with fallback strategy.
 * Uses parsed address components (city, state, pincode, full_address) for better accuracy.
 * Falls back to simpler queries if the full query fails.
 */
export async function geocodeLocation(
  queryOrComponents: string | LocationComponents
): Promise<GeocodedLocation | null> {
  let components: LocationComponents | null = null;

  // Handle both string (backward compatibility) and object (new format)
  if (typeof queryOrComponents === 'string') {
    const query = queryOrComponents.trim();
    if (!query) return null;
    // For string input, try direct geocoding
    return await attemptGeocode(query);
  } else {
    components = queryOrComponents;
  }

  if (!components) return null;

  // Try geocoding with progressively simpler queries (fallback strategy)
  const queries: string[] = [];

  // 1. Full address with all components
  if (components.fullAddress && components.city && components.state && components.pincode) {
    console.log('fullAddress', components.fullAddress, 'city', components.city, 'state', components.state, 'pincode', components.pincode);
    queries.push(`${components.fullAddress}, ${components.city}, ${components.state}, ${components.pincode}`);
  }

  // 2. City + State + Pincode
  if (components.city && components.state && components.pincode) {
    console.log('city', components.city, 'state', components.state, 'pincode', components.pincode);
    queries.push(`${components.city}, ${components.state}, ${components.pincode}`);
  }

  // 3. Full address + City + State (without pincode)
  if (components.fullAddress && components.city && components.state) {
    queries.push(`${components.fullAddress}, ${components.city}, ${components.state}`);
  }

  // 4. City + State
  if (components.city && components.state) {
    queries.push(`${components.city}, ${components.state}`);
  }

  // 5. City + Pincode
  if (components.city && components.pincode) {
    queries.push(`${components.city}, ${components.pincode}`);
  }

  // 6. Pincode only
  if (components.pincode) {
    queries.push(components.pincode);
  }

  // 7. City only
  if (components.city) {
    queries.push(components.city);
  }

  // 8. State only
  if (components.state) {
    queries.push(components.state);
  }

  // Try each query in order until one succeeds
  for (const query of queries) {
    const result = await attemptGeocode(query);
    if (result) {
      return result;
    }
  }

  // If all queries fail, return null
  return null;
}


