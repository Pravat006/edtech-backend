# Product Requirement Document (PRD) — LMS Backend Platform

## 1. Executive Summary & Project Goal

### 1.1 Project Goal
The primary objective of the **LMS Backend Platform** is to provide a robust, enterprise-grade, high-performance RESTful API backend for a modern Educational Technology (EdTech) and Learning Management System. 

The platform enables students to discover, enroll in, and consume rich multi-modal course content (Videos, PDFs, Quizzes), track their learning progress, interact with AI tutors and community forums, obtain automated certificates, and participate in referral growth loops. Simultaneously, it provides administrative tools for instructors and administrators to manage courses, moderate community channels, and track financial transactions.

### 1.2 Target Audience
* **Students / Learners**: Mobile app and web users seeking structured courses, competitive exam prep, academic learning, and skill development.
* **Instructors / Teachers**: Subject matter experts creating course modules, hosting quizzes, and assisting students.
* **Platform Administrators**: Super and Sub-admins managing course catalogs, reviewing content reports, approving testimonials, and tracking platform metrics.

---

## 2. System Architecture & Tech Stack

### 2.1 Core Technologies
* **Runtime & Framework**: Node.js, TypeScript, Express.js (v5).
* **Database & ORM**: PostgreSQL database powered by Prisma ORM (`@prisma/adapter-pg`).
* **In-Memory Cache & Session Store**: Redis (`ioredis`) for OTP verification, rate-limiting, registration session holding, and JWT revocation (`jti`).
* **Security & Authentication**: Argon2 for password hashing, JWT (Access & Refresh tokens), Helmet for HTTP security headers, CORS, Zod for schema validation.
* **Email & Notifications**: Nodemailer for transactional email delivery.
* **Payment Gateways**: Razorpay and Stripe API integrations for order creation, webhooks, and payment reconciliation.

---

## 3. Client-Side User Stories & User Journey

### 3.1 Authentication
* As a user, I want to register with my phone number so that I can sign up without needing an email or password.
* As a user, I want to receive an OTP via SMS or WhatsApp so that I can verify my identity.
* As a user, I want to log in with my phone number so that I can access my account.
* As a user, I want to log out so that I can secure my account.

### 3.2 Onboarding / Preferences
* As a user, I want to set up my profile with my Name and Email (email can also later be used for account recovery).
* As a user, I want to choose my preferred language so that content is shown to me in the language I understand.
* As a user, I want to choose my subject/topic interest (engineering, arts, science, math, etc.) so that I see relevant courses.
* As a user, I want to choose my goal (popular exams, government exams, etc.) so that course recommendations match what I'm preparing for.
* As a user, I want to edit my preferences later so that I can update my interests as they change.

### 3.3 Course Browsing
* As a user, I want to browse all available courses so that I can explore what's offered.
* As a user, I want to filter courses by subject, language, goal, and price so that I can narrow down my search.
* As a user, I want to search courses by keyword so that I can find something specific.
* As a user, I want to see personalized course recommendations so that I don't have to search from scratch.
* As a user, I want to view a course's details (syllabus, instructor, preview, pricing, reviews) before enrolling so that I can decide if it's right for me.

### 3.4 Enrollment & Payments
* As a user, I want to enroll in a free course instantly so that I can start learning right away.
* As a user, I want to pay for a paid course via UPI/card/netbanking so that I can enroll.
* As a user, I want to receive enrollment confirmation via WhatsApp/SMS so that I know my enrollment went through.
* As a user, I want to apply a coupon/discount code so that I can get a lower price.

### 3.5 Learning Experience
* As a user, I want to watch video lessons and access PDFs/quizzes within a course so that I can learn the material.
* As a user, I want my progress to be tracked and resumable so that I can pick up where I left off.
* As a user, I want to download resources (notes, PDFs) so that I can study offline.
* As a user, I want to receive a certificate on course completion so that I have proof of completion.

### 3.6 AI Doubt-Solving Chat
* As a user, I want to ask the AI chat a question about my current lesson so that I can get a quick answer.
* As a user, I want to ask for a hint instead of a direct answer so that I can work through exam-prep problems myself.
* As a user, I want to view my past AI chat history so that I can revisit earlier doubts.
* As a user, I want to escalate a doubt to a human instructor if the AI can't resolve it so that I still get help.

### 3.7 Notifications
* As a user, I want to receive WhatsApp/SMS notifications for enrollment confirmations, reminders, and new content so that I stay updated.
* As a user, I want in-app notifications for progress nudges and live sessions so that I don't miss anything.

### 3.8 Student Dashboard
* As a user, I want to see all my enrolled courses with progress bars so that I can track my learning.
* As a user, I want to view my payment/order history so that I can keep track of my purchases.

### 3.9 Community Chat
* As a user, I want to join a community chat so that I can discuss topics with other students.
* As a user, I want to post messages/questions in the community chat so that I can interact with peers.
* As a user, I want to see chat organized by course/subject so that discussions stay relevant.
* As a user, I want to report inappropriate messages so that the community stays safe.

### 3.10 WhatsApp Learning Nudges
* As a user, I want to receive daily quiz questions or revision nudges on WhatsApp so that I can keep learning without opening the app.

### 3.11 Exam Countdown-Based Pacing
* As a user, I want my course pace to adjust based on my exam date so that I know what to prioritize each day.
* As a user, I want to see if I'm behind schedule for my exam goal so that I can catch up.

### 3.12 Cohort Leaderboard by Goal
* As a user, I want to see a leaderboard of students with the same exam goal and language so that I can compare progress with a relevant peer group.

### 3.13 Offline Content Access
* As a user, I want to download a course module for offline use so that I can keep learning without a stable internet connection.
* As a user, I want my progress to sync automatically once I'm back online so that nothing is lost.

### 3.14 Shareable Topic-Mastery Badges
* As a user, I want to earn a badge when I complete a topic so that I can share my progress on WhatsApp status.

---

## 4. Technical Specifications & Feature Mapping

### 4.1 Authentication & User Management
* **Redis-Backed Phone/Email Registration & Verification**:
  * Step 1: User submits phone number / email. Data is validated and stored temporarily in Redis (`register:identifier`) with a 5-minute TTL.
  * Step 2: An OTP is generated and sent via SMS or WhatsApp channel (`NotificationChannel`).
  * Step 3: Upon valid OTP verification, the user account is created/verified, and JWT access/refresh tokens are returned.
* **Password & OTP Security**:
  * Secure password/token hashing using Argon2.
  * OTP resend functionality with rate limiting via Redis.
  * Password reset flow via secure email tokens/OTPs.
* **Admin Authentication**:
  * Multi-role support (`SUPER`, `SUB` admin).
  * Email + password authentication paired with dual-factor admin OTP verification.
* **Token Rotation & Session Revocation**:
  * Short-lived Access Tokens paired with long-lived Refresh Tokens using unique JWT identifiers (`jti`).
* **User Onboarding & Preferences**:
  * Personalization setup supporting primary language selection, target subject areas (`ENGINEERING`, `ARTS`, `SCIENCE`, `MATH`, `COMMERCE`, etc.), and learning goals (`POPULAR_EXAMS`, `GOVERNMENT_EXAMS`, `ACADEMIC`, `SKILL_BASED`).

---

### 4.2 Course & Content Management Engine
* **Course Catalog Management**:
  * Course creation with title, description, subject classification, language, pricing (`price`, `isFree`), and publication status (`isPublished`).
  * Instructor assignment to courses (`instructorId` linking to `Admin`).
  * `accessDurationDays Int?` — defines the access window for new purchases (e.g. `365` = 1 year, `null` = lifetime). **Only affects new enrollments**, never retroactively changes existing access.
* **Module & Lesson Hierarchy**:
  * **Modules**: Chapter-level grouping within a course with sequential ordering enforced by `@@unique([courseId, order])`.
  * **Lessons**: Container-level learning units. Each lesson is a sequence of ordered content blocks, not a single file. Ordering enforced by `@@unique([moduleId, order])`.
  * **Lesson Flags**: `durationSec` (for progress % and ETA), `unlockAfterDays` (drip scheduling), `isFreePreview` (accessible without enrollment for trial users).
* **Multi-Block Lesson Content (`LessonContent`)**:
  * Each lesson contains one or more ordered `LessonContent` blocks with type `VIDEO`, `PDF`, `TEXT`, or `QUIZ`.
  * `VIDEO` and `PDF` blocks reference a `MediaAsset` for the actual cloud-hosted file.
  * `TEXT` blocks store inline markdown/rich-text content in a `body` field (no media needed).
  * Example: A single lesson "Newton's Laws" can have — `[1] Video lecture → [2] PDF notes → [3] Text summary → [4] Practice quiz`.
* **Drip Content Scheduling (`unlockAfterDays`)**: Lessons unlock N days after the student's `enrolledAt` date, enabling structured progressive course delivery.

---

### 4.3 Enrollments, Payments & Financial Ledger

```
[ User ] ──► [ Order Request ] ──► [ Payment Gateway (Razorpay/Stripe) ]
                                                   │
                                            (Webhook Verification)
                                                   ▼
[ Enrollment Activated ] ◄── [ Transaction Recorded ] ◄── [ Payment Success ]
```

* **Course Enrollment & Access Validity**:
  * Unique student enrollment constraint (`@@unique([userId, courseId])`).
  * Status management: `ACTIVE`, `COMPLETED`, `CANCELLED`, `REFUNDED`.
  * Coupon code support for discounts at checkout.
  * **Access Validity Snapshotting**: At purchase time, `Enrollment.accessDurationDays` and `Enrollment.expiresAt` are computed from `Course.accessDurationDays` and locked permanently. If an admin later reduces the course's validity window, **existing enrolled users are never affected** — only new buyers get the updated duration. `expiresAt = null` means lifetime access.
  * `@@index([expiresAt])` enables efficient batch queries for expiry reminder notifications.
* **Two-Tier Payment Ledger**:
  * **`Payment` (Order Intent)**: Stores gateway order IDs (`providerOrderId`), gateway provider (`RAZORPAY`, `STRIPE`), currency, amount, and payment status (`PENDING`, `SUCCESS`, `FAILED`, `REFUNDED`).
  * **`Transaction` (Immutable Ledger)**: Tracks all monetary movements — `PAYMENT`, `REFUND`, `REFERRAL_CREDIT` (earned), `REFERRAL_REDEMPTION` (spent as course discount), and `AI_CREDIT_USAGE` (spent on AI features) — with gateway reference IDs (`providerReferenceId`), failure reasons, and raw JSON webhook metadata for full audit compliance.

---

### 4.4 Learning Progress, Offline Sync & Automated Certification
* **Granular Lesson Progress & Offline Sync**:
  * Tracks completion status (`NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`).
  * Video progress tracking: Total watch time (`watchTimeSec`) and last playback position (`lastPositionSec`) to resume playback seamlessly.
  * Offline progress synchronization endpoint to sync offline viewing metrics when reconnected.
* **Automated Certificate Generation & Mastery Badges**:
  * Automatically issues a unique `Certificate` upon 100% course completion.
  * Topic-Mastery badge generation for social sharing (WhatsApp status integration).

---

### 4.5 Quizzes & Assessment System
* **Lesson-Level Assessments**:
  * 1-to-1 or embedded quizzes attached to lessons.
  * Multiple Choice Questions (MCQ) with JSON-encoded options, correct option identifier, and question order.
* **Quiz Attempt & Scoring**:
  * Student submission storage (`answers` JSON).
  * Automated score calculation and instant feedback.
  * Historical quiz attempt logging per user.

---

### 4.6 AI-Powered Learning Assistant & Community
* **Per-Lesson AI Study Companion (`AiChatMessage`)**:
  * Context-aware AI tutor scoped per lesson.
  * Response modes: `quick_answer` (full answer, costs credits) and `hint` (nudge only, free or low cost).
  * `creditCost Int` field on each AI message records how many wallet credits were deducted for that response.
  * Instructor escalation flag (`escalated = true`) when AI cannot resolve a doubt — triggers a human follow-up.
* **Course Community Boards (`CommunityMessage`)**:
  * Course-specific discussion feeds for student-instructor and peer-to-peer interaction.
* **Content Moderation (`MessageReport`)**:
  * Flagging system allowing users to report inappropriate community messages.
  * Admin review workflow with status tracking (`PENDING`, `REVIEWED`, `DISMISSED`).

---

### 4.7 Gamification, Countdown Pacing & Leaderboards
* **Exam Countdown-Based Pacing**:
  * Target exam date tracking on `UserPreferences`.
  * Dynamic daily pacing calculations & progress deficit warnings.
* **Cohort Leaderboards**:
  * Grouped by target goal (`POPULAR_EXAMS`, `GOVERNMENT_EXAMS`, etc.) and preferred language.
* **Referral Engine & Digital Wallet**:
  * Every user gets a unique `ReferralCode` at signup for sharing.
  * `Referral` tracks referrer, referee, code used, and reward status (`PENDING` → `SIGNED_UP` → `REWARDED`).
  * Each user has a `Wallet` with a cached `balanceCredits Int` balance — the real-time sum of all credit transactions.
  * **Credits are earned** via `REFERRAL_CREDIT` transactions when a referred user signs up and converts.
  * **Credits can be spent in two ways**:
    1. **AI Features**: Each AI response deducts `creditCost` from the wallet, recorded as an `AI_CREDIT_USAGE` transaction.
    2. **Course Discounts**: At checkout, users can redeem credits for a price reduction, recorded as a `REFERRAL_REDEMPTION` transaction.
* **Ratings, Reviews & Testimonials**:
  * Course star rating (1–5) and student written reviews (`Review`), one per user per course.
  * Student testimonials (`Testimonial`) with admin approval pipeline and homepage `isFeatured` flag.

---

### 4.8 Multi-Channel Notification & WhatsApp Learning Nudges
* **Notification Delivery**:
  * Multi-channel support (`IN_APP`, `WHATSAPP`, `SMS`).
  * System event triggers: `ENROLLMENT_CONFIRMATION`, `COURSE_REMINDER`, `NEW_CONTENT`, `PROGRESS_NUDGE`, `LIVE_SESSION`.
  * Automated daily quiz & revision nudges delivered via WhatsApp API.
  * Read/unread state tracking.

---

### 4.9 Media Asset Management (`MediaAsset`)
* **Centralized Cloud Asset Registry**:
  * All uploaded media (videos, PDFs, images, certificates, badges) are stored as `MediaAsset` records.
  * Tracks `url` (CDN public URL), unique `storageKey` (S3/Cloudinary path), `provider` (`"cloudinary"`, `"s3"`, `"r2"`), `mimeType`, and `sizeBytes`.
  * **Cloud Portability**: Includes optional `bucket` and `region` fields to ease future cloud provider migrations.
  * `MediaType` enum: `IMAGE`, `VIDEO`, `PDF`, `CERTIFICATE`, `BADGE`.
* **Upload State Machine**:
  * Tracks upload strategy (`SINGLE_PART`, `MULTIPART`) and current status (`INITIATED`, `UPLOADING`, `COMPLETED`, `FAILED`) to ensure robust resumable uploads for large video files.
* **Asset Linkage**:
  * Decouples URLs from core models. All file dependencies are unified under one relational system.
  * `User.avatarMediaId` links user profile pictures.
  * `Course.thumbnailMediaId` links course cover images.
  * `LessonContent` rows link `VIDEO` and `PDF` lesson blocks.

---

## 5. API Endpoint Structure (v1 Specification)

| Domain | Base Route | Key Endpoints | Description |
| :--- | :--- | :--- | :--- |
| **Auth** | `/v1/auth/user` | `POST /register`, `POST /register/verify`, `POST /login`, `POST /otp`, `POST /token/refresh` | User registration (phone/email), OTP verification, login, and token refresh. |
| **Admin Auth** | `/v1/auth/admin` | `POST /login`, `POST /login/verify` | Admin credentials check and 2FA OTP login. |
| **User** | `/v1/user` | `GET /profile`, `PUT /profile`, `GET /preferences`, `POST /preferences`, `GET /dashboard` | User profile, preferences, & student dashboard metrics. |
| **Courses** | `/v1/courses` | `GET /`, `GET /:id`, `POST /` (Admin), `PUT /:id` (Admin), `GET /:id/modules` | Course discovery, searching, filtering, and catalog management. |
| **Enrollments**| `/v1/enrollments` | `POST /`, `GET /my-courses`, `GET /:id/progress`, `POST /sync-progress` | Student course enrollment, progress tracking, and offline progress sync. |
| **Payments** | `/v1/payments` | `POST /checkout`, `POST /webhook`, `GET /history` | Payment checkout creation, coupon redemption, and gateway webhooks. |
| **AI Assistant**| `/v1/ai` | `POST /chat`, `GET /history`, `POST /escalate` | Per-lesson AI doubt solving, hint mode, and escalation. |
| **Community** | `/v1/community` | `GET /:courseId`, `POST /message`, `POST /report` | Community messaging, course feeds, and message flagging. |
| **Leaderboard**| `/v1/leaderboard` | `GET /cohort` | Cohort-based leaderboards filtered by goal and language. |
| **Admin** | `/v1/admin` | `GET /reports`, `PUT /reports/:id`, `GET /testimonials`, `PUT /testimonials/:id/approve` | Content moderation and administrative tools. |
| **Public** | `/v1/public` | `GET /testimonials`, `GET /featured-courses` | Publicly accessible marketing endpoints. |

---

## 6. Non-Functional Requirements (NFRs)

1. **Performance**:
   * Sub-100ms response time for reading course catalogs and user progress.
   * Redis caching for hot datasets (user sessions, active OTPs, rate-limiting tokens).
2. **Security**:
   * All passwords hashed via `Argon2`.
   * SQL Injection prevention via Prisma ORM parameterized queries.
   * Rate limiting enabled to prevent brute-force attacks on auth and OTP endpoints.
   * Input sanitization via strict `Zod` DTO schemas.
3. **Scalability & Reliability**:
   * Stateless Express server design allowing horizontal scaling.
   * Dockerized configuration (`Dockerfile` & `compose.yaml`) with PostgreSQL and Redis services.
