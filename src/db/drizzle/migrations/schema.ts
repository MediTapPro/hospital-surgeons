import { pgTable, foreignKey, uuid, integer, text, check, boolean, timestamp, index, unique, varchar, bigint, numeric, type AnyPgColumn, json, time, date, jsonb, primaryKey, pgView } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const doctorPlanFeatures = pgTable("doctor_plan_features", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	planId: uuid("plan_id").notNull(),
	visibilityWeight: integer("visibility_weight").default(1),
	maxAffiliations: integer("max_affiliations"),
	notes: text(),
	maxAssignmentsPerMonth: integer("max_assignments_per_month"),
}, (table) => [
	foreignKey({
			columns: [table.planId],
			foreignColumns: [subscriptionPlans.id],
			name: "doctor_plan_features_plan_id_fkey"
		}).onDelete("cascade"),
]);

export const patientConsents = pgTable("patient_consents", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	patientId: uuid("patient_id").notNull(),
	consentType: text("consent_type").notNull(),
	granted: boolean().notNull(),
	grantedBy: text("granted_by").notNull(),
	relationToPatient: text("relation_to_patient"),
	digitalSignature: text("digital_signature"),
	grantedAt: timestamp("granted_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.patientId],
			foreignColumns: [patients.id],
			name: "patient_consents_patient_id_fkey"
		}).onDelete("cascade"),
	check("patient_consents_consent_type_check", sql`consent_type = ANY (ARRAY['treatment'::text, 'data_sharing'::text, 'research'::text, 'photography'::text, 'other'::text])`),
]);

export const chatConversations = pgTable("chat_conversations", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	doctorId: uuid("doctor_id").notNull(),
	hospitalId: uuid("hospital_id").notNull(),
	lastMessageAt: timestamp("last_message_at", { mode: 'string' }),
	doctorUnreadCount: integer("doctor_unread_count").default(0).notNull(),
	hospitalUnreadCount: integer("hospital_unread_count").default(0).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("idx_chat_conversations_doctor_id").using("btree", table.doctorId.asc().nullsLast().op("uuid_ops")),
	index("idx_chat_conversations_hospital_id").using("btree", table.hospitalId.asc().nullsLast().op("uuid_ops")),
	index("idx_chat_conversations_updated_at").using("btree", table.updatedAt.desc().nullsFirst().op("timestamp_ops")),
	foreignKey({
			columns: [table.doctorId],
			foreignColumns: [doctors.id],
			name: "chat_conversations_doctor_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.hospitalId],
			foreignColumns: [hospitals.id],
			name: "chat_conversations_hospital_id_fkey"
		}).onDelete("cascade"),
	unique("chat_conversations_doctor_id_hospital_id_key").on(table.doctorId, table.hospitalId),
]);

export const chatMessages = pgTable("chat_messages", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	conversationId: uuid("conversation_id").notNull(),
	senderType: text("sender_type").notNull(),
	senderId: uuid("sender_id").notNull(),
	content: text().notNull(),
	messageType: text("message_type").default('text').notNull(),
	replyToId: uuid("reply_to_id"),
	isRead: boolean("is_read").default(false).notNull(),
	readAt: timestamp("read_at", { mode: 'string' }),
	status: integer("status").default(1).notNull(),
	isDeleted: boolean("is_deleted").default(false).notNull(),
	deletedAt: timestamp("deleted_at", { mode: 'string' }),
	isEdited: boolean("is_edited").default(false).notNull(),
	editedAt: timestamp("edited_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("idx_chat_messages_conversation_id").using("btree", table.conversationId.asc().nullsLast().op("uuid_ops")),
	index("idx_chat_messages_created_at").using("btree", table.createdAt.desc().nullsFirst().op("timestamp_ops")),
	index("idx_chat_messages_sender_id").using("btree", table.senderId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.conversationId],
			foreignColumns: [chatConversations.id],
			name: "chat_messages_conversation_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.replyToId],
			foreignColumns: [table.id],
			name: "chat_messages_reply_to_id_fkey"
		}).onDelete("set null"),
	check("chat_messages_message_type_check", sql`message_type = ANY (ARRAY['text'::text, 'attachment'::text, 'system'::text])`),
	check("chat_messages_sender_type_check", sql`sender_type = ANY (ARRAY['doctor'::text, 'hospital'::text])`),
]);

export const otps = pgTable("otps", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	email: varchar({ length: 255 }).notNull(),
	otpCode: varchar("otp_code", { length: 6 }).notNull(),
	otpType: varchar("otp_type", { length: 20 }).default('email_verification').notNull(),
	isUsed: boolean("is_used").default(false).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	verifiedAt: timestamp("verified_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("idx_otps_code").using("btree", table.otpCode.asc().nullsLast().op("text_ops")),
	index("idx_otps_email").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("idx_otps_expires_at").using("btree", table.expiresAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_otps_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "otps_user_id_fkey"
		}).onDelete("cascade"),
]);

export const users = pgTable("users", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	email: text().notNull(),
	passwordHash: text("password_hash").notNull(),
	role: text().notNull(),
	status: text().default('pending').notNull(),
	subscriptionStatus: text("subscription_status"),
	subscriptionTier: text("subscription_tier"),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	emailVerified: boolean("email_verified").default(false),
	phoneVerified: boolean("phone_verified").default(false),
	lastLoginAt: timestamp("last_login_at", { withTimezone: true, mode: 'string' }),
	phone: varchar({ length: 20 }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_users_email").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("idx_users_role").using("btree", table.role.asc().nullsLast().op("text_ops")),
	index("idx_users_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	unique("users_email_key").on(table.email),
	check("users_role_check", sql`role = ANY (ARRAY['doctor'::text, 'hospital'::text, 'admin'::text])`),
	check("users_status_check", sql`status = ANY (ARRAY['active'::text, 'inactive'::text, 'pending'::text, 'suspended'::text])`),
	check("users_subscription_status_check", sql`subscription_status = ANY (ARRAY['active'::text, 'expired'::text, 'cancelled'::text, 'trial'::text])`),
]);

export const chatMessageAttachments = pgTable("chat_message_attachments", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	messageId: uuid("message_id").notNull(),
	conversationId: uuid("conversation_id").notNull(),
	fileId: uuid("file_id").notNull(),
	uploadedBy: text("uploaded_by").notNull(),
	uploadedAt: timestamp("uploaded_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("idx_chat_message_attachments_conversation_id").using("btree", table.conversationId.asc().nullsLast().op("uuid_ops")),
	index("idx_chat_message_attachments_message_id").using("btree", table.messageId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.conversationId],
			foreignColumns: [chatConversations.id],
			name: "chat_message_attachments_conversation_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.fileId],
			foreignColumns: [files.id],
			name: "chat_message_attachments_file_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.messageId],
			foreignColumns: [chatMessages.id],
			name: "chat_message_attachments_message_id_fkey"
		}).onDelete("cascade"),
	check("chat_message_attachments_uploaded_by_check", sql`uploaded_by = ANY (ARRAY['doctor'::text, 'hospital'::text])`),
]);

export const chatMessageReactions = pgTable("chat_message_reactions", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	messageId: uuid("message_id").notNull(),
	conversationId: uuid("conversation_id").notNull(),
	reactorType: text("reactor_type").notNull(),
	reactorId: uuid("reactor_id").notNull(),
	emoji: varchar({ length: 10 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("idx_chat_message_reactions_message_id").using("btree", table.messageId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.conversationId],
			foreignColumns: [chatConversations.id],
			name: "chat_message_reactions_conversation_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.messageId],
			foreignColumns: [chatMessages.id],
			name: "chat_message_reactions_message_id_fkey"
		}).onDelete("cascade"),
	unique("chat_message_reactions_message_id_reactor_id_key").on(table.messageId, table.reactorId),
	check("chat_message_reactions_reactor_type_check", sql`reactor_type = ANY (ARRAY['doctor'::text, 'hospital'::text])`),
]);

export const procedureCategories = pgTable("procedure_categories", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	specialtyId: uuid("specialty_id").notNull(),
	name: text().notNull(),
	description: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.specialtyId],
			foreignColumns: [specialties.id],
			name: "procedure_categories_specialty_id_fkey"
		}).onDelete("cascade"),
	unique("procedure_categories_specialty_id_name_key").on(table.specialtyId, table.name),
]);

export const files = pgTable("files", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	filename: text().notNull(),
	url: text().notNull(),
	mimetype: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	size: bigint({ mode: "number" }).notNull(),
	thumbnail: text(),
	storageBucket: varchar("storage_bucket", { length: 255 }),
	storageKey: text("storage_key"),
	cdnUrl: text("cdn_url"),
	isPublic: boolean("is_public").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const doctors = pgTable("doctors", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	profilePhotoId: uuid("profile_photo_id"),
	firstName: text("first_name").notNull(),
	lastName: text("last_name").notNull(),
	medicalLicenseNumber: text("medical_license_number").notNull(),
	yearsOfExperience: integer("years_of_experience").notNull(),
	bio: text(),
	primaryLocation: text("primary_location"),
	latitude: numeric({ precision: 10, scale:  8 }),
	longitude: numeric({ precision: 11, scale:  8 }),
	licenseVerificationStatus: text("license_verification_status").default('pending').notNull(),
	averageRating: numeric("average_rating", { precision: 3, scale:  2 }).default('0.00'),
	totalRatings: integer("total_ratings").default(0),
	completedAssignments: integer("completed_assignments").default(0),
	fullAddress: text("full_address"),
	state: text(),
	city: text(),
	pincode: varchar({ length: 10 }),
}, (table) => [
	index("idx_doctors_city").using("btree", table.city.asc().nullsLast().op("text_ops")),
	index("idx_doctors_license").using("btree", table.medicalLicenseNumber.asc().nullsLast().op("text_ops")),
	index("idx_doctors_location").using("btree", table.latitude.asc().nullsLast().op("numeric_ops"), table.longitude.asc().nullsLast().op("numeric_ops")),
	index("idx_doctors_location_details").using("btree", table.city.asc().nullsLast().op("text_ops"), table.state.asc().nullsLast().op("text_ops"), table.pincode.asc().nullsLast().op("text_ops")),
	index("idx_doctors_pincode").using("btree", table.pincode.asc().nullsLast().op("text_ops")),
	index("idx_doctors_rating").using("btree", table.averageRating.desc().nullsFirst().op("numeric_ops")),
	index("idx_doctors_state").using("btree", table.state.asc().nullsLast().op("text_ops")),
	index("idx_doctors_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.profilePhotoId],
			foreignColumns: [files.id],
			name: "doctors_profile_photo_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "doctors_user_id_fkey"
		}).onDelete("cascade"),
	unique("doctors_user_id_key").on(table.userId),
	unique("doctors_medical_license_number_key").on(table.medicalLicenseNumber),
	check("doctors_average_rating_check", sql`(average_rating >= (0)::numeric) AND (average_rating <= (5)::numeric)`),
	check("doctors_license_verification_status_check", sql`license_verification_status = ANY (ARRAY['pending'::text, 'verified'::text, 'rejected'::text])`),
	check("doctors_years_of_experience_check", sql`years_of_experience >= 0`),
]);

export const specialties = pgTable("specialties", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
}, (table) => [
	unique("specialties_name_key").on(table.name),
]);
//@ts-ignore
export const paymentTransactions = pgTable("payment_transactions", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	orderId: uuid("order_id").notNull(),
	paymentGateway: text("payment_gateway").notNull(),
	paymentId: text("payment_id").notNull(),
	paymentMethod: text("payment_method"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	amount: bigint({ mode: "number" }).notNull(),
	currency: text().default('USD').notNull(),
	status: text().notNull(),
	gatewayResponse: json("gateway_response"),
	verifiedAt: timestamp("verified_at", { mode: 'string' }),
	refundedAt: timestamp("refunded_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	gatewayName: text("gateway_name"),
	gatewayPaymentId: text("gateway_payment_id"),
	gatewayOrderId: text("gateway_order_id"),
	webhookEventId: text("webhook_event_id"),
	webhookProcessedAt: timestamp("webhook_processed_at", { withTimezone: true, mode: 'string' }),
	refundReferenceId: text("refund_reference_id"),
	refundReason: text("refund_reason"),
	refundAmount: numeric("refund_amount"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	refundHistoryId: bigint("refund_history_id", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	createdByUserId: bigint("created_by_user_id", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	updatedByUserId: bigint("updated_by_user_id", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	sourceUserId: bigint("source_user_id", { mode: "number" }),
	sourceText: text("source_text"),
	gatewayBank: text("gateway_bank"),
	gatewayWallet: text("gateway_wallet"),
	gatewayVpa: text("gateway_vpa"),
	invoiceNumber: text("invoice_number"),
	receiptNumber: text("receipt_number"),
	responseMessage: text("response_message"),
	paymentStatus: text("payment_status"),
	paymentType: text("payment_type"),
	verifiedVia: text("verified_via"),
	userId: uuid("user_id"),
	subscriptionId: uuid("subscription_id"),
	planId: uuid("plan_id"),
	pricingId: uuid("pricing_id"),
}, 
//@ts-ignore
(table) => [
	index("idx_payment_transactions_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_payment_transactions_gateway_order").using("btree", table.gatewayName.asc().nullsLast().op("text_ops"), table.gatewayOrderId.asc().nullsLast().op("text_ops")),
	index("idx_payment_transactions_order").using("btree", table.orderId.asc().nullsLast().op("uuid_ops")),
	index("idx_payment_transactions_payment_status").using("btree", table.paymentStatus.asc().nullsLast().op("text_ops")),
	index("idx_payment_transactions_status").using("btree", table.paymentStatus.asc().nullsLast().op("text_ops")),
	index("idx_payment_transactions_type_status").using("btree", table.paymentType.asc().nullsLast().op("text_ops"), table.paymentStatus.asc().nullsLast().op("text_ops")),
	index("idx_payment_transactions_webhook_event").using("btree", table.webhookEventId.asc().nullsLast().op("text_ops")).where(sql`(webhook_event_id IS NOT NULL)`),
	foreignKey({
			columns: [table.planId],
			foreignColumns: [subscriptionPlans.id],
			name: "payment_transactions_plan_id_fkey"
		}),
	foreignKey({
			columns: [table.pricingId],
			foreignColumns: [planPricing.id],
			name: "payment_transactions_pricing_id_fkey"
		}),
	foreignKey({
			columns: [table.subscriptionId],
			foreignColumns: [subscriptions.id],
			name: "payment_transactions_subscription_id_fkey"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "payment_transactions_user_id_fkey"
		}),
	unique("payment_transactions_payment_id_key").on(table.paymentId),
	unique("uq_gateway_payment").on(table.gatewayName, table.gatewayPaymentId),
	check("payment_transactions_status_check", sql`status = ANY (ARRAY['pending'::text, 'success'::text, 'failed'::text, 'refunded'::text])`),
	check("payment_transactions_verified_via_check", sql`verified_via = ANY (ARRAY['webhook'::text, 'manual'::text])`),
]);

export const doctorCredentials = pgTable("doctor_credentials", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	doctorId: uuid("doctor_id").notNull(),
	fileId: uuid("file_id").notNull(),
	credentialType: text("credential_type").notNull(),
	title: text().notNull(),
	institution: text(),
	verificationStatus: text("verification_status").default('pending').notNull(),
	uploadedAt: timestamp("uploaded_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.doctorId],
			foreignColumns: [doctors.id],
			name: "doctor_credentials_doctor_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.fileId],
			foreignColumns: [files.id],
			name: "doctor_credentials_file_id_fkey"
		}).onDelete("cascade"),
	check("doctor_credentials_credential_type_check", sql`credential_type = ANY (ARRAY['degree'::text, 'certificate'::text, 'license'::text, 'other'::text])`),
	check("doctor_credentials_verification_status_check", sql`verification_status = ANY (ARRAY['pending'::text, 'verified'::text, 'rejected'::text])`),
]);

export const doctorProfilePhotos = pgTable("doctor_profile_photos", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	doctorId: uuid("doctor_id").notNull(),
	fileId: uuid("file_id").notNull(),
	isPrimary: boolean("is_primary").default(false),
	uploadedAt: timestamp("uploaded_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.doctorId],
			foreignColumns: [doctors.id],
			name: "doctor_profile_photos_doctor_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.fileId],
			foreignColumns: [files.id],
			name: "doctor_profile_photos_file_id_fkey"
		}).onDelete("cascade"),
]);

export const hospitals = pgTable("hospitals", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	logoId: uuid("logo_id"),
	name: text().notNull(),
	hospitalType: text("hospital_type"),
	registrationNumber: text("registration_number").notNull(),
	address: text().notNull(),
	city: text().notNull(),
	latitude: numeric({ precision: 10, scale:  8 }),
	longitude: numeric({ precision: 11, scale:  8 }),
	numberOfBeds: integer("number_of_beds"),
	contactEmail: text("contact_email"),
	contactPhone: text("contact_phone"),
	websiteUrl: text("website_url"),
	licenseVerificationStatus: text("license_verification_status").default('pending').notNull(),
	fullAddress: text("full_address"),
	state: text(),
	pincode: varchar({ length: 10 }),
}, (table) => [
	index("idx_hospitals_city").using("btree", table.city.asc().nullsLast().op("text_ops")),
	index("idx_hospitals_location").using("btree", table.latitude.asc().nullsLast().op("numeric_ops"), table.longitude.asc().nullsLast().op("numeric_ops")),
	index("idx_hospitals_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.logoId],
			foreignColumns: [files.id],
			name: "hospitals_logo_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "hospitals_user_id_fkey"
		}).onDelete("cascade"),
	unique("hospitals_user_id_key").on(table.userId),
	unique("hospitals_registration_number_key").on(table.registrationNumber),
	check("hospitals_hospital_type_check", sql`hospital_type = ANY (ARRAY['general'::text, 'specialty'::text, 'clinic'::text, 'trauma_center'::text, 'teaching'::text, 'other'::text])`),
	check("hospitals_license_verification_status_check", sql`license_verification_status = ANY (ARRAY['pending'::text, 'verified'::text, 'rejected'::text])`),
	check("hospitals_number_of_beds_check", sql`number_of_beds >= 0`),
]);

export const doctorPreferences = pgTable("doctor_preferences", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	doctorId: uuid("doctor_id").notNull(),
	maxTravelDistanceKm: integer("max_travel_distance_km"),
	acceptEmergencyOnly: boolean("accept_emergency_only").default(false),
	preferredHospitalIds: text("preferred_hospital_ids").array(),
	blockedHospitalIds: text("blocked_hospital_ids").array(),
}, (table) => [
	foreignKey({
			columns: [table.doctorId],
			foreignColumns: [doctors.id],
			name: "doctor_preferences_doctor_id_fkey"
		}).onDelete("cascade"),
	unique("doctor_preferences_doctor_id_key").on(table.doctorId),
]);

export const doctorAvailabilityHistory = pgTable("doctor_availability_history", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	availabilityId: uuid("availability_id").notNull(),
	eventType: text("event_type").notNull(),
	oldStatus: text("old_status"),
	newStatus: text("new_status"),
	changedBy: text("changed_by").notNull(),
	changedById: uuid("changed_by_id"),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.availabilityId],
			foreignColumns: [doctorAvailability.id],
			name: "doctor_availability_history_availability_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.changedById],
			foreignColumns: [users.id],
			name: "doctor_availability_history_changed_by_id_fkey"
		}).onDelete("set null"),
	check("doctor_availability_history_changed_by_check", sql`changed_by = ANY (ARRAY['doctor'::text, 'hospital'::text, 'system'::text, 'admin'::text])`),
	check("doctor_availability_history_event_type_check", sql`event_type = ANY (ARRAY['created'::text, 'updated'::text, 'booked'::text, 'released'::text, 'cancelled'::text])`),
]);

export const hospitalPreferences = pgTable("hospital_preferences", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	hospitalId: uuid("hospital_id").notNull(),
	maxSearchDistanceKm: integer("max_search_distance_km"),
	preferAffiliatedOnly: boolean("prefer_affiliated_only").default(false),
	preferredDoctorIds: text("preferred_doctor_ids").array(),
	blockedDoctorIds: text("blocked_doctor_ids").array(),
	assignmentCancellationNoticeDays: integer("assignment_cancellation_notice_days").default(1),
}, (table) => [
	foreignKey({
			columns: [table.hospitalId],
			foreignColumns: [hospitals.id],
			name: "hospital_preferences_hospital_id_fkey"
		}).onDelete("cascade"),
	unique("hospital_preferences_hospital_id_key").on(table.hospitalId),
]);

export const procedureTypes = pgTable("procedure_types", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	name: text().notNull(),
	displayName: text("display_name").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	unique("procedure_types_name_key").on(table.name),
]);

export const hospitalDocuments = pgTable("hospital_documents", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	hospitalId: uuid("hospital_id").notNull(),
	fileId: uuid("file_id").notNull(),
	documentType: text("document_type").notNull(),
	verificationStatus: text("verification_status").default('pending').notNull(),
	uploadedAt: timestamp("uploaded_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.fileId],
			foreignColumns: [files.id],
			name: "hospital_documents_file_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.hospitalId],
			foreignColumns: [hospitals.id],
			name: "hospital_documents_hospital_id_fkey"
		}).onDelete("cascade"),
	check("hospital_documents_document_type_check", sql`document_type = ANY (ARRAY['license'::text, 'accreditation'::text, 'insurance'::text, 'other'::text])`),
	check("hospital_documents_verification_status_check", sql`verification_status = ANY (ARRAY['pending'::text, 'verified'::text, 'rejected'::text])`),
]);

export const doctorHospitalAffiliations = pgTable("doctor_hospital_affiliations", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	doctorId: uuid("doctor_id").notNull(),
	hospitalId: uuid("hospital_id").notNull(),
	status: text().default('active').notNull(),
	isPreferred: boolean("is_preferred").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.doctorId],
			foreignColumns: [doctors.id],
			name: "doctor_hospital_affiliations_doctor_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.hospitalId],
			foreignColumns: [hospitals.id],
			name: "doctor_hospital_affiliations_hospital_id_fkey"
		}).onDelete("cascade"),
	unique("doctor_hospital_affiliations_doctor_id_hospital_id_key").on(table.doctorId, table.hospitalId),
	check("doctor_hospital_affiliations_status_check", sql`status = ANY (ARRAY['active'::text, 'inactive'::text, 'pending'::text, 'suspended'::text])`),
]);

export const availabilityTemplates = pgTable("availability_templates", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	doctorId: uuid("doctor_id").notNull(),
	templateName: text("template_name").notNull(),
	startTime: time("start_time").notNull(),
	endTime: time("end_time").notNull(),
	recurrencePattern: text("recurrence_pattern").notNull(),
	recurrenceDays: text("recurrence_days"),
	validFrom: date("valid_from").notNull(),
	validUntil: date("valid_until"),
}, (table) => [
	foreignKey({
			columns: [table.doctorId],
			foreignColumns: [doctors.id],
			name: "availability_templates_doctor_id_fkey"
		}).onDelete("cascade"),
	check("availability_templates_check", sql`end_time > start_time`),
	check("availability_templates_recurrence_pattern_check", sql`recurrence_pattern = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text, 'custom'::text])`),
]);

export const hospitalUsageTracking = pgTable("hospital_usage_tracking", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	hospitalId: uuid("hospital_id").notNull(),
	month: varchar({ length: 7 }).notNull(),
	patientsCount: integer("patients_count").default(0).notNull(),
	assignmentsCount: integer("assignments_count").default(0).notNull(),
	patientsLimit: integer("patients_limit").notNull(),
	assignmentsLimit: integer("assignments_limit").notNull(),
	resetDate: timestamp("reset_date", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("idx_hospital_usage_tracking_hospital_month").using("btree", table.hospitalId.asc().nullsLast().op("text_ops"), table.month.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.hospitalId],
			foreignColumns: [hospitals.id],
			name: "hospital_usage_tracking_hospital_id_fkey"
		}).onDelete("cascade"),
	unique("hospital_usage_tracking_hospital_id_month_key").on(table.hospitalId, table.month),
]);

export const hospitalDepartments = pgTable("hospital_departments", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	hospitalId: uuid("hospital_id").notNull(),
	specialtyId: uuid("specialty_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.hospitalId],
			foreignColumns: [hospitals.id],
			name: "hospital_departments_hospital_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.specialtyId],
			foreignColumns: [specialties.id],
			name: "hospital_departments_specialty_id_fkey"
		}).onDelete("cascade"),
	unique("hospital_departments_hospital_id_specialty_id_key").on(table.hospitalId, table.specialtyId),
]);

export const enumStatus = pgTable("enum_status", {
	status: text().primaryKey().notNull(),
	description: text(),
});

export const assignmentExpiryConfig = pgTable("assignment_expiry_config", {
	priority: text().primaryKey().notNull(),
	expiryHours: integer("expiry_hours").notNull(),
	isActive: boolean("is_active").default(true),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	check("assignment_expiry_config_expiry_hours_check", sql`expiry_hours > 0`),
	check("assignment_expiry_config_priority_check", sql`priority = ANY (ARRAY['routine'::text, 'urgent'::text, 'emergency'::text])`),
]);

export const procedures = pgTable("procedures", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	specialtyId: uuid("specialty_id").notNull(),
	name: text().notNull(),
	description: text(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	categoryId: uuid("category_id"),
	mrp: numeric({ precision: 10, scale:  2 }).default('0'),
}, (table) => [
	index("idx_procedures_is_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	index("idx_procedures_specialty_id").using("btree", table.specialtyId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [procedureCategories.id],
			name: "procedures_category_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.specialtyId],
			foreignColumns: [specialties.id],
			name: "procedures_specialty_id_fkey"
		}).onDelete("cascade"),
	unique("procedures_specialty_id_name_key").on(table.specialtyId, table.name),
]);

export const patients = pgTable("patients", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	hospitalId: uuid("hospital_id").notNull(),
	fullName: text("full_name").notNull(),
	dateOfBirth: date("date_of_birth").notNull(),
	gender: text(),
	phone: text(),
	emergencyContact: text("emergency_contact"),
	address: text(),
	medicalCondition: text("medical_condition"),
	roomType: text("room_type"),
	costPerDay: numeric("cost_per_day", { precision: 10, scale:  2 }),
	medicalNotes: text("medical_notes"),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.hospitalId],
			foreignColumns: [hospitals.id],
			name: "patients_hospital_id_fkey"
		}).onDelete("cascade"),
	check("patients_gender_check", sql`gender = ANY (ARRAY['male'::text, 'female'::text, 'other'::text, 'prefer_not_to_say'::text])`),
	check("patients_room_type_check", sql`room_type = ANY (ARRAY['general'::text, 'private'::text, 'semi_private'::text, 'icu'::text, 'emergency'::text])`),
]);

export const assignments = pgTable("assignments", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	hospitalId: uuid("hospital_id").notNull(),
	doctorId: uuid("doctor_id").notNull(),
	patientId: uuid("patient_id").notNull(),
	procedureId: uuid("procedure_id"),
	procedureTypeId: uuid("procedure_type_id"),
	roomTypeId: uuid("room_type_id"),
	specialtyId: uuid("specialty_id"),
	availabilitySlotId: uuid("availability_slot_id"),
	priority: text().default('medium').notNull(),
	status: text().default('pending').notNull(),
	requestedAt: timestamp("requested_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
	actualStartTime: timestamp("actual_start_time", { mode: 'string' }),
	actualEndTime: timestamp("actual_end_time", { mode: 'string' }),
	treatmentNotes: text("treatment_notes"),
	consultationFee: numeric("consultation_fee", { precision: 10, scale:  2 }),
	cancellationReason: text("cancellation_reason"),
	cancelledBy: text("cancelled_by"),
	cancelledAt: timestamp("cancelled_at", { mode: 'string' }),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	paidAt: timestamp("paid_at", { mode: 'string' }),
}, (table) => [
	index("idx_assignments_doctor").using("btree", table.doctorId.asc().nullsLast().op("uuid_ops")),
	index("idx_assignments_hospital").using("btree", table.hospitalId.asc().nullsLast().op("uuid_ops")),
	index("idx_assignments_patient").using("btree", table.patientId.asc().nullsLast().op("uuid_ops")),
	index("idx_assignments_requested_at").using("btree", table.requestedAt.desc().nullsFirst().op("timestamp_ops")),
	index("idx_assignments_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.availabilitySlotId],
			foreignColumns: [doctorAvailability.id],
			name: "assignments_availability_slot_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.doctorId],
			foreignColumns: [doctors.id],
			name: "assignments_doctor_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.hospitalId],
			foreignColumns: [hospitals.id],
			name: "assignments_hospital_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.patientId],
			foreignColumns: [patients.id],
			name: "assignments_patient_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.procedureId],
			foreignColumns: [procedures.id],
			name: "assignments_procedure_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.procedureTypeId],
			foreignColumns: [procedureTypes.id],
			name: "assignments_procedure_type_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.roomTypeId],
			foreignColumns: [roomTypes.id],
			name: "assignments_room_type_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.specialtyId],
			foreignColumns: [specialties.id],
			name: "assignments_specialty_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.priority],
			foreignColumns: [enumPriority.priority],
			name: "assignments_priority_fkey"
		}),
	foreignKey({
			columns: [table.status],
			foreignColumns: [enumStatus.status],
			name: "assignments_status_fkey"
		}),
	check("assignments_cancelled_by_check", sql`cancelled_by = ANY (ARRAY['hospital'::text, 'doctor'::text, 'system'::text])`),
]);

export const doctorAssignmentUsage = pgTable("doctor_assignment_usage", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	doctorId: uuid("doctor_id").notNull(),
	month: varchar({ length: 7 }).notNull(),
	count: integer().default(0).notNull(),
	limitCount: integer("limit_count").notNull(),
	resetDate: timestamp("reset_date", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("idx_doctor_assignment_usage_doctor_month").using("btree", table.doctorId.asc().nullsLast().op("text_ops"), table.month.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.doctorId],
			foreignColumns: [doctors.id],
			name: "doctor_assignment_usage_doctor_id_fkey"
		}).onDelete("cascade"),
	unique("doctor_assignment_usage_doctor_id_month_key").on(table.doctorId, table.month),
]);

export const enumPriority = pgTable("enum_priority", {
	priority: text().primaryKey().notNull(),
	description: text(),
});

export const assignmentPayments = pgTable("assignment_payments", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	assignmentId: uuid("assignment_id").notNull(),
	hospitalId: uuid("hospital_id").notNull(),
	doctorId: uuid("doctor_id").notNull(),
	consultationFee: numeric("consultation_fee", { precision: 10, scale:  2 }).notNull(),
	platformCommission: numeric("platform_commission", { precision: 10, scale:  2 }).default('0.00').notNull(),
	doctorPayout: numeric("doctor_payout", { precision: 10, scale:  2 }).notNull(),
	paymentStatus: text("payment_status").default('pending').notNull(),
	paidToDoctorAt: timestamp("paid_to_doctor_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	paymentMethod: text("payment_method"),
}, (table) => [
	foreignKey({
			columns: [table.assignmentId],
			foreignColumns: [assignments.id],
			name: "assignment_payments_assignment_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.doctorId],
			foreignColumns: [doctors.id],
			name: "assignment_payments_doctor_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.hospitalId],
			foreignColumns: [hospitals.id],
			name: "assignment_payments_hospital_id_fkey"
		}).onDelete("cascade"),
	unique("assignment_payments_assignment_id_key").on(table.assignmentId),
	check("assignment_payments_payment_method_check", sql`(payment_method IS NULL) OR (payment_method = ANY (ARRAY['upi'::text, 'cash'::text, 'online'::text]))`),
	check("assignment_payments_payment_status_check", sql`payment_status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])`),
]);

export const auditLogs = pgTable("audit_logs", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	userId: uuid("user_id"),
	actorType: text("actor_type").notNull(),
	action: text().notNull(),
	entityType: text("entity_type").notNull(),
	entityId: uuid("entity_id"),
	details: json(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("idx_audit_logs_created_at").using("btree", table.createdAt.desc().nullsFirst().op("timestamp_ops")),
	index("idx_audit_logs_entity").using("btree", table.entityType.asc().nullsLast().op("uuid_ops"), table.entityId.asc().nullsLast().op("text_ops")),
	index("idx_audit_logs_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "audit_logs_user_id_fkey"
		}).onDelete("set null"),
	check("audit_logs_actor_type_check", sql`actor_type = ANY (ARRAY['user'::text, 'system'::text, 'admin'::text, 'webhook'::text])`),
]);

export const webhookLogs = pgTable("webhook_logs", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	source: text().notNull(),
	eventType: text("event_type").notNull(),
	eventId: text("event_id").notNull(),
	payload: json().notNull(),
	processedAt: timestamp("processed_at", { mode: 'string' }),
	status: text().notNull(),
	errorMessage: text("error_message"),
}, (table) => [
	unique("webhook_logs_event_id_key").on(table.eventId),
	check("webhook_logs_status_check", sql`status = ANY (ARRAY['pending'::text, 'processed'::text, 'failed'::text, 'ignored'::text])`),
]);

export const orders = pgTable("orders", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	orderType: text("order_type").notNull(),
	planId: uuid("plan_id"),
	pricingId: uuid("pricing_id"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	amount: bigint({ mode: "number" }).notNull(),
	currency: text().default('USD').notNull(),
	description: text(),
	status: text().default('pending').notNull(),
	gatewayName: text("gateway_name"),
	gatewayOrderId: text("gateway_order_id"),
	userRole: text("user_role"),
	attemptNumber: integer("attempt_number").default(1).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
	paidAt: timestamp("paid_at", { mode: 'string' }),
	failureReason: text("failure_reason"),
	webhookReceived: boolean("webhook_received").default(false).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.planId],
			foreignColumns: [subscriptionPlans.id],
			name: "orders_plan_id_fkey"
		}),
	foreignKey({
			columns: [table.pricingId],
			foreignColumns: [planPricing.id],
			name: "orders_pricing_id_fkey"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "orders_user_id_fkey"
		}).onDelete("cascade"),
	check("orders_order_type_check", sql`order_type = ANY (ARRAY['subscription'::text, 'consultation'::text, 'other'::text])`),
	check("orders_status_check", sql`status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'expired'::text, 'refunded'::text])`),
	check("orders_user_role_check", sql`(user_role IS NULL) OR (user_role = ANY (ARRAY['doctor'::text, 'hospital'::text]))`),
]);

export const assignmentRatings = pgTable("assignment_ratings", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	assignmentId: uuid("assignment_id").notNull(),
	hospitalId: uuid("hospital_id").notNull(),
	doctorId: uuid("doctor_id").notNull(),
	rating: integer().notNull(),
	reviewText: text("review_text"),
	positiveTags: text("positive_tags").array(),
	negativeTags: text("negative_tags").array(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.assignmentId],
			foreignColumns: [assignments.id],
			name: "assignment_ratings_assignment_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.doctorId],
			foreignColumns: [doctors.id],
			name: "assignment_ratings_doctor_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.hospitalId],
			foreignColumns: [hospitals.id],
			name: "assignment_ratings_hospital_id_fkey"
		}).onDelete("cascade"),
	unique("assignment_ratings_assignment_id_key").on(table.assignmentId),
	check("assignment_ratings_rating_check", sql`(rating >= 1) AND (rating <= 5)`),
]);

export const hospitalCancellationFlags = pgTable("hospital_cancellation_flags", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	hospitalId: uuid("hospital_id").notNull(),
	assignmentId: uuid("assignment_id").notNull(),
	severity: text().notNull(),
	policyWindow: text("policy_window").notNull(),
	recordedAt: timestamp("recorded_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.assignmentId],
			foreignColumns: [assignments.id],
			name: "hospital_cancellation_flags_assignment_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.hospitalId],
			foreignColumns: [hospitals.id],
			name: "hospital_cancellation_flags_hospital_id_fkey"
		}).onDelete("cascade"),
	check("hospital_cancellation_flags_severity_check", sql`severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])`),
]);

export const notifications = pgTable("notifications", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	recipientType: text("recipient_type").notNull(),
	recipientId: uuid("recipient_id"),
	title: text().notNull(),
	message: text().notNull(),
	channel: text().notNull(),
	priority: text().default('medium').notNull(),
	assignmentId: uuid("assignment_id"),
	payload: json(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	read: boolean().default(false),
}, (table) => [
	index("idx_notifications_created_at").using("btree", table.createdAt.desc().nullsFirst().op("timestamp_ops")),
	index("idx_notifications_read").using("btree", table.read.asc().nullsLast().op("bool_ops")),
	index("idx_notifications_recipient").using("btree", table.recipientId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.assignmentId],
			foreignColumns: [assignments.id],
			name: "notifications_assignment_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.channel],
			foreignColumns: [enumChannel.channel],
			name: "notifications_channel_fkey"
		}),
	check("notifications_priority_check", sql`priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text])`),
	check("notifications_recipient_type_check", sql`recipient_type = ANY (ARRAY['user'::text, 'role'::text, 'all'::text])`),
]);

export const enumChannel = pgTable("enum_channel", {
	channel: text().primaryKey().notNull(),
	description: text(),
});

export const roomTypes = pgTable("room_types", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	name: text().notNull(),
	displayName: text("display_name").notNull(),
	description: text(),
	baseCostPerDay: numeric("base_cost_per_day", { precision: 10, scale:  2 }).default('0.00'),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	unique("room_types_name_key").on(table.name),
]);

export const doctorProcedureFees = pgTable("doctor_procedure_fees", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	doctorId: uuid("doctor_id").notNull(),
	procedureId: uuid("procedure_id"),
	roomTypeId: uuid("room_type_id").notNull(),
	fee: numeric({ precision: 10, scale:  2 }).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	procedureTypeId: uuid("procedure_type_id"),
	hospitalId: uuid("hospital_id"),
	discountPercentage: numeric("discount_percentage", { precision: 5, scale:  2 }).default('0'),
	status: text().default('pending'),
    statusReason: text("status_reason"),
	notes: text(),
	specialtyId: uuid("specialty_id"),
}, (table) => [
	index("idx_doctor_procedure_fees_doctor_id").using("btree", table.doctorId.asc().nullsLast().op("uuid_ops")),
	index("idx_doctor_procedure_fees_procedure_id").using("btree", table.procedureId.asc().nullsLast().op("uuid_ops")),
	index("idx_doctor_procedure_fees_room_type_id").using("btree", table.roomTypeId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.doctorId],
			foreignColumns: [doctors.id],
			name: "doctor_procedure_fees_doctor_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.hospitalId],
			foreignColumns: [hospitals.id],
			name: "doctor_procedure_fees_hospital_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.procedureId],
			foreignColumns: [procedures.id],
			name: "doctor_procedure_fees_procedure_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.procedureTypeId],
			foreignColumns: [procedureTypes.id],
			name: "doctor_procedure_fees_procedure_type_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.roomTypeId],
			foreignColumns: [roomTypes.id],
			name: "doctor_procedure_fees_room_type_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.specialtyId],
			foreignColumns: [specialties.id],
			name: "doctor_procedure_fees_specialty_id_fkey"
		}).onDelete("cascade"),
	unique("doctor_fee_unique_idx").on(table.doctorId, table.procedureId, table.roomTypeId, table.procedureTypeId, table.hospitalId, table.specialtyId),
	check("doctor_procedure_fees_status_check", sql`status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])`),
]);

export const analyticsEvents = pgTable("analytics_events", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	userId: uuid("user_id"),
	eventType: varchar("event_type", { length: 50 }).notNull(),
	eventName: varchar("event_name", { length: 100 }).notNull(),
	properties: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "analytics_events_user_id_fkey"
		}),
]);

export const supportTickets = pgTable("support_tickets", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	userId: uuid("user_id"),
	bookingId: uuid("booking_id"),
	subject: varchar({ length: 255 }).notNull(),
	description: text().notNull(),
	category: varchar({ length: 50 }),
	priority: varchar({ length: 20 }).default('medium'),
	status: varchar({ length: 20 }).default('open'),
	assignedTo: uuid("assigned_to"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.assignedTo],
			foreignColumns: [users.id],
			name: "support_tickets_assigned_to_fkey"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "support_tickets_user_id_fkey"
		}),
]);

export const userDevices = pgTable("user_devices", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	deviceType: varchar("device_type", { length: 20 }).notNull(),
	deviceToken: text("device_token").notNull(),
	appVersion: varchar("app_version", { length: 20 }),
	osVersion: varchar("os_version", { length: 20 }),
	deviceName: varchar("device_name", { length: 100 }),
	isActive: boolean("is_active").default(true),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_user_devices_device_token").using("btree", table.deviceToken.asc().nullsLast().op("text_ops")),
	index("idx_user_devices_is_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	index("idx_user_devices_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_devices_user_id_fkey"
		}).onDelete("cascade"),
	unique("user_devices_user_id_device_token_key").on(table.userId, table.deviceToken),
	check("user_devices_device_type_check", sql`(device_type)::text = ANY ((ARRAY['ios'::character varying, 'android'::character varying, 'web'::character varying])::text[])`),
]);

export const notificationPreferences = pgTable("notification_preferences", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	bookingUpdatesPush: boolean("booking_updates_push").default(true),
	bookingUpdatesEmail: boolean("booking_updates_email").default(true),
	paymentPush: boolean("payment_push").default(true),
	remindersPush: boolean("reminders_push").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_notification_preferences_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "notification_preferences_user_id_fkey"
		}).onDelete("cascade"),
	unique("notification_preferences_user_id_key").on(table.userId),
]);

export const doctorHospitalDiscounts = pgTable("doctor_hospital_discounts", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	doctorId: uuid("doctor_id").notNull(),
	hospitalId: uuid("hospital_id").notNull(),
	discountPercentage: numeric("discount_percentage", { precision: 5, scale:  2 }).default('0.00').notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.doctorId],
			foreignColumns: [doctors.id],
			name: "doctor_hospital_discounts_doctor_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.hospitalId],
			foreignColumns: [hospitals.id],
			name: "doctor_hospital_discounts_hospital_id_fkey"
		}).onDelete("cascade"),
	unique("doctor_hospital_discounts_unique").on(table.doctorId, table.hospitalId),
]);

export const subscriptionPlans = pgTable("subscription_plans", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	name: text().notNull(),
	tier: text().notNull(),
	userRole: text("user_role").notNull(),
	isActive: boolean("is_active").default(true),
	description: text(),
	defaultBillingCycle: text("default_billing_cycle"),
}, (table) => [
	check("subscription_plans_default_billing_cycle_check", sql`default_billing_cycle = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'yearly'::text, 'custom'::text])`),
	check("subscription_plans_tier_check", sql`tier = ANY (ARRAY['free'::text, 'basic'::text, 'premium'::text, 'enterprise'::text])`),
	check("subscription_plans_user_role_check", sql`user_role = ANY (ARRAY['doctor'::text, 'hospital'::text])`),
]);

export const planPricing = pgTable("plan_pricing", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	planId: uuid("plan_id").notNull(),
	billingCycle: text("billing_cycle").notNull(),
	billingPeriodMonths: integer("billing_period_months").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	price: bigint({ mode: "number" }).notNull(),
	currency: text().default('USD').notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	setupFee: bigint("setup_fee", { mode: "number" }).default(0),
	discountPercentage: numeric("discount_percentage", { precision: 5, scale:  2 }).default('0.00'),
	isActive: boolean("is_active").default(true),
	validFrom: timestamp("valid_from", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	validUntil: timestamp("valid_until", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("idx_plan_pricing_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")).where(sql`(is_active = true)`),
	index("idx_plan_pricing_plan_id").using("btree", table.planId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.planId],
			foreignColumns: [subscriptionPlans.id],
			name: "plan_pricing_plan_id_fkey"
		}).onDelete("cascade"),
	unique("plan_pricing_plan_id_billing_cycle_key").on(table.planId, table.billingCycle),
	check("plan_pricing_billing_cycle_check", sql`billing_cycle = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'yearly'::text, 'custom'::text])`),
]);

export const spatialRefSys = pgTable("spatial_ref_sys", {
	srid: integer().notNull(),
	authName: varchar("auth_name", { length: 256 }),
	authSrid: integer("auth_srid"),
	srtext: varchar({ length: 2048 }),
	proj4Text: varchar({ length: 2048 }),
}, (table) => [
	check("spatial_ref_sys_srid_check", sql`(srid > 0) AND (srid <= 998999)`),
]);
//@ts-ignore
export const subscriptions = pgTable("subscriptions", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	planId: uuid("plan_id").notNull(),
	orderId: uuid("order_id"),
	paymentTransactionId: uuid("payment_transaction_id"),
	status: text().default('active').notNull(),
	startDate: timestamp("start_date", { mode: 'string' }).notNull(),
	endDate: timestamp("end_date", { mode: 'string' }).notNull(),
	autoRenew: boolean("auto_renew").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	billingCycle: text("billing_cycle").default('monthly'),
	billingPeriodMonths: integer("billing_period_months").default(1),
	pricingId: uuid("pricing_id"),
	nextRenewalDate: timestamp("next_renewal_date", { mode: 'string' }),
	lastRenewalDate: timestamp("last_renewal_date", { mode: 'string' }),
	cancelledAt: timestamp("cancelled_at", { mode: 'string' }),
	cancellationReason: text("cancellation_reason"),
	cancelledBy: text("cancelled_by"),
	nextPlanId: uuid("next_plan_id"),
	nextPricingId: uuid("next_pricing_id"),
	planChangeStatus: text("plan_change_status"),
	replacedBySubscriptionId: uuid("replaced_by_subscription_id"),
}, 
//@ts-ignore
(table) => [
	index("idx_subscriptions_end_date").using("btree", table.endDate.asc().nullsLast().op("timestamp_ops")),
	index("idx_subscriptions_next_plan_id").using("btree", table.nextPlanId.asc().nullsLast().op("uuid_ops")).where(sql`(next_plan_id IS NOT NULL)`),
	index("idx_subscriptions_plan_change_status").using("btree", table.planChangeStatus.asc().nullsLast().op("text_ops")).where(sql`(plan_change_status IS NOT NULL)`),
	index("idx_subscriptions_replaced_by_subscription_id").using("btree", table.replacedBySubscriptionId.asc().nullsLast().op("uuid_ops")).where(sql`(replaced_by_subscription_id IS NOT NULL)`),
	index("idx_subscriptions_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_subscriptions_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.nextPlanId],
			foreignColumns: [subscriptionPlans.id],
			name: "subscriptions_next_plan_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.nextPricingId],
			foreignColumns: [planPricing.id],
			name: "subscriptions_next_pricing_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.paymentTransactionId],
			foreignColumns: [paymentTransactions.id],
			name: "subscriptions_payment_transaction_id_fkey"
		}),
	foreignKey({
			columns: [table.planId],
			foreignColumns: [subscriptionPlans.id],
			name: "subscriptions_plan_id_fkey"
		}),
	foreignKey({
			columns: [table.pricingId],
			foreignColumns: [planPricing.id],
			name: "subscriptions_pricing_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.replacedBySubscriptionId],
			foreignColumns: [table.id],
			name: "subscriptions_replaced_by_subscription_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "subscriptions_user_id_fkey"
		}).onDelete("cascade"),
	check("subscriptions_billing_cycle_check", sql`billing_cycle = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'yearly'::text, 'custom'::text])`),
	check("subscriptions_cancelled_by_check", sql`cancelled_by = ANY (ARRAY['user'::text, 'admin'::text, 'system'::text])`),
	check("subscriptions_plan_change_status_check", sql`(plan_change_status IS NULL) OR (plan_change_status = ANY (ARRAY['pending'::text, 'cancelled'::text, 'failed'::text]))`),
	check("subscriptions_status_check", sql`status = ANY (ARRAY['active'::text, 'expired'::text, 'cancelled'::text, 'suspended'::text])`),
]);

export const hospitalPlanFeatures = pgTable("hospital_plan_features", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	planId: uuid("plan_id").notNull(),
	maxPatientsPerMonth: integer("max_patients_per_month"),
	includesPremiumDoctors: boolean("includes_premium_doctors").default(false),
	notes: text(),
	maxAssignmentsPerMonth: integer("max_assignments_per_month"),
}, (table) => [
	foreignKey({
			columns: [table.planId],
			foreignColumns: [subscriptionPlans.id],
			name: "hospital_plan_features_plan_id_fkey"
		}).onDelete("cascade"),
]);

export const notificationRecipients = pgTable("notification_recipients", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	notificationId: uuid("notification_id").notNull(),
	userId: uuid("user_id").notNull(),
	deliveredAt: timestamp("delivered_at", { mode: 'string' }),
	readAt: timestamp("read_at", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.notificationId],
			foreignColumns: [notifications.id],
			name: "notification_recipients_notification_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "notification_recipients_user_id_fkey"
		}).onDelete("cascade"),
]);

export const doctorSpecialties = pgTable("doctor_specialties", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	doctorId: uuid("doctor_id").notNull(),
	specialtyId: uuid("specialty_id").notNull(),
	isPrimary: boolean("is_primary").default(false),
	yearsOfExperience: integer("years_of_experience"),
}, (table) => [
	foreignKey({
			columns: [table.doctorId],
			foreignColumns: [doctors.id],
			name: "doctor_specialties_doctor_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.specialtyId],
			foreignColumns: [specialties.id],
			name: "doctor_specialties_specialty_id_fkey"
		}).onDelete("cascade"),
	unique("doctor_specialties_doctor_id_specialty_id_key").on(table.doctorId, table.specialtyId),
	check("doctor_specialties_years_of_experience_check", sql`years_of_experience >= 0`),
]);

export const webhookEvents = pgTable("webhook_events", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "webhook_events_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	gatewayName: text("gateway_name").notNull(),
	gatewayEventId: text("gateway_event_id").notNull(),
	eventType: text("event_type").notNull(),
	gatewayPaymentId: text("gateway_payment_id").notNull(),
	gatewayOrderId: text("gateway_order_id"),
	paymentTransactionId: uuid("payment_transaction_id"),
	payload: jsonb().notNull(),
	signature: text(),
	processedAt: timestamp("processed_at", { withTimezone: true, mode: 'string' }).notNull(),
	processingStatus: text("processing_status").default('success'),
	errorMessage: text("error_message"),
	retryCount: integer("retry_count").default(0),
	userId: uuid("user_id"),
	subscriptionId: uuid("subscription_id"),
}, (table) => [
	index("idx_webhook_events_event_type").using("btree", table.eventType.asc().nullsLast().op("text_ops")),
	index("idx_webhook_events_gateway_order").using("btree", table.gatewayName.asc().nullsLast().op("text_ops"), table.gatewayOrderId.asc().nullsLast().op("text_ops")),
	index("idx_webhook_events_gateway_payment").using("btree", table.gatewayName.asc().nullsLast().op("text_ops"), table.gatewayPaymentId.asc().nullsLast().op("text_ops")),
	index("idx_webhook_events_processed_at").using("btree", table.processedAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_webhook_events_status").using("btree", table.processingStatus.asc().nullsLast().op("text_ops")),
	index("idx_webhook_events_transaction").using("btree", table.paymentTransactionId.asc().nullsLast().op("uuid_ops")).where(sql`(payment_transaction_id IS NOT NULL)`),
	foreignKey({
			columns: [table.paymentTransactionId],
			foreignColumns: [paymentTransactions.id],
			name: "webhook_events_payment_transaction_id_fkey"
		}),
	unique("uq_gateway_event").on(table.gatewayName, table.gatewayEventId),
]);

export const doctorAvailability = pgTable("doctor_availability", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	doctorId: uuid("doctor_id").notNull(),
	templateId: uuid("template_id"),
	slotDate: date("slot_date").notNull(),
	startTime: time("start_time").notNull(),
	endTime: time("end_time").notNull(),
	status: text().default('available').notNull(),
	isManual: boolean("is_manual").default(false),
	bookedByHospitalId: uuid("booked_by_hospital_id"),
	bookedAt: timestamp("booked_at", { mode: 'string' }),
	notes: text(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	parentSlotId: uuid("parent_slot_id"),
}, (table) => [
	index("idx_availability_date").using("btree", table.slotDate.asc().nullsLast().op("date_ops")),
	index("idx_availability_doctor_date").using("btree", table.doctorId.asc().nullsLast().op("date_ops"), table.slotDate.asc().nullsLast().op("date_ops")),
	index("idx_availability_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.bookedByHospitalId],
			foreignColumns: [hospitals.id],
			name: "doctor_availability_booked_by_hospital_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.doctorId],
			foreignColumns: [doctors.id],
			name: "doctor_availability_doctor_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.parentSlotId],
			foreignColumns: [table.id],
			name: "doctor_availability_parent_slot_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.status],
			foreignColumns: [enumStatus.status],
			name: "doctor_availability_status_fkey"
		}),
	foreignKey({
			columns: [table.templateId],
			foreignColumns: [availabilityTemplates.id],
			name: "doctor_availability_template_id_fkey"
		}).onDelete("set null"),
	check("doctor_availability_check", sql`end_time > start_time`),
]);

export const doctorLeaves = pgTable("doctor_leaves", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	doctorId: uuid("doctor_id").notNull(),
	leaveType: text("leave_type").notNull(),
	startDate: date("start_date").notNull(),
	endDate: date("end_date").notNull(),
	reason: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.doctorId],
			foreignColumns: [doctors.id],
			name: "doctor_leaves_doctor_id_fkey"
		}).onDelete("cascade"),
	check("doctor_leaves_check", sql`end_date >= start_date`),
	check("doctor_leaves_leave_type_check", sql`leave_type = ANY (ARRAY['sick'::text, 'vacation'::text, 'personal'::text, 'emergency'::text, 'other'::text])`),
]);

export const procedureTypeMappings = pgTable("procedure_type_mappings", {
	procedureId: uuid("procedure_id").notNull(),
	typeId: uuid("type_id").notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.procedureId],
			foreignColumns: [procedures.id],
			name: "procedure_type_mappings_procedure_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.typeId],
			foreignColumns: [procedureTypes.id],
			name: "procedure_type_mappings_type_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.procedureId, table.typeId], name: "procedure_type_mappings_procedure_id_type_id_pk"}),
]);
export const geographyColumns = pgView("geography_columns", {	// TODO: failed to parse database type 'name'
	fTableCatalog: text("f_table_catalog"),
	// TODO: failed to parse database type 'name'
	fTableSchema: text("f_table_schema"),
	// TODO: failed to parse database type 'name'
	fTableName: text("f_table_name"),
	// TODO: failed to parse database type 'name'
	fGeographyColumn: text("f_geography_column"),
	coordDimension: integer("coord_dimension"),
	srid: integer(),
	type: text(),
}).as(sql`SELECT current_database() AS f_table_catalog, n.nspname AS f_table_schema, c.relname AS f_table_name, a.attname AS f_geography_column, postgis_typmod_dims(a.atttypmod) AS coord_dimension, postgis_typmod_srid(a.atttypmod) AS srid, postgis_typmod_type(a.atttypmod) AS type FROM pg_class c, pg_attribute a, pg_type t, pg_namespace n WHERE t.typname = 'geography'::name AND a.attisdropped = false AND a.atttypid = t.oid AND a.attrelid = c.oid AND c.relnamespace = n.oid AND (c.relkind = ANY (ARRAY['r'::"char", 'v'::"char", 'm'::"char", 'f'::"char", 'p'::"char"])) AND NOT pg_is_other_temp_schema(c.relnamespace) AND has_table_privilege(c.oid, 'SELECT'::text)`);

export const geometryColumns = pgView("geometry_columns", {	fTableCatalog: varchar("f_table_catalog", { length: 256 }),
	// TODO: failed to parse database type 'name'
	fTableSchema: text("f_table_schema"),
	// TODO: failed to parse database type 'name'
	fTableName: text("f_table_name"),
	// TODO: failed to parse database type 'name'
	fGeometryColumn: text("f_geometry_column"),
	coordDimension: integer("coord_dimension"),
	srid: integer(),
	type: varchar({ length: 30 }),
}).as(sql`SELECT current_database()::character varying(256) AS f_table_catalog, n.nspname AS f_table_schema, c.relname AS f_table_name, a.attname AS f_geometry_column, COALESCE(postgis_typmod_dims(a.atttypmod), sn.ndims, 2) AS coord_dimension, COALESCE(NULLIF(postgis_typmod_srid(a.atttypmod), 0), sr.srid, 0) AS srid, replace(replace(COALESCE(NULLIF(upper(postgis_typmod_type(a.atttypmod)), 'GEOMETRY'::text), st.type, 'GEOMETRY'::text), 'ZM'::text, ''::text), 'Z'::text, ''::text)::character varying(30) AS type FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid AND NOT a.attisdropped JOIN pg_namespace n ON c.relnamespace = n.oid JOIN pg_type t ON a.atttypid = t.oid LEFT JOIN ( SELECT s.connamespace, s.conrelid, s.conkey, replace(split_part(s.consrc, ''''::text, 2), ')'::text, ''::text) AS type FROM ( SELECT pg_constraint.connamespace, pg_constraint.conrelid, pg_constraint.conkey, pg_get_constraintdef(pg_constraint.oid) AS consrc FROM pg_constraint) s WHERE s.consrc ~~* '%geometrytype(% = %'::text) st ON st.connamespace = n.oid AND st.conrelid = c.oid AND (a.attnum = ANY (st.conkey)) LEFT JOIN ( SELECT s.connamespace, s.conrelid, s.conkey, replace(split_part(s.consrc, ' = '::text, 2), ')'::text, ''::text)::integer AS ndims FROM ( SELECT pg_constraint.connamespace, pg_constraint.conrelid, pg_constraint.conkey, pg_get_constraintdef(pg_constraint.oid) AS consrc FROM pg_constraint) s WHERE s.consrc ~~* '%ndims(% = %'::text) sn ON sn.connamespace = n.oid AND sn.conrelid = c.oid AND (a.attnum = ANY (sn.conkey)) LEFT JOIN ( SELECT s.connamespace, s.conrelid, s.conkey, replace(replace(split_part(s.consrc, ' = '::text, 2), ')'::text, ''::text), '('::text, ''::text)::integer AS srid FROM ( SELECT pg_constraint.connamespace, pg_constraint.conrelid, pg_constraint.conkey, pg_get_constraintdef(pg_constraint.oid) AS consrc FROM pg_constraint) s WHERE s.consrc ~~* '%srid(% = %'::text) sr ON sr.connamespace = n.oid AND sr.conrelid = c.oid AND (a.attnum = ANY (sr.conkey)) WHERE (c.relkind = ANY (ARRAY['r'::"char", 'v'::"char", 'm'::"char", 'f'::"char", 'p'::"char"])) AND NOT c.relname = 'raster_columns'::name AND t.typname = 'geometry'::name AND NOT pg_is_other_temp_schema(c.relnamespace) AND has_table_privilege(c.oid, 'SELECT'::text)`);