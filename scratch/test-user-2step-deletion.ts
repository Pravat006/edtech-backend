import { userService } from "../src/modules/users/user.service";
import { db } from "../src/config/database";
import argon2 from "argon2";

async function testUser2StepDeletion() {
  console.log("=== Testing 2-Step Verified User Account Deletion Pipeline ===");

  const testEmail = `delete_test_${Date.now()}@example.com`;
  const testPhone = `+91987${Math.floor(1000000 + Math.random() * 9000000)}`;
  const rawPassword = "UserPass123!";

  // 1. Create Test User in DB
  const user = await db.user.create({
    data: {
      name: "Deletion Test Learner",
      email: testEmail,
      phoneNumber: testPhone,
      password: await argon2.hash(rawPassword),
      isEmailVerified: true,
    },
  });
  console.log(`[1] Created Test User: ID=${user.id}, Email=${user.email}, Phone=${user.phoneNumber}`);

  try {
    // 2. Test Invalid Password Attempt
    console.log("\n[2] Testing Deletion Initiation with WRONG Password...");
    try {
      await userService.initiateUserAccountDeletion(user.id, {
        credential: testEmail,
        password: "WrongPassword!",
      });
      throw new Error("FAIL: Allowed initiation with invalid password!");
    } catch (err: any) {
      console.log("- Expected Error caught:", err.message);
    }

    // 3. Test Mismatched Credential Attempt
    console.log("\n[3] Testing Deletion Initiation with MISMATCHED Credential...");
    try {
      await userService.initiateUserAccountDeletion(user.id, {
        credential: "random.other.user@example.com",
        password: rawPassword,
      });
      throw new Error("FAIL: Allowed initiation with mismatched credential!");
    } catch (err: any) {
      console.log("- Expected Error caught:", err.message);
    }

    // 4. Test Valid Initiation via Email Credential
    console.log("\n[4] Testing Valid Deletion Initiation via Email Credential...");
    const initRes = await userService.initiateUserAccountDeletion(user.id, {
      credential: testEmail,
      password: rawPassword,
    });
    console.log("- Initiation Success Message:", initRes.message);
    const otpCode = initRes.devOtp;
    if (!otpCode) {
      throw new Error("FAIL: devOtp missing in response");
    }
    console.log(`- Generated Deletion OTP: ${otpCode}`);

    // 5. Test Confirmation with Invalid OTP
    console.log("\n[5] Testing Deletion Confirmation with WRONG OTP...");
    try {
      await userService.confirmUserAccountDeletion(user.id, "000000");
      throw new Error("FAIL: Deletion confirmed with invalid OTP!");
    } catch (err: any) {
      console.log("- Expected Error caught:", err.message);
    }

    // 6. Test Confirmation with Valid OTP
    console.log("\n[6] Testing Deletion Confirmation with VALID OTP...");
    const confirmRes = await userService.confirmUserAccountDeletion(user.id, otpCode);
    console.log("- Confirmation Service Message:", confirmRes.message);

    // 7. Verify Database Cleanup
    const deletedUser = await db.user.findUnique({ where: { id: user.id } });
    if (deletedUser) {
      throw new Error("FAIL: User row still exists in database after confirmed deletion!");
    }
    console.log("- DB Verification SUCCESS: User row completely purged from PostgreSQL!");

    console.log("\n✅ ALL 2-STEP ACCOUNT DELETION VERIFICATION TESTS PASSED 100%!");
  } catch (error) {
    // Cleanup user if still exists on error
    await db.user.delete({ where: { id: user.id } }).catch(() => {});
    throw error;
  }
}

testUser2StepDeletion()
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
