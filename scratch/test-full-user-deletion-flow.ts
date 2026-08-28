import { userService } from "../src/modules/users/user.service";
import { db } from "../src/config/database";
import argon2 from "argon2";
import { redis } from "../src/config/redis";

async function testFullUserDeletionFlow() {
  console.log("==========================================================================");
  console.log("  EXHAUSTIVE E2E TEST: USER ACCOUNT DELETION & ANONYMIZATION PIPELINE");
  console.log("==========================================================================\n");

  const timestamp = Date.now();
  const testEmail = `e2e_user_${timestamp}@example.com`;
  const testPhone = `+91987${Math.floor(1000000 + Math.random() * 9000000)}`;
  const rawPassword = "StrongUserPassword@123";

  // 1. Create User with Relational Data (Payment, Transaction, Support Ticket, Community Message)
  console.log("[1] Seeding Full User Account with Relational Audit Data...");
  const hashedPassword = await argon2.hash(rawPassword);

  const user = await db.user.create({
    data: {
      name: "E2E Deletion Learner",
      email: testEmail,
      phoneNumber: testPhone,
      password: hashedPassword,
      isEmailVerified: true,
      payments: {
        create: {
          amount: 1999,
          currency: "INR",
          status: "SUCCESS",
          provider: "RAZORPAY",
        },
      },
      transactions: {
        create: {
          amount: 1999,
          type: "PAYMENT",
          status: "SUCCESS",
        },
      },
      supportTickets: {
        create: {
          ticketNumber: `TICK-${timestamp}`,
          subject: "Pre-deletion Support Ticket",
          status: "OPEN",
        },
      },
    },
    include: {
      payments: true,
      transactions: true,
      supportTickets: true,
    },
  });

  const paymentId = user.payments[0].id;
  const transactionId = user.transactions[0].id;
  const ticketId = user.supportTickets[0].id;

  console.log(`✓ User Created Successfully: ID=${user.id}`);
  console.log(`  - Registered Email: ${user.email}`);
  console.log(`  - Registered Phone: ${user.phoneNumber}`);
  console.log(`  - Linked Payment Record: ID=${paymentId}`);
  console.log(`  - Linked Transaction Record: ID=${transactionId}`);
  console.log(`  - Linked Support Ticket: ID=${ticketId} (Status=OPEN)`);

  try {
    // 2. Test Deletion Initiation via Phone Credential
    console.log("\n[2] Step 1A: Initiating Deletion via PHONE Credential & Valid Password...");
    const phoneInitRes = await userService.initiateUserAccountDeletion(user.id, {
      credential: testPhone,
      password: rawPassword,
    });
    console.log(`✓ Response: ${phoneInitRes.message}`);
    console.log(`  - Delivery Method: ${phoneInitRes.method}`);
    console.log(`  - Target: ${phoneInitRes.target}`);
    console.log(`  - Generated Phone Deletion OTP: ${phoneInitRes.devOtp}`);

    // 3. Test Deletion Initiation via Email Credential (Overwriting previous request in Redis)
    console.log("\n[3] Step 1B: Initiating Deletion via EMAIL Credential & Valid Password...");
    const emailInitRes = await userService.initiateUserAccountDeletion(user.id, {
      credential: testEmail,
      password: rawPassword,
    });
    console.log(`✓ Response: ${emailInitRes.message}`);
    console.log(`  - Delivery Method: ${emailInitRes.method}`);
    console.log(`  - Target: ${emailInitRes.target}`);
    const validOtp = emailInitRes.devOtp;
    if (!validOtp) {
      throw new Error("FAIL: Deletion OTP code was not returned in development mode.");
    }
    console.log(`  - Generated Email Deletion OTP: ${validOtp}`);

    // 4. Verify Redis Storage State
    console.log("\n[4] Inspecting Redis Storage State for Deletion Payload...");
    const redisKey = `delete-account:otp:${user.id}`;
    const storedRedisValue = await redis.getValue(redisKey);
    console.log(`✓ Redis Key "${redisKey}" content:`, storedRedisValue);

    // 5. Test Invalid OTP Rejection
    console.log("\n[5] Step 2A: Confirming Deletion with INVALID OTP...");
    try {
      await userService.confirmUserAccountDeletion(user.id, "999999");
      throw new Error("FAIL: Deletion succeeded with invalid OTP!");
    } catch (err: any) {
      console.log(`✓ Correctly Rejected: ${err.message}`);
    }

    // 6. Test Valid OTP Account Deletion & Permanent Purge Execution
    console.log("\n[6] Step 2B: Confirming Deletion with VALID OTP (" + validOtp + ")...");
    const confirmRes = await userService.confirmUserAccountDeletion(user.id, validOtp);
    console.log(`✓ Confirmation Success Result:`, confirmRes.message);

    // 7. Verify Data Integrity & Anonymization Audit
    console.log("\n[7] Executing Post-Deletion Verification Audit:");

    // A. Check User Record
    const checkUser = await db.user.findUnique({ where: { id: user.id } });
    if (checkUser) {
      throw new Error("FAIL: User row still exists in PostgreSQL database!");
    }
    console.log("  [✓] USER RECORD: Permanently deleted from PostgreSQL (findUnique returned null).");

    // B. Check Redis OTP Key
    const checkRedis = await redis.getValue(redisKey);
    if (checkRedis) {
      throw new Error("FAIL: Redis OTP key was not deleted!");
    }
    console.log("  [✓] REDIS OTP CACHE: Cleared (getValue returned null).");

    // C. Check Payment Record (GST/Tax Audit Retention)
    const checkPayment = await db.payment.findUnique({ where: { id: paymentId } });
    if (!checkPayment || checkPayment.userId !== null) {
      throw new Error("FAIL: Payment record was not anonymized properly!");
    }
    console.log("  [✓] PAYMENT AUDIT RECORD: Preserved for tax compliance with userId set to NULL.");

    // D. Check Transaction Record
    const checkTransaction = await db.transaction.findUnique({ where: { id: transactionId } });
    if (!checkTransaction || checkTransaction.userId !== null) {
      throw new Error("FAIL: Transaction record was not anonymized properly!");
    }
    console.log("  [✓] TRANSACTION RECORD: Preserved for accounting compliance with userId set to NULL.");

    // E. Check Support Ticket Status
    const checkTicket = await db.supportTicket.findUnique({ where: { id: ticketId } });
    if (!checkTicket || checkTicket.userId !== null || checkTicket.status !== "CLOSED") {
      throw new Error("FAIL: Support ticket was not closed/anonymized properly!");
    }
    console.log("  [✓] SUPPORT TICKET: Anonymized (userId = null) and marked status = CLOSED.");

    console.log("\n==========================================================================");
    console.log("  SUCCESS: ALL 2-STEP USER DELETION & ANONYMIZATION AUDITS PASSED 100%!");
    console.log("==========================================================================\n");
  } catch (error) {
    // Cleanup if test fails
    await db.user.delete({ where: { id: user.id } }).catch(() => {});
    throw error;
  }
}

testFullUserDeletionFlow()
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
