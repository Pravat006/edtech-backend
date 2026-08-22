import { db } from "../src/config/database";
import argon2 from "argon2";

async function seedSuperAdmin() {
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || "superadmin@lms-platform.com";
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || "SuperAdmin@123456";
    const superAdminName = process.env.SUPER_ADMIN_NAME || "Super Admin";

    console.log(`[SEED] Checking for existing Super Admin with email: ${superAdminEmail}...`);

    const existingAdmin = await db.admin.findUnique({
        where: { email: superAdminEmail },
    });

    const hashedPassword = await argon2.hash(superAdminPassword);

    if (existingAdmin) {
        console.log(`[SEED] Super Admin already exists (${existingAdmin.id}). Updating password and ensuring role is SUPER...`);
        const updatedAdmin = await db.admin.update({
            where: { id: existingAdmin.id },
            data: {
                role: "SUPER",
                password: hashedPassword,
                name: superAdminName,
            },
        });
        console.log(`✅ [SEED] Super Admin updated successfully! ID: ${updatedAdmin.id}`);
    } else {
        console.log(`[SEED] Creating new Super Admin account...`);
        const newAdmin = await db.admin.create({
            data: {
                name: superAdminName,
                email: superAdminEmail,
                password: hashedPassword,
                role: "SUPER",
            },
        });
        console.log(`✅ [SEED] Super Admin created successfully! ID: ${newAdmin.id}`);
    }
}

seedSuperAdmin()
    .catch((e) => {
        console.error("❌ [SEED] Error seeding Super Admin:", e);
        process.exit(1);
    })
    .finally(async () => {
        await db.$disconnect();
    });
