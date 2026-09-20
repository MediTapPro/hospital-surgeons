# Patient + Doctor Mobile API Contract

```json
{
  "baseUrl": "https://<your-api-domain>",
  "authentication": "Authorization: Bearer <accessToken>",
  "responseConvention": {
    "success": { "success": true, "data": {} },
    "failure": { "success": false, "message": "Human-readable error", "error": "OPTIONAL_ERROR_CODE" }
  },
  "patientApis": [
    { "method": "POST", "path": "/api/patients/signup", "authRequired": false, "purpose": "Create patient account and profile" },
    { "method": "GET | PUT", "path": "/api/patients/profile", "authRequired": true, "purpose": "Read or update signed-in patient profile. GET returns fullName, read-only email, read-only phone, profilePhotoId, and profilePhotoUrl." },
    {
      "method": "POST",
      "path": "/api/patients/profile-photo/upload",
      "authRequired": true,
      "contentType": "multipart/form-data",
      "purpose": "Upload and set the signed-in patient's profile photo",
      "body": { "file": "JPG | PNG | WebP image, maximum 5 MB" },
      "successResponse": { "success": true, "data": { "fileId": "uuid", "profilePhotoId": "uuid", "url": "public-image-url" } },
      "mobileRule": "Send FormData field name file. Do not manually set the multipart Content-Type boundary."
    },
    { "method": "GET | POST", "path": "/api/patients/addresses", "authRequired": true, "purpose": "List or create saved addresses" },
    { "method": "PUT | DELETE", "path": "/api/patients/addresses/{addressId}", "authRequired": true, "purpose": "Update or delete an address" },
    { "method": "GET | POST", "path": "/api/patients/family-members", "authRequired": true, "purpose": "List or create family members" },
    { "method": "PUT | DELETE", "path": "/api/patients/family-members/{familyMemberId}", "authRequired": true, "purpose": "Update or delete family member" },
    { "method": "GET", "path": "/api/patients/doctors/search", "authRequired": true, "purpose": "Search doctors" },
    {
      "method": "GET",
      "path": "/api/bookings/time-slots?doctorId={doctorId}&bookingDate=YYYY-MM-DD&type=home_visit",
      "authRequired": false,
      "purpose": "Get available home-visit slots",
      "requiredQuery": ["doctorId", "bookingDate"],
      "validTypes": ["home_visit", "hospital"]
    },
    {
      "method": "GET",
      "path": "/api/bookings/home-visit?doctorId={doctorId}",
      "authRequired": true,
      "purpose": "Get current fee, trial eligibility, and payment policy before booking",
      "responseExample": {
        "success": true,
        "data": { "fee": 0, "isFreeTrial": true, "paymentMode": "free_trial", "paymentTiming": "pay_after_completion" }
      },
      "mobileRules": ["Call before booking confirmation", "Do not calculate trial eligibility in mobile app", "Backend validates again at booking time"]
    },
    {
      "method": "POST",
      "path": "/api/bookings/home-visit",
      "authRequired": true,
      "purpose": "Create a home-visit assignment",
      "bodyUsingParentSlot": {
        "doctorId": "uuid",
        "parentSlotId": "uuid",
        "startTime": "09:30",
        "endTime": "10:30",
        "patientAddressId": "uuid",
        "patientFamilyMemberId": "uuid (optional)",
        "priority": "routine | urgent | emergency",
        "symptoms": "optional",
        "treatmentNotes": "optional"
      },
      "bodyUsingDirectSlot": { "doctorId": "uuid", "availabilitySlotId": "uuid", "patientAddressId": "uuid", "priority": "routine" },
      "rule": "Send parentSlotId + startTime + endTime OR availabilitySlotId; never both.",
      "successResponse": { "success": true, "data": { "id": "assignment-uuid", "paymentMode": "free_trial | pay_after_completion", "isFreeTrial": true } }
    },
    {
      "method": "GET",
      "path": "/api/patients/bookings",
      "authRequired": true,
      "purpose": "List patient home visits",
      "importantFields": ["id", "status", "doctorFirstName", "doctorLastName", "slotDate", "slotStartTime", "slotEndTime", "addressLabel", "addressText", "familyMemberFullName", "consultationFee", "paymentMode", "isFreeTrial", "paidAt"]
    },
    { "method": "PATCH", "path": "/api/assignments/{assignmentId}/status", "authRequired": true, "purpose": "Patient cancellation only", "body": { "status": "cancelled", "cancellationReason": "optional" } },
    {
      "method": "POST",
      "path": "/api/bookings/home-visit/{assignmentId}/payment-order",
      "authRequired": true,
      "purpose": "Create Razorpay order after a paid visit is completed",
      "callOnlyWhen": ["status=completed", "isFreeTrial=false", "paymentMode=pay_after_completion", "paidAt is empty"],
      "successResponse": { "success": true, "data": { "orderId": "internal-order-uuid", "session": { "id": "razorpay-order-id" } } }
    },
    {
      "method": "POST",
      "path": "/api/payments/verify",
      "authRequired": false,
      "purpose": "Verify Razorpay payment",
      "body": { "razorpay_order_id": "order_xxx", "razorpay_payment_id": "pay_xxx", "razorpay_signature": "signature_xxx" },
      "successResponse": { "success": true, "data": { "orderId": "uuid", "paymentTransactionId": "uuid", "status": "success", "razorpayPaymentId": "pay_xxx" } },
      "mobileRule": "Close Razorpay checkout on success, then reload bookings and payment history."
    },
    { "method": "GET", "path": "/api/patients/payments?page=1&limit=10", "authRequired": true, "purpose": "List completed home-visit payments only", "maximumLimit": 50 }
  ],
  "doctorApis": [
    {
      "method": "GET",
      "path": "/api/doctors/{doctorId}/assignments",
      "authRequired": true,
      "purpose": "List hospital assignments and patient home visits",
      "query": { "status": "pending | accepted | completed | cancelled | all", "source": "patient | hospital | all", "search": "optional", "selectedDate": "YYYY-MM-DD", "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" },
      "homeVisitFields": ["source=patient", "visitAddress", "visitAddressLabel", "recipientName", "recipientPhone", "recipientRelationship", "symptoms", "fee", "platformCommission", "doctorPayout"],
      "mobileRule": "Use source=patient for Home Visits and source=hospital for Hospital Assignments."
    },
    {
      "method": "PATCH",
      "path": "/api/assignments/{assignmentId}/status",
      "authRequired": true,
      "purpose": "Doctor accept, decline, complete, or cancel assignment",
      "body": { "status": "accepted | declined | completed | cancelled", "cancellationReason": "optional", "treatmentNotes": "optional" },
      "homeVisitRules": ["Completion does not charge the patient", "Paid completion creates settlement with patientPaymentStatus=pending", "Free-trial completion creates no settlement"]
    },
    {
      "method": "GET | POST",
      "path": "/api/doctors/{doctorId}/availability",
      "authRequired": "GET false, POST true",
      "purpose": "Get or create doctor availability",
      "getQuery": { "date": "YYYY-MM-DD optional", "type": "hospital | home_visit", "allSlots": "true | false", "page": "optional", "limit": "optional" },
      "postBody": { "slotDate": "YYYY-MM-DD", "startTime": "09:00", "endTime": "10:00", "slotType": "home_visit | hospital", "status": "available", "isManual": false, "notes": "optional" }
    },
    {
      "method": "GET",
      "path": "/api/doctors/{doctorId}/payments?page=1&limit=20",
      "authRequired": true,
      "purpose": "List doctor settlement records",
      "query": { "source": "hospital_assignment | home_visit", "status": "pending | processing | completed | failed", "limit": "maximum 50" },
      "responseFields": ["totalEarnings", "pendingEarnings", "payments[].paymentSource", "payments[].patientPaymentStatus", "payments[].patientPaidAt", "payments[].consultationFee", "payments[].platformCommission", "payments[].doctorPayout", "payments[].paymentStatus", "payments[].paidToDoctorAt", "payments[].assignment", "payments[].hospital", "payments[].patient"],
      "rules": ["patientPaymentStatus applies only to home_visit", "paymentStatus is doctor settlement state", "Doctor cannot mark payout paid; admin does that"]
    }
  ],
  "sharedChatApis": [
    "GET | POST /api/chats",
    "GET /api/chats/contacts",
    "GET /api/chats/unread-count",
    "GET | DELETE /api/chats/{conversationId}",
    "GET | POST /api/chats/{conversationId}/messages",
    "PATCH | DELETE /api/chats/{conversationId}/messages/{messageId}",
    "PATCH /api/chats/{conversationId}/messages/{messageId}/read",
    "POST /api/chats/{conversationId}/messages/{messageId}/reactions",
    "PATCH /api/chats/{conversationId}/messages/bulk-status",
    "GET /api/chats/{conversationId}/attachments",
    "POST /api/chats/{conversationId}/attachments/upload"
  ],
  "paymentStateMeaning": {
    "free_trial": "Complimentary visit. No payment and no doctor settlement record.",
    "patientPaymentStatus=pending": "Visit completed but patient has not paid.",
    "patientPaymentStatus=paid": "Patient paid successfully through Razorpay.",
    "paymentStatus=processing": "Home-visit settlement exists and waits for patient payment.",
    "paymentStatus=pending": "Doctor payout awaits admin settlement.",
    "paymentStatus=completed": "Admin recorded doctor payout as paid."
  }
}
```
