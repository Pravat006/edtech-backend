import { db } from "../src/config/database";

async function main() {
    console.log("Adding isActive column to Admin table if not exists...");
    await db.$executeRawUnsafe(`ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;`);
    console.log("Successfully added isActive column to Admin table!");
}

main()
    .catch((err) => {
        console.error("Migration script failed:", err);
        process.exit(1);
    })
    .finally(async () => {
        await db.$disconnect();
    });
