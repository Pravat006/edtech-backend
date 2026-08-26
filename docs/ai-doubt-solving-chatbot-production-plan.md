# Implementation Plan - AI Doubt Solving Chatbot (Backend First)

Focused **100% on Backend API implementation, testing, and wallet credit integration** before touching mobile client-side code.

---

## 🎯 Phased Strategy

### Phase 1: Backend Infrastructure & API Testing (CURRENT FOCUS)
1. Update Prisma Schema (`ChatConversation`, `ChatMessage`, Wallet credit support).
2. Configure AI Environment Variables & Provider Abstraction (`IAIProvider`, `GeminiProvider`, `OpenAICompatibleProvider`, `MockAiProvider`).
3. Core Business Services (`CourseAccessService`, `CourseContextService`, `ContentGuardService`, `PromptService`, `ResponseCacheService`, `AIChatService`).
4. **Wallet Credit Deduction System**: Check balance, deduct credits per query, log `AI_CREDIT_USAGE` transactions.
5. Create API Controller & Router with flexible test mode (support testing endpoints via `curl`/Postman with query/headers before attaching mandatory JWT auth middleware).
6. Comprehensive Automated & End-to-End API Testing.

### Phase 2: Production Auth & Hardening
1. Lock routes behind `verifyToken` student authentication middleware.
2. Enable production Redis rate limiting.

### Phase 3: Mobile App Integration (DEFERRED)
- Build React Native / Expo UI components (deferred until backend is 100% complete and verified).

---

## 💳 Wallet & Credit System Integration

The backend will directly integrate with the existing `Wallet` and `Transaction` Prisma models:

1. **Credit Check**:
   Before querying the AI provider, `AIChatService` verifies the student's `Wallet` balance:
   ```ts
   const creditCost = envVars.AI_CREDIT_COST_PER_QUERY; // e.g. 1 credit per query (configurable)
   if (wallet.balanceCredits < creditCost) {
       throw new APIError(httpStatus.PAYMENT_REQUIRED, "Insufficient AI credits in your wallet");
   }
   ```

2. **Deduction & Transaction Logging**:
   Upon successful AI response:
   - Decrement `Wallet.balanceCredits` by `creditCost`.
   - Record a `Transaction` entry:
     - `type`: `TransactionType.AI_CREDIT_USAGE`
     - `status`: `TransactionStatus.SUCCESS`
     - `amount`: `creditCost`

3. **Testing Flexibility**:
   Setting `AI_CREDIT_COST_PER_QUERY=0` in `.env` enables **Free / Unlimited Mode** for testing.

---

## ⚠️ User Review Required

> [!NOTE]
> **Backend-Only Focus**: No mobile app code will be written during this phase. All testing will be conducted via node test scripts, `curl`, and automated API integration tests.

---

## 🛠️ Proposed File Changes (Backend Only)

### Component 1: Configuration & Environment Setup

#### [MODIFY] [envVars.ts](file:///home/pravat/Code_file/imp-projects/lms%20platform/backend/src/config/envVars.ts) & [env.ts](file:///home/pravat/Code_file/imp-projects/lms%20platform/backend/src/config/env.ts)
- Add AI & Credit configuration schema variables:
  - `AI_ENABLED`: `z.boolean().default(true)`
  - `AI_PROVIDER`: `z.enum(["gemini", "groq", "openrouter", "openai", "mock"]).default("mock")`
  - `GEMINI_API_KEY`, `GEMINI_MODEL` (`default: "gemini-1.5-flash"`)
  - `GROQ_API_KEY`, `GROQ_MODEL`
  - `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`
  - `OPENAI_API_KEY`, `OPENAI_MODEL`
  - `AI_CREDIT_COST_PER_QUERY`: `z.coerce.number().default(1)`
  - `AI_CACHE_TTL_SECONDS`, `AI_PROMPT_VERSION`

---

### Component 2: Database Layer

#### [MODIFY] [schema.prisma](file:///home/pravat/Code_file/imp-projects/lms%20platform/backend/prisma/schema.prisma)
- Add `ChatConversation` and `ChatMessage` models aligned with section 23 of `docs/ai-doubt-solving-chatbot-production-plan.md`:
```prisma
model ChatConversation {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  courseId  String
  course    Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
  lessonId  String?
  lesson    Lesson?  @relation(fields: [lessonId], references: [id], onDelete: SetNull)
  title     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  messages ChatMessage[]

  @@index([userId, updatedAt])
  @@index([courseId])
  @@index([lessonId])
}

model ChatMessage {
  id             String           @id @default(uuid())
  conversationId String
  conversation   ChatConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  role           ChatRole
  content        String
  fromCache      Boolean          @default(false)

  inputTokens   Int?
  outputTokens  Int?
  totalTokens   Int?
  provider      String?
  model         String?
  promptVersion String?
  creditCost    Int              @default(0)

  createdAt DateTime @default(now())

  @@index([conversationId, createdAt])
}

enum ChatRole {
  USER
  ASSISTANT
  SYSTEM
}
```

---

### Component 3: AI Provider Abstraction (`src/modules/ai-chat/providers/`)

#### [NEW] [ai-provider.interface.ts](file:///home/pravat/Code_file/imp-projects/lms%20platform/backend/src/modules/ai-chat/providers/ai-provider.interface.ts)
- `IAIProvider` interface contract (`generateResponse`, `streamResponse`).

#### [NEW] [gemini.provider.ts](file:///home/pravat/Code_file/imp-projects/lms%20platform/backend/src/modules/ai-chat/providers/gemini.provider.ts)
- Implementation for Google Gemini API using `@google/genai` or `@google/generative-ai`.

#### [NEW] [openai-compatible.provider.ts](file:///home/pravat/Code_file/imp-projects/lms%20platform/backend/src/modules/ai-chat/providers/openai-compatible.provider.ts)
- Reusable provider for Groq, OpenRouter, and OpenAI endpoints.

#### [NEW] [mock.provider.ts](file:///home/pravat/Code_file/imp-projects/lms%20platform/backend/src/modules/ai-chat/providers/mock.provider.ts)
- Provider strategy for local development and testing without API costs.

#### [NEW] [ai-provider.factory.ts](file:///home/pravat/Code_file/imp-projects/lms%20platform/backend/src/modules/ai-chat/providers/ai-provider.factory.ts)
- Factory instantiating current provider strategy based on `envVars.AI_PROVIDER`.

---

### Component 4: Core Services (`src/modules/ai-chat/services/`)

#### [NEW] [course-access.service.ts](file:///home/pravat/Code_file/imp-projects/lms%20platform/backend/src/modules/ai-chat/services/course-access.service.ts)
- Verification of course existence, active student enrollment, and lesson ownership.

#### [NEW] [course-context.service.ts](file:///home/pravat/Code_file/imp-projects/lms%20platform/backend/src/modules/ai-chat/services/course-context.service.ts)
- Aggregation of course & lesson metadata into structured context strings.

#### [NEW] [content-guard.service.ts](file:///home/pravat/Code_file/imp-projects/lms%20platform/backend/src/modules/ai-chat/services/content-guard.service.ts)
- Input length/spam checks & scope boundary verification.

#### [NEW] [prompt.service.ts](file:///home/pravat/Code_file/imp-projects/lms%20platform/backend/src/modules/ai-chat/services/prompt.service.ts)
- Versioned System Prompt builder (`v1`) with injection-resistant context formatting.

#### [NEW] [response-cache.service.ts](file:///home/pravat/Code_file/imp-projects/lms%20platform/backend/src/modules/ai-chat/services/response-cache.service.ts)
- Redis cache store and lookup for standalone common questions.

#### [NEW] [ai-chat.service.ts](file:///home/pravat/Code_file/imp-projects/lms%20platform/backend/src/modules/ai-chat/ai-chat.service.ts)
- Orchestration engine (includes Wallet credit deduction & transaction recording).

---

### Component 5: API Controller & Routes (`src/modules/ai-chat/`)

#### [NEW] [ai-chat.schema.ts](file:///home/pravat/Code_file/imp-projects/lms%20platform/backend/src/modules/ai-chat/ai-chat.schema.ts)
- Zod validation schemas for requests.

#### [NEW] [ai-chat.controller.ts](file:///home/pravat/Code_file/imp-projects/lms%20platform/backend/src/modules/ai-chat/ai-chat.controller.ts)
- Express route handlers (`createConversation`, `sendMessage`, `getConversations`, `getMessages`, `deleteConversation`).

#### [NEW] [ai-chat.routes.ts](file:///home/pravat/Code_file/imp-projects/lms%20platform/backend/src/modules/ai-chat/ai-chat.routes.ts)
- Router definition supporting test mode user parameter headers for initial testing without mandatory auth.

#### [MODIFY] [routes.ts](file:///home/pravat/Code_file/imp-projects/lms%20platform/backend/src/routes.ts)
- Mount `/v1/ai-chat` router.

---

## 🧪 Verification Plan

### Automated Verification
1. `npx prisma generate && npx prisma db push`
2. `npm run build`
3. End-to-end API test script (`scratch/test-ai-chat-api.ts`) verifying:
   - Wallet credit check & deduction (`AI_CREDIT_USAGE` transaction creation).
   - Context fetching from lesson & course tables.
   - Provider response generation (Mock & Gemini).
   - Redis caching for duplicate questions.
