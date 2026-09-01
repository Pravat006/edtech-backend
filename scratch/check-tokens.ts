import { db } from "../src/config/database";

async function run() {
    const users = await db.user.findMany({
        where: { expoPushToken: { not: null } },
        select: { id: true, email: true, expoPushToken: true }
    });
    console.log("Users with Expo Push Tokens:", users);
    process.exit(0);
}
run();
