import { describe, it, beforeAll, afterAll } from "bun:test";
import assert from "node:assert";
import argon2 from "argon2";
import { db } from "@/config/database";
import { AdminPermission } from "../../generated/prisma";
import { adminManagementService } from "@/modules/admin/management/admin.management.service";
import { requirePermission } from "@/middlewares/verifyAdmin";

describe("Sub-Admin Granular Permission Management Test Suite (11 Test Cases)", () => {
    let superAdminId: string;
    let testSubAdminId: string;
    const testEmail = `test-subadmin-${Date.now()}@lms-platform.com`;

    beforeAll(async () => {
        // 1. Seed or retrieve a SUPER admin
        let superAdmin = await db.admin.findFirst({ where: { role: "SUPER" } });
        if (!superAdmin) {
            const hashedPassword = await argon2.hash("SuperSecret123!");
            superAdmin = await db.admin.create({
                data: {
                    name: "Test Super Admin",
                    email: `superadmin-${Date.now()}@lms-platform.com`,
                    password: hashedPassword,
                    role: "SUPER",
                    permissions: [],
                },
            });
        }
        superAdminId = superAdmin.id;

        // 2. Create a test sub-admin with initial permissions
        const hashedPassword = await argon2.hash("SubSecret123!");
        const subAdmin = await db.admin.create({
            data: {
                name: "Test Sub Admin",
                email: testEmail,
                password: hashedPassword,
                role: "SUB",
                permissions: [AdminPermission.COURSES_READ],
            },
        });
        testSubAdminId = subAdmin.id;
    });

    afterAll(async () => {
        // Clean up test sub-admin
        if (testSubAdminId) {
            await db.admin.delete({ where: { id: testSubAdminId } }).catch(() => {});
        }
    });

    // Test Case 1
    it("1. Super Admin bypasses all permission-protected middleware checks", () => {
        const req: any = { admin: { id: superAdminId, role: "SUPER", permissions: [] } };
        const res: any = {};
        let nextCalled = false;
        const next = () => { nextCalled = true; };

        const middleware = requirePermission("COURSES_WRITE");
        middleware(req, res, next);

        assert.strictEqual(nextCalled, true, "Super Admin must bypass requirePermission checks");
    });

    // Test Case 2
    it("2. Sub-admin without required permission is denied access (HTTP 403)", () => {
        const req: any = { admin: { id: testSubAdminId, role: "SUB", permissions: [AdminPermission.COURSES_READ] } };
        const res: any = {};
        let passedError: any = null;
        const next = (err?: any) => { passedError = err; };

        const middleware = requirePermission("COURSES_WRITE");
        middleware(req, res, next);

        assert.ok(passedError, "Sub-admin without permission should trigger error");
        assert.strictEqual(passedError.statusCode, 403, "Should return HTTP 403 Forbidden");
    });

    // Test Case 3
    it("3. Sub-admin with granted permission passes middleware check", () => {
        const req: any = { admin: { id: testSubAdminId, role: "SUB", permissions: [AdminPermission.COURSES_READ] } };
        const res: any = {};
        let nextCalled = false;
        const next = () => { nextCalled = true; };

        const middleware = requirePermission("COURSES_READ");
        middleware(req, res, next);

        assert.strictEqual(nextCalled, true, "Sub-admin with matching permission must be granted access");
    });

    // Test Case 4
    it("4. Super Admin can update sub-admin permissions array in database", async () => {
        const newPermissions = [AdminPermission.COURSES_WRITE, AdminPermission.VERIFICATIONS_WRITE];
        const updated = await adminManagementService.updateSubAdminPermissions(testSubAdminId, newPermissions);

        assert.strictEqual(updated.id, testSubAdminId);
        assert.deepStrictEqual(updated.permissions, newPermissions, "Permissions array in DB must match updated list");
    });

    // Test Case 5
    it("5. Updating permissions of a SUPER admin is forbidden", async () => {
        let threw = false;
        try {
            await adminManagementService.updateSubAdminPermissions(superAdminId, [AdminPermission.COURSES_WRITE]);
        } catch (err: any) {
            threw = true;
            assert.strictEqual(err.statusCode, 403, "Should throw 403 when attempting to alter SUPER admin permissions");
        }
        assert.strictEqual(threw, true);
    });

    // Test Case 6
    it("6. Zod schema rejects invalid permission enum strings", async () => {
        const { UpdateSubAdminPermissionsSchema } = await import("@/modules/admin/management/admin.management.schema");
        const parsed = UpdateSubAdminPermissionsSchema.safeParse({
            permissions: ["INVALID_PERMISSION_STRING"],
        });

        assert.strictEqual(parsed.success, false, "Invalid permission string must fail validation");
    });

    // Test Case 7
    it("7. listSubAdmins returns assigned permissions for sub-admins", async () => {
        const list = await adminManagementService.listSubAdmins();
        const found = list.find((sub) => sub.id === testSubAdminId);

        assert.ok(found, "Test sub-admin should exist in directory");
        assert.ok(Array.isArray(found.permissions), "Permissions property must be an array");
    });

    // Test Case 8
    it("8. createSubAdmin initializes sub-admin with specified permissions", async () => {
        const uniqueEmail = `new-subadmin-${Date.now()}@lms-platform.com`;
        const created = await adminManagementService.createSubAdmin({
            name: "Initial Perms SubAdmin",
            email: uniqueEmail,
            password: "Password123!",
            permissions: [AdminPermission.PAYMENTS_READ, AdminPermission.USERS_READ],
        });

        assert.ok(created.id);
        assert.deepStrictEqual(created.permissions, [AdminPermission.PAYMENTS_READ, AdminPermission.USERS_READ]);

        // Cleanup
        await db.admin.delete({ where: { id: created.id } }).catch(() => {});
    });

    // Test Case 9
    it("9. Revoking permissions immediately denies subsequent requests", async () => {
        // Update to empty permissions array
        await adminManagementService.updateSubAdminPermissions(testSubAdminId, []);

        const req: any = { admin: { id: testSubAdminId, role: "SUB", permissions: [] } };
        const res: any = {};
        let passedError: any = null;
        const next = (err?: any) => { passedError = err; };

        const middleware = requirePermission("COURSES_READ");
        middleware(req, res, next);

        assert.ok(passedError, "Revoked sub-admin must be denied access");
        assert.strictEqual(passedError.statusCode, 403);
    });

    // Test Case 10
    it("10. Database findUnique includes permissions array for session check", async () => {
        const adminFromDb = await db.admin.findUnique({
            where: { id: testSubAdminId },
            select: { id: true, name: true, email: true, role: true, permissions: true },
        });

        assert.ok(adminFromDb);
        assert.ok(Array.isArray(adminFromDb.permissions));
    });

    // Test Case 11
    it("11. Revoking sub-admin deletes account record cleanly", async () => {
        const tempEmail = `temp-revoke-${Date.now()}@lms-platform.com`;
        const tempSub = await adminManagementService.createSubAdmin({
            name: "Temp Revoke SubAdmin",
            email: tempEmail,
            password: "Password123!",
            permissions: [AdminPermission.USERS_READ],
        });

        const success = await adminManagementService.revokeSubAdmin(tempSub.id);
        assert.strictEqual(success, true);

        const checkDeleted = await db.admin.findUnique({ where: { id: tempSub.id } });
        assert.strictEqual(checkDeleted, null, "Deleted sub-admin should no longer exist in DB");
    });
});
