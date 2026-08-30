# Mobile App Integration Blueprint

This document serves as the comprehensive technical specification for the Mobile App development team. It outlines the newly developed backend features, the specific API endpoints, expected payloads, and how the mobile frontend should implement the UX.

---

## 1. Global Upcoming Calendar
To support a "Google Calendar-style" view where a student can see upcoming content releases, we have built a dedicated endpoint that aggregates dates across courses.

- **Feature:** A unified calendar view showing exactly which courses, modules, or lessons unlock on which days for an entire month.
- **API Endpoint:** `GET /v1/public/calendar` (Can be called with or without Auth token)
- **Query Parameters:**
  - `year` (Required): e.g., 2026
  - `month` (Required): 1 to 12
  - `courseId` (Optional): Filter events for a specific course
  - `filter` (Optional): `ALL` (default), `ENROLLED`, `NON_ENROLLED`. (Requires Auth token if filtering by enrollment).
- **Response Payload:** The backend returns an array mapping *every single day* of the requested month.
  ```json
  {
    "success": true,
    "data": [
      {
        "date": "2026-11-01",
        "events": []
      },
      {
        "date": "2026-11-02",
        "events": [
          {
            "type": "COURSE_LAUNCH",
            "courseId": "course-123",
            "courseTitle": "Mastering UI Design",
            "isEnrolled": false
          },
          {
            "type": "LESSON_UNLOCK",
            "courseId": "course-456",
            "courseTitle": "Advanced Node.js",
            "moduleId": "mod-789",
            "moduleTitle": "Node Internals",
            "lessonId": "les-001",
            "lessonTitle": "Event Loop Internals",
            "isEnrolled": true
          }
        ]
      }
    ]
  }
  ```

---

## 2. Dynamic Course Filters (Tags)
We have removed hardcoded enums for Subjects and Goals. The mobile app must now fetch these dynamically to render filter chips on the "Browse / Search Courses" screen.

- **Feature:** Dynamic Filter Chips (Subjects & Goals)
- **API Endpoint:** `GET /v1/public/settings/categories` (No authentication required)
- **Response Payload:**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "uuid-1",
        "type": "SUBJECT",
        "label": "Graphic Design",
        "value": "GRAPHIC_DESIGN"
      }
    ]
  }
  ```
- **Mobile Implementation:** Cache this response locally (e.g., AsyncStorage or Zustand) on app startup. Use the `label` to render UI chips and use the `value` in the search query parameters when fetching courses.

---

## 3. Drip Content & Upcoming Schedules
The backend now enforces strict payload stripping. If a lesson is scheduled for the future, the video/PDF URL will **never** be sent to the device.

- **Feature:** "Locked Until" UI and Content Security
- **API Endpoint:** `GET /v1/courses/:courseId/learn` (Requires Auth)
- **Response Payload Additions:**
  ```json
  {
    "id": "lesson-1",
    "title": "Advanced UI Patterns",
    "isUnlocked": false,
    "lockedUntil": "2026-11-15T10:00:00Z"
  }
  ```
- **Mobile Implementation:** 
  - If `isUnlocked: false` and `lockedUntil` exists, render a Padlock Icon with a countdown timer (e.g., "Unlocks in 2 Days").
  - Do **not** attempt to call `GET /.../content` for this lesson. If the app tries, the backend will return a `403 Forbidden` error.

---

## 4. Video Progress Engine (Batched Sync)
To save mobile battery, reduce server load, and enable automated certificates, progress syncing has been revamped.

- **Feature:** Batched Progress Sync & Auto-Completion
- **API Endpoint:** `PATCH /v1/courses/:courseId/lessons/:lessonId/progress`
- **Request Payload:**
  ```json
  {
    "watchTimeSec": 245,
    "lastPositionSec": 310,
    "status": "IN_PROGRESS" // Or "COMPLETED"
  }
  ```
- **Response Payload:**
  ```json
  {
    "success": true,
    "data": { /* updated progress object */ },
    "certificateIssued": true, 
    "newlyCreatedCertId": "cert-uuid"
  }
  ```
- **Mobile Implementation:** 
  - **Do not sync every 5 seconds.** Use a local debouncer.
  - Send the sync payload only when: (1) The user pauses the video, (2) The user hits the "Back" button, or (3) The app goes into the background.
  - **90% Rule:** If the user watches 90% of the video duration, the backend will *automatically* override the status to `COMPLETED`. 
  - **Certificate Alert:** If `certificateIssued` is `true` in the response, trigger a celebratory Lottie animation on the device!

---

## 5. Assessment Engine (Quizzes)
Students can now take interactive quizzes. The backend handles the validation securely to prevent API sniffing (cheating).

### A. Fetching the Quiz
- **API Endpoint:** `GET /v1/courses/:courseId/lessons/:lessonId/quiz`
- **Response Payload:** (Notice `correctOptionId` is missing for security)
  ```json
  {
    "success": true,
    "data": {
      "id": "quiz-1",
      "title": "Module 1 Assessment",
      "questions": [
        {
          "id": "q1",
          "text": "What is the primary purpose of Redux?",
          "options": [
            { "id": "opt1", "text": "UI Rendering" },
            { "id": "opt2", "text": "State Management" }
          ]
        }
      ]
    }
  }
  ```

### B. Submitting the Quiz
- **API Endpoint:** `POST /v1/courses/:courseId/lessons/:lessonId/quiz/submit`
- **Request Payload:**
  ```json
  {
    "answers": {
      "q1": "opt2",
      "q2": "opt1"
    }
  }
  ```
- **Response Payload:**
  ```json
  {
    "success": true,
    "data": {
      "attemptId": "attempt-1",
      "score": 100, // Percentage
      "totalQuestions": 2,
      "correctAnswers": 2
    }
  }
  ```
- **Mobile Implementation:** Render a smooth swiping UI for questions. Once submitted, display a modal with their `score`. If they pass, you can trigger a confetti animation and unlock the next module.
