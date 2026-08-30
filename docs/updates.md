# Feature Implementation Plan

This document outlines the architecture, database changes, and real-world edge cases for the major requested features.

## User Review Required
> [!IMPORTANT]  
> I have added a note about the **Dynamic Client-Side Filtration** based on your insight. If everything looks good, please approve and we will begin building!

---

## 1. Dynamic Course Categories (Subjects & Goals)

**Architecture:**
- **Database Migration:** 
  1. We will remove the hardcoded `Subject` and `Goal` enums from Prisma.
  2. We will change the `subject` field on the `Course` model to a standard `String`, and the `goals` field to a string array (`String[]`). This ensures the API JSON response shape remains exactly the same, preventing any frontend breakage.
  3. We will create a new configuration table:
  ```prisma
  model CourseCategoryConfig {
    id        String   @id @default(uuid())
    type      String   // "SUBJECT" or "GOAL"
    value     String   @unique // The backend identifier (e.g., "MEDICAL_SCIENCE")
    label     String   // The human-readable name (e.g., "Medical Sciences")
    isActive  Boolean  @default(true)
  }
  ```
- **Admin Flow:** The dashboard will have a "Categories" settings page where you can manually add, edit, or deactivate Subjects and Goals. 
- **Public Filtration (Client-Side):** The mobile app/web app will fetch this config list dynamically. This allows the client-side to render dynamic filter chips (e.g., in the "Browse Courses" screen) without hardcoding the filter options in the app code!

**Real-World Edge Cases Addressed:**
- **Soft Deletion:** If you delete/deactivate a subject (e.g., "Arts") that is already attached to 10 existing courses, those existing courses will not break or lose their data because they just store the raw string. The subject will simply stop appearing in the dropdown for *new* courses.

---

## 2. Quizzes & Automated Scoring (Assessment Engine)

**Architecture:**
- **Database:** Utilize the existing `Quiz`, `Question`, and `QuizAttempt` models. 
- **Admin Creation Flow (Dual-Approach):**
  1. **Manual UI Builder:** A drag-and-drop UI to manually type questions and select correct options.
  2. **Bulk CSV/JSON Import:** Admins upload a file to instantly bulk-insert 50+ questions. The backend validates that every row has a correct answer.
- **Student Flow:** Students fetch the quiz (without answers). The backend validates their submitted JSON against the database to prevent cheating.

**Real-World Edge Cases Addressed:**
- **Cheating Prevention:** Correct answers never touch the client-side until graded.
- **Partial Submissions:** Missing keys in the submission JSON are safely scored as 0.

---

## 3. Video Progress Tracking (Client-First Batched Sync) & Certificates

**Architecture:**
Instead of hammering the server with an API call every 10 seconds, we will use a **Client-First Batched Syncing** approach to drastically reduce server costs.

- **Local State Engine:** As the student watches the video, the exact `watchTimeSec` and `lastPositionSec` are constantly saved to the device's local storage.
- **Event-Driven API Sync:** The client only fires the `POST /v1/enrollments/progress/sync` API to update the database during specific lifecycle events:
  1. **On Unmount:** When the user clicks away.
  2. **On Background:** When the user minimizes the app or closes the browser tab.
  3. **On Completion:** When the video reaches the very end.
  4. **Fail-Safe Timer:** A lightweight sync every 60 seconds just in case their phone battery dies unexpectedly.

**Real-World Edge Cases Addressed:**
- **Fast-Forwarding / Scrubbing:** The local state tracks cumulative *watch time*, not just the scrubber position. Skipping to the end will not trigger a completion.
- **Automated Certificates:** When the final sync pushes a course to 100% completion, a background job dynamically generates the PDF certificate, uploads it to Bunny CDN, and saves it in the database.

---

## 4. Upcoming Lesson & Course Scheduling (Drip Release)

**Architecture:**
- **Database Migration:** Add a `scheduledPublishDate DateTime?` field to the `Course`, `Module`, and `Lesson` models.
- **Admin Flow:** Set specific modules/lessons to unlock on fixed calendar dates.
- **Student Flow:** The API returns the upcoming lessons in the syllabus with a `lockedUntil` countdown flag.

**Absolute Security (Payload Stripping):**
If a course, module, or lesson has a `scheduledPublishDate` in the future, the backend API will **completely strip out** the internal content before sending the JSON response to the user's device. 
- The user will *only* receive the `id`, `title`, and `scheduledPublishDate`.
- The `LessonContent` array (which contains the `body`, `video`, and `pdf` URLs) will be entirely wiped from the payload, preventing tech-savvy students from bypassing the UI.

---

## 5. Platform Configuration (Dynamic Settings)

**Architecture:**
- **Database Migration:** Create a new `PlatformSetting` model (key/value/updatedAt).
- **Admin Flow:** A Settings page in the dashboard to edit keys like `PLATFORM_NAME` or `CONTACT_PHONE`.
- **Public API (`GET /v1/public/settings`):** A fast endpoint that the mobile/web app fetches on launch to populate the UI dynamically.

**Real-World Edge Cases Addressed:**
- **Performance:** Heavily cached in Redis to prevent database bottlenecks on app launch.
