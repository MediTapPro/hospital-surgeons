# Patient-Initiated Doctor Home Visit Booking System

This system implements a B2C patient-initiated home visit booking wizard that enables patients to search for doctors, choose availability slots, and book home visits. The implementation decouples B2C metadata from the core B2B hospital workflow to maintain stability and prevent regression bugs.

---

## 1. System Architecture

The booking flow uses a decoupled metadata strategy:
1. **Core Booking**: Inserts a standard assignment record into `assignments` with `source: 'patient'` and `status: 'pending'`.
2. **Visit Metadata**: Inserts a matching record into `home_visit_details` storing the address and recipient family member references.

```
       [ Patient Booking Wizard UI ]
                     │
                     ▼
          [ POST /api/bookings/home-visit ]
                     │
                     ▼ (Transaction)
       ┌─────────────┴─────────────┐
       ▼                           ▼
[ assignments ] ◄──1:1──► [ home_visit_details ]
 (Core status/time)          (Address & Recipient info)
```

---

## 2. Database Schema Details

### Table: `home_visit_details`
Keeps home visit metadata separate from hospital bookings, and includes placeholder columns for future doctor clinical notes and PDF report uploads.

* **`id`** (`UUID`): Primary key.
* **`assignment_id`** (`UUID`): Unique foreign key referencing `assignments.id` (`ON DELETE CASCADE`).
* **`patient_address_id`** (`UUID`): References the patient's saved address.
* **`patient_family_member_id`** (`UUID`, Nullable): References the recipient family member (null if booked for self).
* **`symptoms`** (`TEXT`, Nullable): Reason or symptoms entered by the patient.
* **`clinical_notes`** (`TEXT`, Nullable): Clinical summary entered by doctor post-visit (future use).
* **`prescription`** (`TEXT`, Nullable): Prescription instructions given by doctor (future use).
* **`attachment_file_id`** (`UUID`, Nullable): References `files.id` for PDF uploads (future use).

---

## 3. Data Integrity & Validation Guards

### A. Database Cascading
- Core deletion cascade (`ON DELETE CASCADE`) ensures that if an assignment is deleted, its metadata is auto-cleaned.
- Safe delete references (`ON DELETE SET NULL`) ensure that deleting the parent address or family member in the database won't trigger database constraint failures.

### B. Business Logic Guards (In-Code Validation)
To prevent active bookings from losing reference data, deletion guards are executed in the service layer:
- **Location Guard**: Prevents a patient from deleting a saved address if there are active or pending home visits scheduled at that address.
- **Recipient Guard**: Prevents a patient from deleting a saved family member profile if there are active or pending home visits booked for them.

---

## 4. API Endpoints

### 1. `POST /api/bookings/home-visit`
Creates a home visit booking request.
* **Payload**:
  ```json
  {
    "doctorId": "uuid-here",
    "parentSlotId": "uuid-here",
    "startTime": "10:00",
    "endTime": "11:00",
    "priority": "routine",
    "patientAddressId": "uuid-here",
    "patientFamilyMemberId": "uuid-here",
    "symptoms": "symptoms description"
  }
  ```

### 2. `DELETE /api/patients/addresses/[id]`
Deletes a saved address. Blocked with HTTP 400 if active bookings reference this address.

### 3. `DELETE /api/patients/family-members/[id]`
Deletes a family member. Blocked with HTTP 400 if active bookings reference this family member.
