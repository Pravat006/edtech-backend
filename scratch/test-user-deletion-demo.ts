import { createDemoUser, deleteUser } from "../src/modules/admin/users/admin.user.service";
import { userService } from "../src/modules/users/user.service";
import { db } from "../src/config/database";

async function runTest() {
    console.log("=== Testing Admin Demo User Creation & Account Deletion APIs ===");

    const timestamp = Date.now();
    const demoPhone = `+9199990${timestamp.toString().slice(-5)}`;
    const demoEmail = `reviewer_${timestamp}@example.com`;

    // 1. Test Admin Demo User Creation
    console.log(`\n[1] Creating Demo User for Google Reviewers: ${demoPhone} / ${demoEmail}`);
    const demoResult = await createDemoUser({
        phoneNumber: demoPhone,
        email: demoEmail,
        name: "Google Play Store Reviewer",
        password: "DemoReviewerPass123!",
        initialWalletBalance: 1000,
    });

    console.log("Demo Creation Result:", JSON.stringify(demoResult, null, 2));

    if (!demoResult.user.id) {
        throw new Error("Failed to create demo user");
    }

    const createdUserId = demoResult.user.id;

    // 2. Verify User Exists in Database with pre-verified status
    const dbUser = await db.user.findUnique({
        where: { id: createdUserId },
        include: { wallet: true }
    });

    console.log("\n[2] Database User Verification:");
    console.log(`User ID: ${dbUser?.id}`);
    console.log(`Phone Verified: ${dbUser?.isEmailVerified}`);
    console.log(`Wallet Balance Credits: ${dbUser?.wallet?.balanceCredits}`);

    // 3. Test Self User Account Deletion
    console.log("\n[3] Testing Self Account Deletion (DELETE /v1/users/profile)...");
    const selfDeleteResult = await userService.deleteUserAccount(createdUserId);
    console.log("Self Delete Response:", selfDeleteResult);

    // 4. Verify Database Clean Up after deletion
    const deletedUserCheck = await db.user.findUnique({ where: { id: createdUserId } });
    console.log(`Database User Check after deletion (Expect null): ${deletedUserCheck}`);

    if (deletedUserCheck !== null) {
        throw new Error("User account was not completely deleted from database!");
    }

    // 5. Test Admin User Deletion on another dummy user
    console.log("\n[4] Testing Admin User Deletion (DELETE /v1/admin/users/:userId)...");
    const adminDemoPhone = `+9188880${timestamp.toString().slice(-5)}`;
    const secondDemo = await createDemoUser({
        phoneNumber: adminDemoPhone,
        name: "Admin Target User",
        password: "AdminDeletePass123!",
        initialWalletBalance: 200,
    });

    const adminDeleteResult = await deleteUser(secondDemo.user.id);
    console.log("Admin Delete Response:", adminDeleteResult);

    console.log("\nSUCCESS! All User Deletion & Admin Demo User APIs executed error-free.");
}

runTest()
    .catch((err) => {
        console.error("Test failed with error:", err);
        process.exit(1);
    })
    .finally(async () => {
        await db.$disconnect();
    });
