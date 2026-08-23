# Backend Query Performance Analytics

This document provides a comprehensive analysis of the database query architecture across all LMS modules. It evaluates the performance complexity ("P values" / Big O notation), query counts per request, and outlines strategies for optimization as the platform scales.

---

## 1. Courses Module (`src/modules/courses/course.service.ts`)

### `getMyCourses` (The N+1 Bottleneck)
*   **Query Pattern:** 1 initial `findMany` for enrollments, followed by a `Promise.all()` `.map()` loop that executes `lessonProgress.count()` and `lessonProgress.findFirst()` for *every single course*.
*   **Performance (P Value):** $O(N)$ network roundtrips to the DB (where $N$ is the number of enrolled courses). Total queries: $1 + 2N$.
*   **Impact:** Severe. A user with 20 courses fires 41 simultaneous queries, instantly exhausting the Prisma connection pool and crashing the server under load.
*   **Optimization Strategy:** **Raw SQL Aggregation**. 
    *   Extract `courseIds` and execute a single `db.$queryRaw` using `GROUP BY m."courseId"`.
    *   This reduces the query count to **exactly 2**, bringing the performance to $O(1)$ network roundtrips and significantly reducing Node.js memory footprint.

### `getCourses` & `getPersonalisedCourses`
*   **Query Pattern:** `findMany` with cursor-based pagination and relation counts (`_count: { enrollments }`).
*   **Performance (P Value):** $O(1)$ network roundtrip. 1 query executed.
*   **Impact:** Highly optimized. Cursor-based pagination ensures the query remains fast even with 100,000+ courses.
*   **Optimization Strategy:** Currently optimal. For future scaling, ensure indexes exist on `(isPublished, createdAt)` and `(categoryId)`.

### `getCourseDetail`
*   **Query Pattern:** Deeply nested `findUnique` with `include` fetching modules, lessons, and instructor details in a single tree.
*   **Performance (P Value):** $O(1)$ network roundtrip. Prisma resolves this using JSON aggregation internally in PostgreSQL.
*   **Impact:** Good database performance, but the JSON payload sent over the network to the frontend can become massive if the course has 500+ lessons.
*   **Optimization Strategy:** In the future, implement **shallow fetching**. Do not fetch all lessons on the initial load. Fetch only the modules, and lazy-load lessons when the user clicks to expand a module accordion.

### `updateLessonProgress`
*   **Query Pattern:** Sequential queries: verify lesson -> check enrollment -> upsert progress -> count total progress -> optionally issue certificate.
*   **Performance (P Value):** $O(1)$ network roundtrips, but involves ~5-6 sequential queries per request.
*   **Impact:** Acceptable for now, but high latency because the server waits for one query to finish before starting the next.
*   **Optimization Strategy:** Wrap the entire operation in a single `db.$transaction`. Prisma will send the transaction block in a single network roundtrip to PostgreSQL, cutting latency by 80%.

---

## 2. Enrollments Module (`src/modules/enrollments/enrollment.service.ts`)

### `getUserEnrollments`
*   **Query Pattern:** `findMany` with cursor pagination.
*   **Performance (P Value):** $O(1)$ roundtrip. 1 query.
*   **Impact:** Extremely performant.
*   **Optimization Strategy:** Optimal. Ensure a composite index on `(userId, enrolledAt DESC)` exists in the database.

### `getUserEnrollmentDetails`
*   **Query Pattern:** `findUnique` including deeply nested `payment` and `transactions` relations for invoice rendering.
*   **Performance (P Value):** $O(1)$ roundtrip. 1 query.
*   **Impact:** Fast and efficient.
*   **Optimization Strategy:** Optimal.

---

## 3. Payments Module (`src/modules/payments/payment.service.ts`)

### `initiateCheckout` & `verifyPayment`
*   **Query Pattern:** Heavy use of `db.$transaction` to guarantee atomicity (e.g., updating payment status, creating enrollment, and logging audit transactions simultaneously).
*   **Performance (P Value):** $O(1)$ network roundtrip for the transaction block.
*   **Impact:** Excellent. Using `$transaction` prevents partial data writes (like charging a user but failing to grant course access).
*   **Optimization Strategy:** Ensure idempotency is strictly maintained. The current `verifyPayment` idempotency check correctly prevents race conditions if the webhook and frontend verify hit the DB at the exact same millisecond.

---

## 4. Admin Module (`src/modules/enrollments/admin-enrollment.service.ts`)

### `getAdminEnrollments`
*   **Query Pattern:** 2 queries executed sequentially: `findMany` for data + `count` for the total dashboard metric.
*   **Performance (P Value):** $O(1)$ network roundtrips, but 2 sequential queries.
*   **Impact:** Slower than necessary. Counting a large table with complex `LIKE` search filters (e.g., `contains: search, mode: "insensitive"`) triggers full-table scans.
*   **Optimization Strategy:** 
    1. Run `findMany` and `count` concurrently using `Promise.all([ db.enrollment.findMany(...), db.enrollment.count(...) ])`.
    2. For the `search` functionality, implement **PostgreSQL Full-Text Search (FTS)** or a dedicated search engine (like Typesense/Elasticsearch) instead of `mode: "insensitive" LIKE` queries, which cannot use standard B-Tree indexes.

---

## 5. Auth & User Module (`src/modules/auth/auth.service.ts`)

### Token Validation (`authenticateUser` Middleware)
*   **Query Pattern:** `findUnique` on `User` and `Session/Token` tables per API request.
*   **Performance (P Value):** $O(1)$ roundtrip, but executes on **every single protected route**.
*   **Impact:** High database load. If you have 1,000 active users making 1 request per second, your database handles 1,000 authentication queries per second just to verify tokens.
*   **Optimization Strategy:** **Redis Caching**. Move session verification to Redis. When a user logs in, store their session ID and role in Redis. The middleware should check Redis (sub-millisecond latency) instead of hitting PostgreSQL on every request.

---

## Summary of Critical Action Items

1. **URGENT**: Refactor `getMyCourses` to use the `db.$queryRaw` grouping strategy to eliminate the $1 + 2N$ query bottleneck.
2. **HIGH PRIORITY**: Wrap `updateLessonProgress` in a `db.$transaction` to reduce network latency during video playback tracking.
3. **MEDIUM PRIORITY**: Introduce Redis caching for the Auth middleware to protect PostgreSQL from heavy session-lookup traffic.
4. **LONG TERM**: Implement database-level Full-Text Search for the Admin dashboards to prevent slow table scans.
