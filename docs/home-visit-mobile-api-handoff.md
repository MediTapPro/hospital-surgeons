# Home Visit Booking — API Handoff for Mobile Frontend

> Handoff doc for the mobile frontend team. Covers **patient-side home visit APIs (all new)** and **doctor-side assignment APIs (added/updated)** for the Home Visit Booking feature.

Base URL: `https://<your-backend-domain>` (dev: `http://localhost:3000`)
Auth: `Authorization: Bearer <accessToken>` on all APIs below.

---

## 1. Patient-Side APIs (ALL NEW)

### 1.1 Doctor Search
**`GET /api/patients/doctors/search`** — Search verified doctors by specialty/location/symptoms for home visits.
- **Auth**: patient
- **Query params**:
  - `latitude` / `longitude` (number, optional — center point)
  - `radiusKm` (number, optional)
  - `specialty`, `search`, `sortBy`, `page`, `pageSize` (optional)
- **Response** `200`:
  ```json
  {
    "success": true,
    "data": {
      "doctors": [
        {
          "id": "uuid",
          "firstName": "...",
          "lastName": "...",
          "primaryLocation": "...",
          "averageRating": "4.5",
          "totalRatings": 12,
          "distanceKm": 3.2
        }
      ],
      "total": 10,
      "page": 1,
      "pageSize": 10
    }
  }
  ```

### 1.2 Doctor Availability (Home Visit Slots)
**`GET /api/doctors/[doctorId]/availability?date=YYYY-MM-DD&type=home_visit`** — Parent slots + booked sub-slots for a date.
- **Auth**: patient
- **Query**: `date` (required), `type` (`home_visit` or `hospital`)
- **Response** `200`:
  ```json
  {
    "success": true,
    "data": {
      "slots": [
        {
          "id": "parent-slot-uuid",
          "slotDate": "2026-08-16",
          "startTime": "09:00:00",
          "endTime": "13:00:00",
          "status": "available",
          "slotType": "home_visit",
          "bookedSubslots": [
            { "id": "sub-uuid", "startTime": "10:00:00", "endTime": "11:00:00", "status": "booked" }
          ]
        }
      ]
    }
  }
  ```
  The frontend computes **available ranges** by subtracting booked sub-slots from the parent window.

### 1.3 Get My Home Visit Bookings
**`GET /api/patients/bookings`** — Logged-in patient's home visit bookings (reads **snapshot** address/recipient data).
- **Auth**: patient
- **Response** `200`:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "assignment-uuid",
        "status": "pending",          // pending | accepted | in_progress | completed | cancelled | expired | rejected
        "priority": "routine",        // routine | urgent | emergency
        "requestedAt": "2026-08-15T10:00:00Z",
        "expiresAt": "2026-08-16T10:00:00Z",
        "doctorId": "uuid",
        "doctorFirstName": "Raj",
        "doctorLastName": "Sharma",
        "doctorPrimaryLocation": "Mumbai",
        "symptoms": "Fever and body ache",
        "clinicalNotes": null,
        "prescription": null,
        "treatmentNotes": "Rest and paracetamol",
        "addressLabel": "Home",            // SNAPSHOT
        "addressText": "Flat 4B, Bandra West", // SNAPSHOT
        "addressLatitude": "19.07600000",
        "addressLongitude": "72.87700000",
        "familyMemberId": null,            // null = booked for self
        "familyMemberFullName": null,      // SNAPSHOT (null for self)
        "familyMemberRelationship": null,  // SNAPSHOT (null for self)
        "slotDate": "2026-08-16",
        "slotStartTime": "10:00:00",
        "slotEndTime": "11:00:00",
        "consultationFee": null,
        "paidAt": null,
        "completedAt": null,
        "cancelledAt": null,
        "cancellationReason": null
      }
    ]
  }
  ```

### 1.4 Create Home Visit Booking
**`POST /api/bookings/home-visit`** — Book a home visit.
- **Auth**: patient
- **Body**:
  ```json
  {
    "doctorId": "uuid",
    "parentSlotId": "uuid",          // parent slot from availability API
    "startTime": "10:00",            // 24h "HH:mm"
    "endTime": "11:00",
    "priority": "routine",           // routine | urgent | emergency
    "patientAddressId": "uuid",      // from patient's saved addresses
    "patientFamilyMemberId": "uuid", // optional; omit for self
    "symptoms": "Fever and body ache"
  }
  ```
- **Response** `201`:
  ```json
  {
    "success": true,
    "data": { "id": "assignment-uuid", "status": "pending", "source": "patient", "availabilitySlotId": "sub-slot-uuid" },
    "message": "Home visit booking created successfully"
  }
  ```
- **Error codes** (HTTP status): `PATIENT_PROFILE_NOT_FOUND` (404), `PARENT_SLOT_NOT_FOUND`/`SLOT_NOT_FOUND` (404), `ASSIGNMENT_LIMIT_REACHED` (403), `TIME_OVERLAP`, `PAST_TIME_NOT_ALLOWED`, `INVALID_SLOT_TYPE`, `TIME_RANGE_OUT_OF_BOUNDS` (400)

### 1.5 Patient Addresses (new CRUD)
- **`GET /api/patients/addresses`** — list saved addresses (patient)
- **`POST /api/patients/addresses`** — add address. Body: `{ label, addressText, latitude?, longitude?, isDefault? }`
- **`PUT /api/patients/addresses/[id]`** — update address
- **`DELETE /api/patients/addresses/[id]`** — delete address. **No longer blocked** by active bookings (snapshot design).

### 1.6 Patient Family Members (new CRUD)
- **`GET /api/patients/family-members`** — list family members
- **`POST /api/patients/family-members`** — add. Body: `{ fullName, phone, relationship }`
- **`PUT /api/patients/family-members/[id]`** — update
- **`DELETE /api/patients/family-members/[id]`** — delete. **No longer blocked** by active bookings.

### 1.7 Patient Profile
- **`GET /api/patients/profile`** — get profile
- **`PUT /api/patients/profile`** — update name. Body: `{ fullName }`

### 1.8 Patient Cancel Booking
- **`PATCH /api/assignments/[id]/status`** — patient may only send `{ "status": "cancelled", "cancellationReason?": "..." }`

---

## 2. Doctor-Side APIs (ADDED / UPDATED)

### 2.1 Doctor Assignments (UPDATED — now includes home visits)
**`GET /api/doctors/[id]/assignments`** — list ALL assignments (hospital + home visits).
- **Auth**: doctor
- **Query params** (all optional):
  - `status` — `pending | accepted | completed | declined | cancelled | all`
  - `source` — **NEW** `hospital | patient | all` (default: no filter server-side; **mobile default should pass `hospital`** to match web UX)
  - `from` / `to` — `YYYY-MM-DD` date range
  - `search` — patient name/hospital/condition
- **Response** `200` — each row:
  ```json
  {
    "id": "uuid",
    "source": "patient",            // NEW: hospital | patient
    "patient": "Priya Das",          // home visit: recipient name (snapshot) | hospital: patient name
    "condition": "Fever and body ache", // home visit: symptoms | hospital: medical condition
    "hospital": "Home Visit",        // home visit: "Home Visit" | hospital: hospital name
    "hospitalAddress": "Flat 4B, Bandra West", // home visit: snapshot address | hospital: hospital address
    "visitAddress": "Flat 4B, Bandra West",    // NEW (home visit snapshot)
    "visitAddressLabel": "Home",                // NEW (home visit snapshot)
    "symptoms": "Fever and body ache",          // NEW
    "recipientName": "Priya Das",               // NEW (snapshot; null for self → use patientPhone)
    "recipientPhone": "9876543210",             // NEW (snapshot phone of the person being visited)
    "recipientRelationship": "Daughter",        // NEW (snapshot; null for self)
    "patientPhone": "9876543210",               // snapshot phone first, fallback to account phone
    "date": "2026-08-16",
    "time": "10:00 AM",
    "endTime": "11:00 AM",
    "status": "pending",
    "priority": "routine",
    "createdAt": "2026-08-15T10:00:00Z",
    "expiresAt": "2026-08-16T10:00:00Z",
    "expiresIn": "24h",
    "fee": 0,
    "treatmentNotes": null,
    "cancellationReason": null,
    "availabilitySlotId": "uuid",
    "parentSlotId": "uuid"
  }
  ```

### 2.2 Update Assignment Status (UPDATED — home visit aware + completion time check temporarily bypassed)
**`PATCH /api/assignments/[id]/status`** — doctor/hospital/patient.
- **Body**: `{ "status": "accepted|declined|cancelled|completed", "cancellationReason?": "...", "treatmentNotes?": "..." }`
- Doctor accepts/declines/completes/cancels; patient only cancels.
- Push notifications to patient for home visits (accepted/declined/completed/cancelled).
- **Note**: the "cannot complete before scheduled start time" guard is **temporarily bypassed** (`BYPASS_COMPLETE_TIME_CHECK = true`) for testing — flip to `false` to restore.

### 2.3 Doctor Availability Time Slots (UPDATED — slot type filter)
**`GET /api/bookings/time-slots?doctorId=...&bookingDate=YYYY-MM-DD&type=home_visit`** — availability slots for a date.
- `type` param **NEW**: `hospital` (default) | `home_visit` — filters by `doctor_availability.slot_type`.

---

## 3. Database Schema Changes (NEW)

### `home_visit_details` (new table + snapshot columns)
New snapshot columns (populated at booking time; **read these, not the FK tables**):
| Column | Type | Notes |
|---|---|---|
| `address_label` | text | Snapshot of saved address label |
| `address_text` | text | Snapshot of address text |
| `address_latitude` | numeric(10,8) | Snapshot |
| `address_longitude` | numeric(11,8) | Snapshot |
| `recipient_name` | text | Snapshot of recipient (family member OR self) |
| `recipient_phone` | text | Snapshot phone of person being visited |
| `recipient_relationship` | text | Snapshot relationship (null = self) |

Existing FK columns `patient_address_id` / `patient_family_member_id` are **reference-only** (audit). **Do not rely on them for display** — always use the snapshot columns above.

### `assignments` (new columns)
- `patient_profile_id` (uuid) — links to `patient_profiles` (home visits)
- `source` (text) — `'hospital'` (default) | `'patient'`

### `doctor_availability` (new column)
- `slot_type` (text) — `'hospital'` (default) | `'home_visit'` — sub-slots created for home visits have `slot_type='home_visit'` and a `parent_slot_id`.

### New tables
- `patient_profiles`, `patient_addresses`, `patient_family_members`, `home_visit_details` (home-visit patient master data + booking metadata)

---

## 4. Key Behavior Notes for Mobile

1. **Snapshot design** — a booking stores its own copy of the address/recipient. If the patient edits/deletes a saved address or family member, **existing bookings are unaffected** and show the original data. Mobile should always render `addressText` / `recipientName` / `recipientPhone` from the API response (which reads snapshots).
2. **Statuses** — home visits flow: `pending → accepted → in_progress → completed`, or `cancelled` / `expired` (pending expiry: routine 24h, urgent 6h, emergency 1h). `declined` possible from pending.
3. **Recipient vs account holder** — for family-member visits, `recipientPhone`/`recipientName` are the person being visited. For self visits, `recipientName` is null and `patientPhone` is the account holder's number.
4. **Delete guards removed** — patients can delete addresses/family members anytime; bookings keep their snapshot.
5. **Doctor default list** — to mirror web UX, mobile should call doctor assignments with `source=hospital` by default and let the user switch to `source=patient` (Home Visits) or `all`.
6. **Home visit payment** — not yet implemented (README: "To be built"). `fee`/`consultationFee` are 0/null for home visits.
