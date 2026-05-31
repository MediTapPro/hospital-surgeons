import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { doctors, doctorSpecialties, specialties, doctorAvailability, hospitals, subscriptions, subscriptionPlans, users, doctorPlanFeatures, hospitalPlanFeatures } from '@/src/db/drizzle/migrations/schema';
import { eq, and, or, sql, desc, asc, gte, inArray, isNull, ne } from 'drizzle-orm';
import { calculateDoctorScore, sortDoctorsByScore, type DoctorScoringData } from '@/lib/utils/doctor-scoring';
import { isPostGISInstalled, countDoctorsInFixedRadius, fetchDoctorsInFixedRadius, FIXED_RADIUS_KM } from '@/lib/utils/postgis';

/**
 * @swagger
 * /api/hospitals/{id}/find-doctors:
 *   get:
 *     summary: Find available doctors for a hospital within a radius
 *     tags: [Hospitals]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Hospital ID
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by doctor name or specialty
 *       - in: query
 *         name: specialtyId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Specialty ID (can be specified multiple times)
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Appointment date (YYYY-MM-DD)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of doctors per page
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *           format: float
 *           default: 50
 *           minimum: 1
 *           maximum: 100
 *         description: Search radius in kilometers (defaults to hospital's maxSearchDistanceKm preference, or 50km if not set)
 *       - in: query
 *         name: lat
 *         schema:
 *           type: number
 *           format: float
 *         description: Optional latitude to override hospital location for this search (both lat & lon must be provided)
 *       - in: query
 *         name: lon
 *         schema:
 *           type: number
 *           format: float
 *         description: Optional longitude to override hospital location for this search (both lat & lon must be provided)
 *       - in: query
 *         name: onlyFavorites
 *         schema:
 *           type: boolean
 *         description: When true, return only doctors favorited by the requesting hospital (requires auth)
 *     responses:
 *       200:
 *         description: List of available doctors
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     doctors:
 *                       type: array
 *                       items:
 *                         type: object
 *                     hospitalSubscription:
 *                       type: string
 *                       enum: [free, basic, premium, enterprise]
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *                         hasNextPage:
 *                           type: boolean
 *                         hasPrevPage:
 *                           type: boolean
 *                     searchCenter:
 *                       type: object
 *                       properties:
 *                         lat:
 *                           type: number
 *                           format: float
 *                         lon:
 *                           type: number
 *                           format: float
 *                         overrideUsed:
 *                           type: boolean
 *       500:
 *         description: Internal server error
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const hospitalId = params.id;
    
    // Validate UUID format - return empty data for placeholder
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(hospitalId) || hospitalId === 'hospital-id-placeholder') {
      return NextResponse.json({
        success: true,
        data: {
          doctors: [],
          hospitalSubscription: 'free',
        },
      });
    }
    
    const db = getDb();
    const searchParams = req.nextUrl.searchParams;

    const searchText = searchParams.get('search') || undefined;
    // Support multiple specialty IDs
    const specialtyIds = searchParams.getAll('specialtyId'); // Gets all values for 'specialtyId'
    const date = searchParams.get('date') || undefined;
    
    // Debug: Log search parameters
    console.log('🔍 Find-doctors search params:', { searchText, specialtyIds, date });
    
    // Pagination parameters
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10); // Default 20 per page
    const offset = (page - 1) * limit;
    
    // Fetch hospital preferences to get maxSearchDistanceKm and preferredDoctorIds
    const { hospitalPreferences } = await import('@/src/db/drizzle/migrations/schema');
    const hospitalPrefs = await db
      .select({ 
        maxSearchDistanceKm: hospitalPreferences.maxSearchDistanceKm,
        preferredDoctorIds: hospitalPreferences.preferredDoctorIds
      })
      .from(hospitalPreferences)
      .where(eq(hospitalPreferences.hospitalId, hospitalId))
      .limit(1);
    
    // Get default radius from hospital preferences, fallback to FIXED_RADIUS_KM (50km)
    const defaultRadiusKm = hospitalPrefs[0]?.maxSearchDistanceKm ?? FIXED_RADIUS_KM;

    // Radius parameter (in kilometers) - use hospital preference if not provided from frontend
    const radiusFromQuery = searchParams.get('radius');
    const radiusKm = radiusFromQuery 
      ? parseFloat(radiusFromQuery) 
      : defaultRadiusKm;
    // Validate radius (minimum 1km, maximum 100km)
    const validRadiusKm = Math.max(1, Math.min(100, radiusKm)) || defaultRadiusKm;

    // Get hospital's subscription tier, premium doctor access, and location
    const hospitalResult = await db
      .select({
        userId: hospitals.userId,
        latitude: hospitals.latitude,
        longitude: hospitals.longitude,
      })
      .from(hospitals)
      .where(eq(hospitals.id, hospitalId))
      .limit(1);

    // Extract hospital coordinates (convert numeric to number if needed)
    let hospitalLat = hospitalResult[0]?.latitude 
      ? (typeof hospitalResult[0].latitude === 'string' ? parseFloat(hospitalResult[0].latitude) : Number(hospitalResult[0].latitude))
      : null;
    let hospitalLon = hospitalResult[0]?.longitude
      ? (typeof hospitalResult[0].longitude === 'string' ? parseFloat(hospitalResult[0].longitude) : Number(hospitalResult[0].longitude))
      : null;

    // Optional override: allow frontend to pass lat/lon query params to search around a point
    const latParam = searchParams.get('lat');
    const lonParam = searchParams.get('lon');
    let overrideUsed = false;
    if (latParam != null || lonParam != null) {
      // require both to be present
      if (latParam && lonParam) {
        const parsedLat = Number(latParam);
        const parsedLon = Number(lonParam);
        const isValidLat = Number.isFinite(parsedLat) && parsedLat >= -90 && parsedLat <= 90;
        const isValidLon = Number.isFinite(parsedLon) && parsedLon >= -180 && parsedLon <= 180;
        if (isValidLat && isValidLon) {
          // round to 6 decimals to reduce cardinality and for safety
          hospitalLat = Math.round(parsedLat * 1e6) / 1e6;
          hospitalLon = Math.round(parsedLon * 1e6) / 1e6;
          overrideUsed = true;
        } else {
          console.warn('Invalid lat/lon override provided, ignoring:', latParam, lonParam);
        }
      } else {
        console.warn('Incomplete lat/lon override provided, ignoring. Both lat and lon required.');
      }
    }

    let hospitalSubscriptionTier: 'free' | 'basic' | 'premium' | 'enterprise' = 'free';
    let includesPremiumDoctors = false;
    console.log(hospitalResult[0], 'hospitalResult');
    
    if (hospitalResult[0]?.userId) {
      const subscriptionResult = await db
        .select({
          tier: subscriptionPlans.tier,
          planId: subscriptionPlans.id,
        })
        .from(subscriptions)
        .innerJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
        .where(
          and(
            eq(subscriptions.userId, hospitalResult[0].userId),
            eq(subscriptions.status, 'active')
          )
        )
        .limit(1);

      if (subscriptionResult[0]?.tier) {
        // Use database tier directly - no mapping needed
        const tier = subscriptionResult[0].tier;
        if (['free', 'basic', 'premium', 'enterprise'].includes(tier)) {
          hospitalSubscriptionTier = tier as 'free' | 'basic' | 'premium' | 'enterprise';
        }

        // Check if hospital has premium doctor access
        const hospitalFeatures = await db
          .select({
            includesPremiumDoctors: hospitalPlanFeatures.includesPremiumDoctors,
          })
          .from(hospitalPlanFeatures)
          .where(eq(hospitalPlanFeatures.planId, subscriptionResult[0].planId))
          .limit(1);

        if (hospitalFeatures.length > 0) {
          includesPremiumDoctors = hospitalFeatures[0].includesPremiumDoctors || false;
        }
      }
    }

    // Build WHERE conditions as strings
    // Logic: 
    // - If ONLY search text: search by name OR specialty name
    // - If ONLY specialty filter: filter by selected specialties
    // - If BOTH search AND specialty filter: search by NAME AND has selected specialty
    const whereConditionStrings: string[] = [];

    // Determine if we have both search and specialty filter
    const hasBothSearchAndSpecialty = searchText && specialtyIds.length > 0;

    // Search text condition
    if (searchText) {
      console.log('✅ Adding search condition for:', searchText);
      const searchPattern = `%${searchText.toLowerCase()}%`;
      
      if (hasBothSearchAndSpecialty) {
        // When both search and specialty filter are provided: search by NAME ONLY
        whereConditionStrings.push(`(
          LOWER(d.first_name) LIKE '${searchPattern}' OR
          LOWER(d.last_name) LIKE '${searchPattern}' OR
          LOWER(d.first_name || ' ' || d.last_name) LIKE '${searchPattern}' OR
          LOWER(d.last_name || ' ' || d.first_name) LIKE '${searchPattern}'
        )`);
      } else {
        // When only search is provided: search by NAME OR SPECIALTY
        whereConditionStrings.push(`(
          LOWER(d.first_name) LIKE '${searchPattern}' OR
          LOWER(d.last_name) LIKE '${searchPattern}' OR
          LOWER(d.first_name || ' ' || d.last_name) LIKE '${searchPattern}' OR
          LOWER(d.last_name || ' ' || d.first_name) LIKE '${searchPattern}' OR
          EXISTS (
            SELECT 1 FROM doctor_specialties ds
            INNER JOIN specialties s ON ds.specialty_id = s.id
            WHERE ds.doctor_id = d.id AND LOWER(s.name) LIKE '${searchPattern}'
          )
        )`);
      }
    } else {
      console.log('⚠️  No search text provided');
    }

    // Specialty filter condition - always filters to selected specialties when provided
    if (specialtyIds.length > 0) {
      console.log('✅ Adding specialty filter for:', specialtyIds);
      const specialtyArrayLiteral = `ARRAY[${specialtyIds.map(id => `'${id}'::uuid`).join(', ')}]`;
      whereConditionStrings.push(`EXISTS (
        SELECT 1 FROM doctor_specialties 
        WHERE doctor_id = d.id 
        AND specialty_id = ANY(${specialtyArrayLiteral})
      )`);
    } else {
      console.log('⚠️  No specialty filter applied');
    }

    // Build WHERE clause string by combining all conditions with AND
    let whereClauseString = '';
    if (whereConditionStrings.length > 0) {
      whereClauseString = whereConditionStrings.join(' AND ');
      console.log('📋 WHERE conditions count:', whereConditionStrings.length);
    } else {
      console.log('⚠️  No WHERE conditions applied');
    }

    // Check if PostGIS is available
    const hasPostGIS = await isPostGISInstalled();
    
    if (!hasPostGIS) {
      // PostGIS not available - return empty results
      return NextResponse.json({
        success: true,
        data: {
          doctors: [],
          hospitalSubscription: hospitalSubscriptionTier,
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
        },
      });
    }

    /**
     * FIXED RADIUS FETCHING WITH POSTGIS
     * 
     * Uses standard OFFSET/LIMIT pagination
     * Only includes doctors WITH location (excludes doctors without location)
     * Only works for hospitals WITH location (excludes hospitals without location)
     * Radius can be specified via query parameter, defaults to hospital's maxSearchDistanceKm or 50km
     * Favorite doctors appear first, then others (all sorted by distance)
     */
    
  // Step 1: Get favorite doctor IDs (from hospital preferences)
  const favoriteDoctorIds = hospitalPrefs[0]?.preferredDoctorIds || [];

    // Respect the onlyFavorites query parameter. When onlyFavorites is true
    // we must return only favorite doctors (or an empty result if none exist).
    // When onlyFavorites is not provided/false, fall back to the default
    // behavior (do not restrict the DB query to favorites; pass favorites to
    // the helper so it can prioritize them if implemented).
    const onlyFavoritesParam = searchParams.get('onlyFavorites');
    const onlyFavorites = onlyFavoritesParam === 'true' || onlyFavoritesParam === '1';

    let onlyFavoritesApplied = false;
    console.log('onlyFavorites requested:', onlyFavorites);

    // Build final WHERE clause including onlyFavorites condition if needed
    let finalWhereClauseString = whereClauseString;

    if (onlyFavorites) {
      // If the caller explicitly asked for only favorites but the hospital has
      // none, return an empty result set with meta indicating the rule was
      // applied.
      if (!favoriteDoctorIds || favoriteDoctorIds.length === 0) {
        return NextResponse.json({
          success: true,
          data: {
            doctors: [],
            hospitalSubscription: hospitalSubscriptionTier,
            searchCenter: { lat: hospitalLat, lon: hospitalLon, overrideUsed },
            pagination: {
              page,
              limit,
              total: 0,
              totalPages: 0,
              hasNextPage: false,
              hasPrevPage: false,
            },
            meta: { onlyFavoritesApplied: true }
          }
        });
      }

      // Hospital has favorites and caller requested onlyFavorites -> restrict
      // the WHERE clause to those favorite IDs.
      const favArrayIds = favoriteDoctorIds.map(id => `'${id}'::uuid`).join(', ');
      const favoritesCondition = `d.id = ANY(ARRAY[${favArrayIds}])`;
      
      if (finalWhereClauseString) {
        finalWhereClauseString = finalWhereClauseString + ' AND ' + favoritesCondition;
      } else {
        finalWhereClauseString = favoritesCondition;
      }

      onlyFavoritesApplied = true;
    }

    // Convert final WHERE clause string to sql.raw for PostGIS helpers
    // PostGIS queries expect baseWhereClause to start with ' AND' or be empty
    const baseWhereClause = finalWhereClauseString 
      ? sql.raw(' AND ' + finalWhereClauseString)
      : sql.raw('');

    // Step 2: Get total count of doctors within radius (with location)
    const totalCount = await countDoctorsInFixedRadius(
      hospitalLat!,
      hospitalLon!,
      validRadiusKm,
      baseWhereClause
    );
    const totalPages = Math.ceil(totalCount / limit);
    
    let doctorsList: any;
    
    // Early exit if no doctors found
    if (totalCount === 0) {
      doctorsList = { rows: [] };
    } else {
      // Step 3: Fetch doctors using OFFSET/LIMIT pagination.
      // If onlyFavorites was requested and applied we already restricted the
      // DB query to favorites above, so we don't need favorite prioritization
      // in the helper (pass empty array). Otherwise pass favorite IDs so the
      // helper may prioritize them when building ORDER BY.
      const doctors = await fetchDoctorsInFixedRadius(
        hospitalLat!,
        hospitalLon!,
        validRadiusKm,
        baseWhereClause,
        limit,
        offset,
        onlyFavoritesApplied ? [] : favoriteDoctorIds
      );

      // Convert to format expected by rest of code
      doctorsList = { rows: doctors };
    }
    
    // Get list of doctor IDs from the results
    const doctorIds = doctorsList.rows.map((row: any) => row.id);
    
    // Fetch parent slots for each doctor for the specified date
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    // Group parent slots by doctor ID (only parent slots, parentSlotId IS NULL)
    const availabilityByDoctor: Record<string, any[]> = {};
    
    if (doctorIds.length > 0) {
      // Query parent slots only (parentSlotId IS NULL)
      const availabilityResults = await db
        .select({
          doctorId: doctorAvailability.doctorId,
          slotId: doctorAvailability.id,
          startTime: doctorAvailability.startTime,
          endTime: doctorAvailability.endTime,
          slotDate: doctorAvailability.slotDate,
        })
        .from(doctorAvailability)
        .where(
          and(
            eq(doctorAvailability.slotDate, targetDate),
            isNull(doctorAvailability.parentSlotId), // Only parent slots
            inArray(doctorAvailability.doctorId, doctorIds)
          )
        )
        .orderBy(doctorAvailability.doctorId, asc(doctorAvailability.startTime));
      
      availabilityResults.forEach((row: any) => {
        const doctorId = row.doctorId;
        if (!availabilityByDoctor[doctorId]) {
          availabilityByDoctor[doctorId] = [];
        }
        availabilityByDoctor[doctorId].push({
          id: row.slotId,
          startTime: row.startTime,
          endTime: row.endTime,
          slotDate: row.slotDate,
        });
      });
    }

    // Get doctor user IDs by querying doctors table
    const doctorUserIdsMap: Record<string, string> = {};
    if (doctorIds.length > 0) {
      const doctorUsers = await db
        .select({
          id: doctors.id,
          userId: doctors.userId,
        })
        .from(doctors)
        .where(inArray(doctors.id, doctorIds));
      
      doctorUsers.forEach((doc) => {
        doctorUserIdsMap[doc.id] = doc.userId;
      });
    }
    
    // Fetch active subscriptions for all doctors
    const doctorUserIdsList = Object.values(doctorUserIdsMap);
    const doctorSubscriptions = doctorUserIdsList.length > 0 ? await db
      .select({
        userId: subscriptions.userId,
        tier: subscriptionPlans.tier,
        planId: subscriptionPlans.id,
      })
      .from(subscriptions)
      .innerJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
      .where(
        and(
          inArray(subscriptions.userId, doctorUserIdsList),
          eq(subscriptions.status, 'active'),
          eq(subscriptionPlans.userRole, 'doctor')
        )
      ) : [];
    
    // Create a map of userId -> subscription tier
    const subscriptionMap: Record<string, { tier: string; planId: string }> = {};
    doctorSubscriptions.forEach((sub) => {
      subscriptionMap[sub.userId] = { tier: sub.tier, planId: sub.planId };
    });
    
    // Fetch visibility weights for doctor plans
    const planIds = [...new Set(doctorSubscriptions.map(s => s.planId))];
    const visibilityWeights = planIds.length > 0 ? await db
      .select({
        planId: doctorPlanFeatures.planId,
        visibilityWeight: doctorPlanFeatures.visibilityWeight,
      })
      .from(doctorPlanFeatures)
      .where(inArray(doctorPlanFeatures.planId, planIds)) : [];
    
    const visibilityWeightMap: Record<string, number> = {};
    visibilityWeights.forEach((vw) => {
      visibilityWeightMap[vw.planId] = vw.visibilityWeight || 1;
    });
    
    // Format the results and calculate scores
    const formattedDoctorsList = doctorsList.rows.map((row: any) => {
      const userId = doctorUserIdsMap[row.id];
      const subscription = userId ? subscriptionMap[userId] : null;
      const visibilityWeight = subscription?.planId ? visibilityWeightMap[subscription.planId] : null;
      
      // Extract doctor coordinates (convert numeric to number if needed)
      const doctorLat = row.latitude 
        ? (typeof row.latitude === 'string' ? parseFloat(row.latitude) : Number(row.latitude))
        : null;
      const doctorLon = row.longitude
        ? (typeof row.longitude === 'string' ? parseFloat(row.longitude) : Number(row.longitude))
        : null;
      
      // Distance is already calculated by PostGIS in kilometers (ST_Distance / 1000.0)
      const distance = row.distance !== undefined && row.distance !== null
        ? Math.round((typeof row.distance === 'string' ? parseFloat(row.distance) : Number(row.distance)) * 100) / 100
        : null;
      
      // Calculate score (include distance for scoring)
      const scoringData: DoctorScoringData = {
        yearsOfExperience: row.yearsOfExperience || 0,
        averageRating: row.averageRating ? Number(row.averageRating) : null,
        totalRatings: row.totalRatings || 0,
        completedAssignments: row.completedAssignments || 0,
        licenseVerificationStatus: (row.licenseVerificationStatus || 'pending') as 'pending' | 'verified' | 'rejected',
        subscriptionTier: subscription?.tier as any || null,
        visibilityWeight: visibilityWeight || null,
        // Note: distance is not used in scoring, only for display
      };
      
      const score = calculateDoctorScore(scoringData);
      
      return {
        id: row.id,
        firstName: row.firstName,
        lastName: row.lastName,
        yearsOfExperience: row.yearsOfExperience,
        averageRating: row.averageRating,
        totalRatings: row.totalRatings,
        completedAssignments: row.completedAssignments,
        licenseVerificationStatus: row.licenseVerificationStatus,
        specialties: row.specialties || [],
        availableSlots: availabilityByDoctor[row.id] || [],
        score, // Include score for sorting
        subscriptionTier: subscription?.tier || 'free', // Store doctor's actual subscription tier
        distance, // Distance in kilometers, or null if coordinates are missing
        photo: row.photo || null,
      };
    });
    console.log(formattedDoctorsList,"formated",formattedDoctorsList.length)

    // If we applied an only-favorites restriction, sort the returned
    // favorites by score (highest first). Otherwise keep the list as-is and
    // allow downstream sorting by distance/score.
    const sortedDoctors = onlyFavoritesApplied
      ? sortDoctorsByScore(formattedDoctorsList)
      : formattedDoctorsList;
    
    // Format doctors - use actual subscription tier from database
    const formattedDoctors = sortedDoctors.map((doctor: any) => {
      const rating = doctor.averageRating ? Number(doctor.averageRating) : 0;
      const experience = doctor.yearsOfExperience || 0;
      const completed = doctor.completedAssignments || 0;

      // Use doctor's actual subscription tier from database (not calculated)
      const subscriptionTier = (doctor as any).subscriptionTier || 'free';

      // Specialties are now returned as an array of objects via json_agg
      const specialtiesRaw = Array.isArray(doctor.specialties) ? doctor.specialties : [];
      const specialtiesArray = specialtiesRaw.map((s: any) => typeof s === 'string' ? s : s.name);
      const fullSpecialties = specialtiesRaw.filter((s: any) => s && typeof s === 'object');

      // Format parent slots - these are the main availability windows
      // The UI will fetch detailed availability (with booked sub-slots) when user selects a slot
      const slots = (doctor.availableSlots || []).map((slot: any) => {
        if (!slot || !slot.startTime) return null;
        // Convert time format (HH:MM:SS) to readable format for display
        const timeStr = typeof slot.startTime === 'string' ? slot.startTime : slot.startTime.toString();
        const [startHours, startMinutes] = timeStr.split(':');
        const startHour = parseInt(startHours);
        const startAmpm = startHour >= 12 ? 'PM' : 'AM';
        const startDisplayHour = startHour > 12 ? startHour - 12 : startHour === 0 ? 12 : startHour;
        
        const endTimeStr = typeof slot.endTime === 'string' ? slot.endTime : slot.endTime.toString();
        const [endHours, endMinutes] = endTimeStr.split(':');
        const endHour = parseInt(endHours);
        const endAmpm = endHour >= 12 ? 'PM' : 'AM';
        const endDisplayHour = endHour > 12 ? endHour - 12 : endHour === 0 ? 12 : endHour;
        
        const formattedTime = `${startDisplayHour}:${startMinutes} ${startAmpm} - ${endDisplayHour}:${endMinutes} ${endAmpm}`;
        
        return {
          id: slot.id,
          time: formattedTime,
          startTime: slot.startTime,
          endTime: slot.endTime,
          slotDate: slot.slotDate,
        };
      }).filter(Boolean);

      return {
        id: doctor.id,
        name: `Dr. ${doctor.firstName} ${doctor.lastName}`,
        specialty: specialtiesArray[0] || 'General Medicine',
        specialties: specialtiesArray,
        fullSpecialties: fullSpecialties,
        subscriptionTier: subscriptionTier, // Doctor's actual subscription tier from database
        experience,
        rating: rating || 0,
        reviews: doctor.totalRatings || 0,
        completedAssignments: completed,
        photo: doctor.photo ?? null,
        availableSlots: slots.length > 0 ? slots : [], // Return empty array if no slots
        fee: 1000 + (experience * 100), // Calculate fee based on experience
        score: doctor.score?.totalScore || 0, // Include score in response for sorting/ranking
        scoreBreakdown: doctor.score?.breakdown, // Include breakdown for transparency
        distance: (doctor as any).distance ?? null, // Distance in kilometers, or null if coordinates are missing
        isFavorite: favoriteDoctorIds.includes(doctor.id), // Include favorite status to avoid separate API call
      };
    });

    // Filter doctors based on subscription access and premium doctor access
    const accessibleDoctors = formattedDoctors.filter((doctor: any) => {
      // Use doctor's actual subscription tier from database
      const doctorSubscriptionTier = (doctor.subscriptionTier || 'free') as 'free' | 'basic' | 'premium' | 'enterprise';
      const doctorRequired = planHierarchy[doctorSubscriptionTier] ?? 0;
      const hospitalHas = planHierarchy[hospitalSubscriptionTier] ?? 0;
      
      // Check if doctor has premium/enterprise subscription
      const isPremiumDoctor = doctorSubscriptionTier === 'premium' || doctorSubscriptionTier === 'enterprise';
      
      // If doctor has premium/enterprise subscription and hospital doesn't have premium access, filter out
      // if (isPremiumDoctor && !includesPremiumDoctors) {
      //   return true;
      // }
      
      // Check plan hierarchy: hospital tier must be >= doctor's subscription tier
      // return hospitalHas >= doctorRequired;
       return true
    });

    // Sort results. If onlyFavoritesApplied, sort by score only (favorites
    // should be ranked by score). Otherwise sort by distance then score.
    if (onlyFavoritesApplied) {
      accessibleDoctors.sort((a:any, b: any) => (b.score || 0) - (a.score || 0));
    } else {
      accessibleDoctors.sort((a:any, b: any) => {
        const distanceA = a.distance ?? Infinity;
        const distanceB = b.distance ?? Infinity;
        if (distanceA !== distanceB) {
          return distanceA - distanceB;
        }
        const scoreA = a.score || 0;
        const scoreB = b.score || 0;
        return scoreB - scoreA;
      });
    }


    return NextResponse.json({
      success: true,
      data: {
        doctors: accessibleDoctors,
        hospitalSubscription: hospitalSubscriptionTier,
        searchCenter: {
          lat: hospitalLat,
          lon: hospitalLon,
          overrideUsed,
        },
  meta: { onlyFavoritesApplied },
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (error) {
    console.error('Error finding doctors:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to find doctors',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

const planHierarchy = { free: 0, basic: 1, premium: 2, enterprise: 3 };

