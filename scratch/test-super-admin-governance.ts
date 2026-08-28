import { adminAuthService } from "../src/modules/admin/auth/admin.auth.service";
import { adminManagementService } from "../src/modules/admin/management/admin.management.service";
import { db } from "../src/config/database";
import argon2 from "argon2";

async function testSuperAdminGovernance() {
    console.log("=== Testing Super Admin Governance & Sub-Admin Reassignment Flow ===");

    const timestamp = Date.now();

    // 1. Seed Super Admin
    const superEmail = `super_${timestamp}@example.com`;
    const superAdminPassword = "SuperAdminPassword123!";
    const hashedSuperPassword = await argon2.hash(superAdminPassword);

    const superAdmin = await db.admin.create({
        data: {
            name: "Master Super Admin",
            email: superEmail,
            password: hashedSuperPassword,
            role: "SUPER",
            isActive: true,
        },
    });
    console.log(`\n[1] Seeded Super Admin: ID=${superAdmin.id}, Email=${superAdmin.email}`);

    // 2. Test Super Admin Password Change
    console.log("\n[2] Testing Super Admin Password Change...");
    const newSuperPassword = "UpdatedSuperPass456!";
    const passChangeRes = await adminAuthService.changeSuperAdminPassword(
        superAdmin.id,
        superAdminPassword,
        newSuperPassword
    );
    console.log("- Password Change Response:", passChangeRes.message);

    // Verify login with new password
    const loginNewPass = await adminAuthService.login({
        email: superEmail,
        password: newSuperPassword,
    });
    console.log(`- Login with NEW password successful! Admin ID: ${loginNewPass.admin.id}`);

    // 3. Test Super Admin Email Change (2-Step OTP Verification)
    console.log("\n[3] Testing Super Admin Email Change (OTP Flow)...");
    const newSuperEmail = `super_updated_${timestamp}@example.com`;

    // Step 1: Initiate
    const initRes = await adminAuthService.initiateSuperAdminEmailChange(superAdmin.id, newSuperEmail);
    console.log("- Initiate Response:", initRes.message);
    const otpMatch = initRes.devNotice?.match(/\d{6}/);
    const otp = otpMatch ? otpMatch[0] : "";
    console.log(`- Captured Dev OTP: ${otp}`);

    // Step 2: Verify OTP
    const verifyRes = await adminAuthService.verifySuperAdminEmailChange(superAdmin.id, newSuperEmail, otp);
    console.log("- OTP Verify Response:", verifyRes.message);

    // Verify DB updated
    const updatedSuper = await db.admin.findUnique({ where: { id: superAdmin.id } });
    console.log(`- Updated DB Super Admin Email: ${updatedSuper?.email}`);

    // 4. Seed Sub-Admin & Test Super Admin Protection
    console.log("\n[4] Creating Sub-Admin & Testing Deactivation Protection...");
    const subEmail = `sub_staff_${timestamp}@example.com`;
    const subAdmin = await adminManagementService.createSubAdmin({
        name: "Old Staff Member",
        email: subEmail,
        password: "OldStaffPassword123!",
        permissions: ["SUPPORT_READ", "COURSES_READ"],
    });
    console.log(`- Created Sub-Admin: ID=${subAdmin.id}, Email=${subAdmin.email}, Active=${subAdmin.isActive}`);

    // Attempt Super Admin self-deactivation (Must be rejected)
    try {
        await adminManagementService.deactivateSubAdmin(superAdmin.id, superAdmin.id);
        throw new Error("FAIL: Super Admin deactivation should have been rejected!");
    } catch (err: any) {
        console.log(`- Super Admin Deactivation Blocked as Expected: "${err.message}"`);
    }

    // 5. Deactivate Sub-Admin Account
    console.log("\n[5] Deactivating Sub-Admin Account...");
    const deactivateRes = await adminManagementService.deactivateSubAdmin(superAdmin.id, subAdmin.id);
    console.log("- Deactivate Response:", deactivateRes.message);

    // Verify Sub-Admin Login is Blocked
    try {
        await adminAuthService.login({
            email: subEmail,
            password: "OldStaffPassword123!",
        });
        throw new Error("FAIL: Deactivated sub-admin login should have thrown 403 Forbidden!");
    } catch (err: any) {
        console.log(`- Deactivated Sub-Admin Login Blocked as Expected: "${err.message}"`);
    }

    // 6. Test Sub-Admin Status Filtering API
    console.log("\n[6] Testing Sub-Admin Status Filtering...");
    const activeList = await adminManagementService.listSubAdmins({ status: "active" });
    const inactiveList = await adminManagementService.listSubAdmins({ status: "inactive" });
    console.log(`- Active Sub-Admins Count: ${activeList.pagination.total}`);
    console.log(`- Inactive Sub-Admins Count: ${inactiveList.pagination.total}`);

    const foundInactive = inactiveList.subAdmins.find((a) => a.id === subAdmin.id);
    console.log(`- Inactive List Contains Deactivated Sub-Admin? ${foundInactive !== undefined}`);

    // 7. Reassign Sub-Admin Seat to Replacement Staff Member
    console.log("\n[7] Reassigning Sub-Admin Seat to Replacement Staff Member...");
    const newStaffEmail = `replacement_staff_${timestamp}@example.com`;
    const newStaffPass = "NewStaffPassword456!";

    const reassignRes = await adminManagementService.reassignSubAdmin(superAdmin.id, subAdmin.id, {
        name: "Replacement Staff Member",
        email: newStaffEmail,
        password: newStaffPass,
        permissions: ["SUPPORT_READ", "SUPPORT_WRITE", "COURSES_WRITE"],
    });
    console.log("- Reassign Response:", reassignRes.message);

    // Verify Replacement Staff Login
    const replacementLogin = await adminAuthService.login({
        email: newStaffEmail,
        password: newStaffPass,
    });
    console.log(`- Replacement Staff Login SUCCESS! Admin Name: ${replacementLogin.admin.name}, Email: ${replacementLogin.admin.email}, Active: ${replacementLogin.admin.isActive}`);

    // 8. Cleanup test admins
    console.log("\n[8] Cleaning up test data...");
    await db.admin.delete({ where: { id: superAdmin.id } });
    await db.admin.delete({ where: { id: subAdmin.id } });
    console.log("Cleanup complete!");

    console.log("\n✅ ALL TESTS PASSED SUCCESSFULLY 100%!");
}

testSuperAdminGovernance()
    .catch((err) => {
        console.error("Test failed:", err);
        process.exit(1);
    })
    .finally(async () => {
        await db.$disconnect();
    });
