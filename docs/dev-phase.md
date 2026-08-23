# Development Stage Plan

This document outlines the structured, module-by-module implementation plan for the LMS Backend Platform. The development is divided into 6 logical phases, ensuring dependencies are built before the features that rely on them.

---

## Phase 0: Configuration & Third-Party Services
**Goal:** Define and provision all external services, API keys, and environment variables required before writing application logic.

* [ ] **Cloud Storage (AWS S3 / Cloudflare R2 / Cloudinary):**
  * Provision buckets for `MediaAsset` storage (Videos, PDFs, Images, Certificates).
  * Configure IAM roles/policies and presigned-url logic for secure multipart uploads.
  * Set up CDN distribution (e.g., CloudFront) for fast content delivery.
* [ ] **Payment Gateways (Razorpay / Stripe):**
  * Create sandbox accounts and generate API keys.
  * Configure Webhook URLs and Webhook Secrets for secure asynchronous payment verification.
* [ ] **Communication & Notifications (Twilio / Msg91 / WhatsApp Business API):**
  * Provision SMS gateway for fast OTP delivery.
  * Configure WhatsApp Business API for learning nudges and enrollment confirmations.
  * Configure Nodemailer/SendGrid for fallback/transactional email delivery.
* [ ] **AI & LLM Services (OpenAI / Anthropic):**
  * Provision API keys for the AI Doubt-Solving Assistant.
  * Configure system prompts and token limits for `quick_answer` vs `hint` modes.
* [ ] **Background Jobs & Message Queues:**
  * Configure a task queue (e.g., BullMQ backed by Redis) for async tasks like PDF Certificate generation, video transcoding, and batch notification dispatching.
* [ ] **Environment Configuration (`.env`):**
  * Document and define all necessary environment variables (`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, provider API keys).
  * Set up `docker-compose.yml` for running local PostgreSQL and Redis instances during development.

---

## Phase 1: Foundation & Core Infrastructure
**Goal:** Establish the robust base layer, database connections, and security middleware.

* [ ] **Database Setup:** 
  * Run `npx prisma generate` and `npx prisma db push` (or `migrate dev`) to sync the schema.
  * Seed the database with an initial `SUPER` Admin account.
* [ ] **Express Application Core:**
  * Configure Express (v5) router and base folder structure (`/src/modules`, `/src/services`, `/src/middlewares`).
  * Implement Global Error Handling middleware and API response formatter.
* [ ] **Security & Caching Middleware:**
  * Configure CORS, Helmet, and basic API rate-limiting.
  * Connect to Redis (`ioredis`) and write utility functions for caching (`setWithTTL`, `get`, `delete`).

---

## Phase 2: Authentication & User Management
**Goal:** Secure the platform and allow students/admins to log in and manage profiles.

* [ ] **Auth Module (Student):**
  * Implement `AuthService` for Phone Number registration.
  * Implement Redis-backed OTP generation and verification flow.
  * Create JWT utilities (Access & Refresh tokens) and the `requireAuth` middleware.
* [ ] **Auth Module (Admin):**
  * Implement `AdminAuthService` using Argon2 for password hashing and verification.
  * Implement `requireAdmin` middleware (with role checks for `SUPER` vs `SUB`).
* [ ] **User Module:**
  * Implement `UserController` for GET/PUT profile endpoints.
  * Implement endpoints for `UserPreferences` (Language, Goals, Subjects).

---

## Phase 3: Media Assets & Course Content (Admin)
**Goal:** Enable admins to upload videos/PDFs and structure the course catalog.

* [ ] **Media Asset Service:**
  * Build the `MediaAssetService` to handle cloud storage (S3/Cloudinary).
  * Implement the upload state machine (`INITIATED` -> `UPLOADING` -> `COMPLETED`) for handling large multi-part videos.
* [ ] **Course Management Service:**
  * Build full CRUD endpoints for `Course` (Title, Pricing, Validity, Thumbnail linkage).
  * Implement CRUD for `Module`.
* [ ] **Lesson & Content Management:**
  * Implement endpoints to create `Lesson` and its ordered `LessonContent` blocks (VIDEO, PDF, TEXT, QUIZ).
  * Enforce `@@unique` ordering logic when rearranging lessons/modules.

---

## Phase 4: Student Learning Experience
**Goal:** Allow students to discover courses, track progress, and take quizzes.

* [ ] **Course Discovery Module:**
  * Implement public-facing catalog search API (filtering by goal, subject, language, free/paid).
  * Build logic to dynamically attach tags (FREE, SALE, VIDEO, etc.) to API responses.
* [ ] **Progress Tracking Service:**
  * Implement endpoints to record `watchTimeSec` and `lastPositionSec`.
  * Build the Offline Sync API (`/v1/enrollments/sync-progress`) to batch update progress from the mobile app.
* [ ] **Quiz Engine:**
  * Implement `QuizService` to fetch questions and submit `QuizAttempt` payloads.
  * Automate scoring and tracking.

---

## Phase 5: Financials, Enrollments & Gamification
**Goal:** Process payments, grant course access, and run the referral growth loop.

* [ ] **Payment Gateway Integration:**
  * Implement `PaymentService` to generate order intents (Razorpay/Stripe).
  * Build the heavily secured Webhook Controller to process successful payments.
* [ ] **Enrollment & Ledger Service:**
  * On webhook success: create `Transaction` (Immutable Ledger) and activate `Enrollment`.
  * Snapshot `accessDurationDays` into `expiresAt` during enrollment creation.
* [ ] **Referral & Wallet Engine:**
  * Auto-generate `ReferralCode` on user signup.
  * Implement logic to credit `Wallet.balanceCredits` when a referee enrolls.
  * Add logic to apply Wallet credits as discounts during the Payment Checkout flow.

---

## Phase 6: AI, Community & Notifications
**Goal:** Build the interactive, automated, and community-driven features.

* [ ] **AI Doubt-Solving Integration:**
  * Build `AiService` wrapping the OpenAI/Anthropic SDK.
  * Implement the chat endpoint, ensuring it deducts `creditCost` from the `Wallet` and logs an `AI_CREDIT_USAGE` transaction.
  * Implement escalation logic to flag messages for human instructors.
* [ ] **Community & Moderation:**
  * Build endpoints for students to post `CommunityMessage`.
  * Build the reporting/flagging system (`MessageReport`) and the admin review dashboard.
* [ ] **Notification Pipeline:**
  * Implement `NotificationService` capable of routing to SMS, WhatsApp, or In-App tables.
  * Set up cron jobs (or background queues) for sending automated "Exam Countdown" pacing nudges and expiring course reminders.
* [ ] **Certification:**
  * Trigger automated `Certificate` generation (PDF rendering) and `MediaAsset` linkage upon 100% course completion.
