import { Admin, User } from "@/@types/schema";

declare global {
    namespace Express {
        interface Request {
            user?: Omit<User, "password">;
            admin?: Admin;
        }
    }
}

export {};

