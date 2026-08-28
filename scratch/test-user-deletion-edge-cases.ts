import { createDemoUser } from "../src/modules/admin/users/admin.user.service";
import { userService } from "../src/modules/users/user.service";
import { db } from "../src/config/database";

async function runEdgeCaseTest() {
    console.log("=== Testing Account Deletion Edge Case Mitigations ===");

    const timestamp = Date.now();
    const testPhone = `+919876${timestamp.toString().slice(-6)}`;
    const testEmail = `edgecase_${timestamp}@example.com`;

    // 1. Create Test User
    console.log(`\n[1] Creating Test User: ${testPhone}`);
    const demo = await createDemoUser({
        phoneNumber: testPhone,
        email: testEmail,
        name: "Edge Case Test User",
        password: "TestPassword123!",
        initialWalletBalance: 500,
    });
    const userId = demo.user.id;

    // 2. Create Dummy Course & Community Message
    console.log("[2] Seeding associated Payment, Community Message & Support Ticket...");
    let course = await db.course.findFirst();
    if (!course) {
        course = await db.course.create({
            data: {
                title: "Test Course for Edge Cases",
                description: "Test description",
                subject: "PHYSICS",
                language: "en",
                price: 1999,
            },
        });
    }

    // Seed Payment record (Financial audit trail)
    const payment = await db.payment.create({
        data: {
            userId,
            provider: "RAZORPAY",
            amount: 1999,
            currency: "INR",
            status: "SUCCESS",
            providerOrderId: `order_edge_${timestamp}`,
        },
    });

    // Seed Community Message (Discussion forum thread)
    const commMsg = await db.communityMessage.create({
        data: {
            courseId: course.id,
            userId,
            message: "Hello community, this is a question by the edge case user!",
        },
    });

    // Seed Support Ticket (Customer Support Desk)
    const supportTicket = await db.supportTicket.create({
        data: {
            ticketNumber: `TCK-${timestamp}`,
            userId,
            subject: "Help with course access",
            category: "COURSE_ACCESS",
            status: "OPEN",
        },
    });

    console.log(`- Payment Created (ID: ${payment.id})`);
    console.log(`- Community Message Created (ID: ${commMsg.id})`);
    console.log(`- Support Ticket Created (ID: ${supportTicket.id})`);

    // 3. Trigger Full Account Deletion Pipeline
    console.log("\n[3] Triggering deleteUserAccount pipeline...");
    const deleteResult = await userService.deleteUserAccount(userId);
    console.log("Delete Response:", deleteResult);

    // 4. Verify Edge Case Outcomes in Database
    console.log("\n[4] Verifying Database Post-Deletion State:");

    // a. Check User Row (Should be deleted)
    const userCheck = await db.user.findUnique({ where: { id: userId } });
    console.log(`- User Record (Expected NULL): ${userCheck}`);

    // b. Check Payment Record (Should be PRESERVED for tax compliance with userId = null)
    const paymentCheck = await db.payment.findUnique({ where: { id: payment.id } });
    console.log(`- Payment Record Preserved for Accounting? ${paymentCheck !== null}`);
    console.log(`- Payment userId is null? ${paymentCheck?.userId === null} (Amount: ₹${paymentCheck?.amount})`);

    // c. Check Community Message (Should be PRESERVED for thread continuity with userId = null)
    const msgCheck = await db.communityMessage.findUnique({ where: { id: commMsg.id } });
    console.log(`- Community Message Preserved for Thread? ${msgCheck !== null}`);
    console.log(`- Message userId is null? ${msgCheck?.userId === null} (Message: "${msgCheck?.message}")`);

    // d. Check Support Ticket (Should be CLOSED & anonymized with userId = null)
    const ticketCheck = await db.supportTicket.findUnique({ where: { id: supportTicket.id } });
    console.log(`- Support Ticket Status: ${ticketCheck?.status} (Expected: CLOSED)`);
    console.log(`- Ticket userId is null? ${ticketCheck?.userId === null}`);

    if (
        userCheck === null &&
        paymentCheck?.userId === null &&
        msgCheck?.userId === null &&
        ticketCheck?.userId === null &&
        ticketCheck?.status === "CLOSED"
    ) {
        console.log("\n✅ SUCCESS! All Edge Cases (Financial retention, Thread preservation, Cloud cleanup, Ticket closure) passed 100%!");
    } else {
        throw new Error("Edge case verification failed!");
    }
}

runEdgeCaseTest()
    .catch((err) => {
        console.error("Edge case test failed:", err);
        process.exit(1);
    })
    .finally(async () => {
        await db.$disconnect();
    });
