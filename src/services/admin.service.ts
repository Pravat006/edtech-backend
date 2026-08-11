import { db } from "@/config/database";
import { logger } from "@/config/logger";
import { APIError } from "@/utils/APIError";
import { type Admin } from "@/@types/schema";

class AdminService {
    async getAdminById(adminId: string): Promise<Admin | null> {
        try {
            const admin = await db.admin.findUnique({
                where: { id: adminId },
            });

            if (!admin) {
                logger.warn(`[ADMIN_SERVICE] Admin not found with ID: ${adminId}`);
                return null;
            }

            logger.info(`[ADMIN_SERVICE] Admin retrieved successfully with ID: ${adminId}`);
            return admin;
        } catch (error) {
            logger.error(`[ADMIN_SERVICE] Error getting admin by ID ${adminId}:`, error);
            throw new APIError(500, "Failed to retrieve admin");
        }
    }
}

export default new AdminService();

