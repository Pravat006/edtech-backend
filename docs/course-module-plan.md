# Course Module Implementation Plan

Based on the Prisma schema, the Course Module is split into two primary surfaces:
- **User (Mobile App)** — browse, discover, and consume courses
- **Admin (Web Dashboard)** — create, manage, and publish content

---

## 1. Database Entities Involved

| Model | Purpose |
|---|---|
| `Course` | Core entity — title, price, discount, subject, language, goals |
| `Module` | Ordered section inside a course |
| `Lesson` | Video/content piece inside a module. Has `isFreePreview`, `unlockAfterDays` |
| `LessonContent` | Multiple content blocks per lesson (VIDEO, PDF, TEXT) |
| `Enrollment` | Tracks user access. Has `accessDurationDays`, `expiresAt` |
| `LessonProgress` | Tracks per-lesson watch time and completion status |
| `Review` | Rating (Int) + optional comment per enrolled user per course |
| `Certificate` | Issued when course is fully completed |

---

## 2. User (Mobile App) Routes

All routes below are prefixed with `/v1/courses` and protected by `authenticateUser` middleware.

### A. Discovery & Browsing

---

## Content Access Control Model

This is a core rule that governs every course-related endpoint.

> **All `/v1/courses` routes require a valid JWT (`authenticateUser` middleware).** There is no anonymous browsing — users must be logged in to access anything.

| Data | Logged In (Not Enrolled) | Enrolled |
|---|---|---|
| Course title, description, subject, price | ✅ | ✅ |
| Instructor name, avg rating, reviews | ✅ | ✅ |
| Module titles | ✅ | ✅ |
| Lesson titles + `durationSec` | ✅ | ✅ |
| Free preview lessons (`isFreePreview: true`) | ✅ | ✅ |
| Lesson video URLs / PDF URLs | ❌ | ✅ |
| Lesson text/notes content (`body`) | ❌ | ✅ |
| Quiz questions | ❌ | ✅ |
| Drip-locked lessons (`unlockAfterDays` not reached) | ❌ | ❌ (locked even for enrolled) |
| User's own progress data | ❌ | ✅ |

**Rule summary**:
- `GET /v1/courses/:courseId` → Auth required. Returns metadata + syllabus skeleton (no content URLs).
- `GET /v1/courses/:courseId/learn` → Auth + active Enrollment required. Returns full content with drip logic applied.
- `isFreePreview: true` lessons → content served to any authenticated user, even without enrollment.

---

**`GET /v1/courses`** — Course Feed
- Returns all `isPublished: true` courses, paginated (cursor-based for mobile infinite scroll).
- **Query params**: `subject`, `language`, `isFree`, `search` (title contains), `cursor`, `limit`.
- **Response**: Lean list — id, title, subject, price, discountPrice, isFree, thumbnailUrl, instructor name, avg rating, total enrolled count.

**`GET /v1/courses/for-you`** — Personalised Feed ⭐
- Reads the authenticated user's `UserPreferences.subjects` and `UserPreferences.goals`.
- Returns published courses **matching the user's subjects first**, then fills remaining slots with popular courses.
- Algorithm:
  1. Query `Course` where `subject IN user.preferences.subjects` AND `isPublished = true`
  2. Exclude courses the user is already enrolled in.
  3. Fill remaining slots with highest-enrolled courses if preference matches are < `limit`.
- **This is the home screen feed for the mobile app.**

**`GET /v1/courses/:courseId`** — Course Detail Page (Public)
- **No auth required** — any user (even unauthenticated) can view this.
- Returns: course title, description, subject, language, price, instructor name, avg rating, enrollment count, first 3 reviews.
- Returns full module/lesson structure — **titles and `durationSec` only. No content URLs, no body text, no quiz data.**
- If the request is authenticated, includes `isEnrolled: boolean` and `progressPercent: number` (completion %).

### B. Learning

**`GET /v1/courses/my-courses`** — Enrolled Courses
- Returns all courses the authenticated user has an active `Enrollment` for.
- Includes per-course progress % (completed lessons / total lessons).
- Filters out expired enrollments (`expiresAt < now`).

**`GET /v1/courses/:courseId/learn`** — Course Player Data
- **Security**: Verifies the user has an active, non-expired `Enrollment` for this course.
- Returns the full module/lesson structure **with content URLs** (video, PDF).
- For each lesson, calculates drip content unlock status:
  ```
  isUnlocked = (now - enrollment.enrolledAt) >= lesson.unlockAfterDays days
  ```
- Returns `userProgress` per lesson: `status`, `watchTimeSec`, `lastPositionSec`.
- Free preview lessons (`isFreePreview: true`) are returned even without enrollment.

**`PATCH /v1/courses/:courseId/lessons/:lessonId/progress`** — Save Watch Progress
- Body: `{ watchTimeSec: number, lastPositionSec: number, status: "IN_PROGRESS" | "COMPLETED" }`
- Upserts a `LessonProgress` record.
- **Enrollment expiry check**: Verify `enrollment.expiresAt > now` before allowing any progress save. Expired enrollments become read-only.
- Certificate trigger: Only issue a certificate if all lessons in the course are `COMPLETED` **and** no certificate already exists for that enrollment (idempotency guard).

### C. Reviews

**`POST /v1/courses/:courseId/reviews`** — Submit Review
- Guards: User must have an active enrollment. One review per user per course (`@@unique([userId, courseId])`).
- Body: `{ rating: number (1-5), comment?: string }`
- Only allowed after user has completed at least one lesson (prevents spam reviews from day-0 enrollees).

**`PUT /v1/courses/:courseId/reviews`** — Edit Own Review
- User can update their own rating/comment. Replaces the existing review record.

**`DELETE /v1/courses/:courseId/reviews`** — Delete Own Review
- User can remove their own review.

**`GET /v1/courses/:courseId/reviews`** — List Reviews
- Auth required (consistent with all course routes). Paginated, sorted by most recent.

---

## 3. Admin (Web Dashboard) Routes

All routes below are prefixed with `/v1/admin/courses` and protected by `verifyAdmin` middleware.
Both SUPER and SUB admins can perform content management — ownership rules apply throughout.

### Course Lifecycle

```
Create Draft → Add Modules + Lessons → Upload Content → Publish
     ↓              ↓                                      ↓
Can update      Can always add more                   Students can
at any time     modules/lessons later                  enroll
```

A course is never "locked" for the instructor — SUB admins can freely add new modules, new lessons,
or update any details at any time, even after the course is published and students are enrolled.

---

### A. Course CRUD

**`GET /v1/admin/courses`** — List Courses
- **SUPER**: Returns all courses on the platform with instructor name.
- **SUB**: Returns only courses where `instructorId === req.admin.id`.
- Includes enrollment count, avg rating, revenue (sum of successful payments).

**`POST /v1/admin/courses`** — Create Draft Course
- Auto-assigns `instructorId: req.admin.id`.
- Creates with `isPublished: false` by default.
- Body: `{ title, description, subject, language, goals[], price, isFree, accessDurationDays? }`
- No modules or lessons required at creation time — the instructor adds those separately.

**`PUT /v1/admin/courses/:courseId`** — Update Course Details
- Ownership check: `req.admin.role === 'SUPER' || course.instructorId === req.admin.id`
- Can update **any** course field at any time (before or after publishing):
  `title, description, subject, language, goals[], price, discountPrice, discountValidUntil, isFree, accessDurationDays`

**`PATCH /v1/admin/courses/:courseId/publish`** — Publish / Unpublish
- Ownership check applies.
- Toggles `isPublished`. Cannot publish a course with zero modules/lessons.
- Unpublishing hides the course from the student feed but does **not** revoke existing enrollments.

**`DELETE /v1/admin/courses/:courseId`** — Delete Course
- SUPER only — cascades through modules, lessons, enrollments.

---

### B. Module Management (Incremental)

Modules can be added to a course at any point — at creation, or weeks after publishing.

**`GET /v1/admin/courses/:courseId/modules`** — List all modules with their lessons.

**`POST /v1/admin/courses/:courseId/modules`** — Add a New Module
- Works on both draft and published courses.
- Body: `{ title, order }`
- `order` determines display sequence. Can reorder by updating.

**`PUT /v1/admin/courses/:courseId/modules/:moduleId`** — Update Module
- Body: `{ title?, order? }`

**`DELETE /v1/admin/courses/:courseId/modules/:moduleId`** — Delete Module
- Cascade deletes all lessons inside. Irreversible.

---

### C. Lesson Management (Incremental)

Lessons can be added to any module at any point — same flexibility as modules.

**`POST /v1/admin/courses/:courseId/modules/:moduleId/lessons`** — Add a New Lesson
- Can be added to any existing module on any published/draft course.
- Body: `{ title, order, durationSec?, unlockAfterDays?, isFreePreview? }`

**`PUT /v1/admin/courses/:courseId/modules/:moduleId/lessons/:lessonId`** — Update Lesson
- Body: `{ title?, order?, durationSec?, unlockAfterDays?, isFreePreview? }`

**`POST /v1/admin/courses/:courseId/modules/:moduleId/lessons/:lessonId/content`** — Add Content Block
- Attach actual video/PDF/text to a lesson.
- Body: `{ type: "VIDEO" | "PDF" | "TEXT", order, title?, body?, mediaId? }`

**`PUT /v1/admin/.../content/:contentId`** — Update a Content Block

**`DELETE /v1/admin/.../lessons/:lessonId`** — Delete Lesson (cascade deletes its content blocks)

---

### D. Analytics (SUPER only)

**`GET /v1/admin/courses/:courseId/analytics`**
- Returns: total enrollments, active vs expired, completion rate, avg rating, total revenue.
- **Both SUPER and SUB admins** can access analytics for courses they own. SUPER can access any course.

**`GET /v1/admin/courses/:courseId/preview`** — Student Preview Mode
- Allows the admin/instructor to see exactly what the course looks like to a non-enrolled student.
- Returns the same response shape as `GET /v1/courses/:courseId` (titles only, no content).
- Works for both draft and published courses — useful for proofreading before publishing.


---

## 4. Preference-Based Feed — Detailed Strategy

This is the core of personalisation on the mobile app home screen.

```
User logs in → their UserPreferences.subjects + UserPreferences.goals are known
         ↓
GET /v1/courses/for-you
         ↓
Service query:
  1. Fetch courses WHERE subject IN [user's subjects] AND isPublished = true
     AND id NOT IN [user's enrolled course ids]
     ORDER BY enrollments count DESC
     LIMIT 10

  2. If result < 10, fetch popular courses (by enrollment count) to fill the gap,
     excluding already-matched and already-enrolled courses.

  3. Return merged list, preference-matched courses come first.
```

**Response shape** (same as the general course list, mobile-optimised):
```json
{
  "success": true,
  "data": {
    "personalised": [...],   // matched user's preferences
    "popular": [...]         // fill-up popular courses
  }
}
```

**Edge case**: New user with no preferences set → return top 10 most enrolled published courses. Frontend should prompt them to complete preferences.

---

## 5. Implementation Steps

1. **Zod Schemas** (`course.schema.ts`):
   - `CreateCourseSchema`, `UpdateCourseSchema`
   - `CreateModuleSchema`, `CreateLessonSchema`
   - `CourseListQuerySchema` (for filter/pagination params)
   - `SubmitReviewSchema`, `UpdateProgressSchema`

2. **Course Service** (`course.service.ts`):
   - `getCourses(filters, cursor)` — public feed
   - `getPersonalisedCourses(userId)` — preference-matched feed
   - `getCourseDetail(courseId, userId)` — with enrollment status and progress %
   - `getLearnData(courseId, userId)` — with drip unlock + expiry check
   - `updateProgress(userId, lessonId, data)` — with idempotent certificate trigger

3. **Admin Course Service** (`admin.course.service.ts`):
   - Separate service for admin-facing queries (ownership checks, analytics, preview)

4. **Controllers & Routes**:
   - `course.controller.ts` + `course.routes.ts` for mobile
   - `admin.course.controller.ts` + mounted in `admin.routes.ts`

---

## 6. Real-World Edge Cases & Improvements

These are scenarios that must be handled correctly in the service layer:

| Scenario | Handling |
|---|---|
| Lesson added after user finishes course | New lesson resets completion to < 100%. Certificate is NOT auto-revoked — it's already earned. |
| Instructor deletes a lesson with existing student progress | `LessonProgress` cascades. Overall progress % recalculates based on remaining lessons. |
| Module order gap after deletion | Re-normalise `order` values on siblings after any delete (e.g. delete order 2 → shift order 3 to 2). |
| Admin tries to delete a published course with active enrollments | Block hard delete. Only SUPER can force delete. Consider a soft-delete `isArchived` flag instead. |
| User tries to enroll in an expired-discount course | Price charged is always the current `price`, not the old `discountPrice`. Validate `discountValidUntil > now` at enrollment time. |
| User completes a free-preview lesson | Progress for free-preview lessons should only be tracked if the user is enrolled. Ignore progress saves for non-enrolled. |
| Certificate already issued, user re-completes after adding new lessons | Do NOT re-issue a duplicate certificate. Use `@@unique([enrollmentId])` on Certificate model — already enforced in schema. |
| Enrollment expires mid-course | `GET /v1/courses/:courseId/learn` returns `403 Enrollment expired`. Previously saved progress is still visible but no new progress saves are accepted. |
