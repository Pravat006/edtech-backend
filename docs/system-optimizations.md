# Comprehensive System Optimization & Cost Analysis

This document outlines critical architectural factors in the current LMS codebase that directly impact **Cloud Server Costs**, **Bandwidth Pricing**, **Database Performance**, and **System Scalability**.

---

## 1. Cloud Infrastructure & Bandwidth Costs

### Video Streaming & Asset Delivery (Highest Cost Risk)
*   **The Issue:** The `LessonContent` model points to `MediaAsset`. If videos and PDFs are served directly from an AWS S3 bucket (or worse, streamed through the Node.js Express server itself), your data transfer costs (Bandwidth egress) will be astronomical. S3 charges roughly $0.09 per GB of outbound data.
*   **The Fix:** 
    1. **Use a CDN (Content Delivery Network):** Place AWS CloudFront or Cloudflare in front of your storage bucket. CDN bandwidth is significantly cheaper (sometimes free via Cloudflare) and caches content closer to the user, improving video load times.
    2. **Adaptive Bitrate Streaming (HLS):** Do not serve raw MP4 files. Use a service like AWS Elemental MediaConvert, Mux, or Cloudflare Stream to transcode videos into HLS. This ensures a mobile user on 3G gets a 480p stream (saving you bandwidth costs) while a desktop user gets 1080p.

### Over-fetching in Course Consumption (`getLearnData`)
*   **The Issue:** As discussed, fetching the *entire* course JSON tree (including all video URLs and text bodies for 100+ lessons) wastes bandwidth if the user only watches 1 lesson per session.
*   **The Fix:** Transition to a **Lazy-Loaded Hybrid Model**. Fetch only the Course Syllabus (Module/Lesson titles) initially, and fetch the heavy `LessonContent` data individually when the user clicks "Play" on a specific lesson.

---

## 2. Database Write Costs & Optimization

### Video Progress Tracking (The "Write Heavy" Problem)
*   **The Issue:** The `PATCH /v1/courses/:courseId/lessons/:lessonId/progress` endpoint tracks `watchTimeSec` and `lastPositionSec`. If the frontend is programmed to hit this API every 5-10 seconds while a user watches a video, your PostgreSQL database will be crushed under a mountain of `UPDATE` queries. Managed databases charge for high IOPS (Input/Output Operations Per Second).
*   **The Fix:** 
    1. **Client-side Debouncing:** Configure the frontend to only send progress updates every 60 seconds, when the video is paused, or when the `beforeunload` event fires (user closes the tab).
    2. **Redis Write-Back Cache:** If you need real-time tracking, write the progress updates to Redis (which handles millions of writes per second easily). Run a CRON job every 5 minutes to flush the Redis progress data in bulk into PostgreSQL.

### Authentication Middleware (The "Read Heavy" Problem)
*   **The Issue:** The `authenticateUser` middleware does a `db.user.findUnique()` on *every single API request*. If an enrolled user clicks through the app quickly, they generate massive read volume on the database just to prove they are logged in.
*   **The Fix:** Store session tokens and basic user roles in a Redis cache. Redis serves reads in <1ms, completely protecting your PostgreSQL database from authentication spam.

---

## 3. Server CPU & Node.js Memory Leaks

### Large JSON Payload Parsing
*   **The Issue:** Node.js runs on a single thread. When Prisma returns a massive nested query (e.g., `getCourseDetail` or `getAdminEnrollments` with hundreds of rows), Node.js must serialize that entire object into a JSON string via `res.json()`. This blocks the event loop.
*   **The Fix:** Implement standard cursor-based pagination strictly across **all** list endpoints. Ensure that `take: limit` is never allowed to exceed a hard cap (e.g., maximum 50 items per request).

### Promise.all() Connection Exhaustion
*   **The Issue:** Using `Promise.all()` with database queries inside `.map()` loops. We recently fixed this in `getMyCourses`, but this anti-pattern must be strictly avoided throughout the codebase.
*   **The Fix:** Always use Prisma's `in` operator (e.g., `where: { id: { in: ids } }`) or `db.$queryRaw` for batch processing. Never run database queries inside loops.

---

## 4. Security & Business Logic Risks

### Coupon Code Verification
*   **The Issue:** The `initiateCheckout` schema accepts an optional `couponCode`. If multiple users attempt to use a limited-use coupon simultaneously, a race condition could allow the coupon to be over-redeemed.
*   **The Fix:** Use Prisma's optimistic concurrency control or a transaction when applying coupons to strictly decrement the `coupon.usageCount` atomically.

### Secure Webhooks
*   **The Issue:** Razorpay webhooks can be re-played by malicious actors if not handled carefully.
*   **The Fix:** We have successfully mitigated this by using `express.raw()` for precise HMAC signature validation and an idempotent state check (`payment.status === "SUCCESS"`) in the transaction block.

---

## Action Plan for MVP Launch
Before deploying to production, prioritize the following:
1. Refactor `getLearnData` to prevent heavy bandwidth payloads.
2. Put Cloudflare/CloudFront in front of all `MediaAsset` URLs.
3. Ensure the frontend strictly debounces the `updateLessonProgress` API calls to max 1 request per minute per active user.
