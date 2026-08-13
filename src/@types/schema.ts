import z from "zod";

// Base schemas for creating/updating records
export const UserCreateSchema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email format"),
    phoneNumber: z.string().default("0000000000"), // fallback for now
});

export const UserUpdateSchema = UserCreateSchema.partial().omit({
    email: true,
});

export const UserSchema = z.object({
    id: z.string(),
    phoneNumber: z.string(),
    name: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
});

export const AdminCreateSchema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email format"),
});

export const AdminUpdateSchema = AdminCreateSchema.pick({
    name: true,
}).partial();

export const AdminSchema = z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email(),
    role: z.enum(["SUPER", "SUB"]),
});

export type UserCreate = z.infer<typeof UserCreateSchema>;
export type UserUpdate = z.infer<typeof UserUpdateSchema>;
export type User = z.infer<typeof UserSchema>;

export type AdminCreate = z.infer<typeof AdminCreateSchema>;
export type AdminUpdate = z.infer<typeof AdminUpdateSchema>;
export type Admin = z.infer<typeof AdminSchema>;
