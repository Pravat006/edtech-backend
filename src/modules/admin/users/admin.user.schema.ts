import { z } from "zod";

export const CreateDemoUserSchema = z.strictObject({
    phoneNumber: z.string().min(10, "Valid phone number required"),
    email: z.string().email("Invalid email format").optional(),
    name: z.string().min(2, "Name must be at least 2 characters").default("Demo App Reviewer"),
    password: z.string().min(6, "Password must be at least 6 characters").default("DemoReviewer@123"),
    initialWalletBalance: z.number().nonnegative().default(500),
});

export type CreateDemoUser = z.infer<typeof CreateDemoUserSchema>;
