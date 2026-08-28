import { db } from "../src/config/database";
import argon2 from "argon2";
import jwt from "jsonwebtoken";

async function seedCurlTestUser() {
  const timestamp = Date.now();
  const email = `curl_user_${timestamp}@example.com`;
  const phoneNumber = `+91987${Math.floor(1000000 + Math.random() * 9000000)}`;
  const rawPassword = "CurlTestUserPassword@123";

  const user = await db.user.create({
    data: {
      name: "Curl Test Learner",
      email,
      phoneNumber,
      password: await argon2.hash(rawPassword),
      isEmailVerified: true,
    },
  });

  const secret = process.env.JWT_SECRET || "supersecretjwtkey";
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: "USER", jti: user.id },
    secret,
    { expiresIn: "1h" }
  );

  console.log(JSON.stringify({
    userId: user.id,
    email: user.email,
    phoneNumber: user.phoneNumber,
    password: rawPassword,
    accessToken,
  }, null, 2));

  await db.$disconnect();
}

seedCurlTestUser().catch((err) => {
  console.error("Failed to seed curl test user:", err);
  process.exit(1);
});
