import { db } from "@/config/database";
import { redis } from "@/config/redis";
import { APIError } from "@/utils/APIError";
import httpStatus from "http-status";
import { CreateBannerInput, UpdateBannerInput, ReorderBannersInput } from "./banner.schema";
import { BunnyStorageMediaProvider } from "../upload/providers/bunny-storage.provider";

const BANNER_CACHE_KEY = "cms:public:banners";
const BANNER_CACHE_TTL = 3600; // 1 hour

export class BannerService {
    /**
     * Get active banners sorted by displayOrder for public student app
     */
    async getPublicBanners() {
        try {
            const cached = await redis.getValue(BANNER_CACHE_KEY);
            if (cached) return JSON.parse(cached);
        } catch {
            // Ignore cache read errors
        }

        const banners = await db.banner.findMany({
            where: { isActive: true },
            select: {
                id: true,
                title: true,
                thumbnailUrl: true,
                linkUrl: true,
                description: true,
                badgeText: true,
                displayOrder: true,
                createdAt: true,
            },
            orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
        });

        try {
            await redis.setValue(BANNER_CACHE_KEY, JSON.stringify(banners), BANNER_CACHE_TTL);
        } catch {
            // Ignore cache write errors
        }

        return banners;
    }

    /**
     * Get all banners for Admin panel
     */
    async getAllAdminBanners() {
        return await db.banner.findMany({
            include: {
                createdBy: {
                    select: { id: true, name: true, email: true },
                },
            },
            orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
        });
    }

    /**
     * Get banner by ID (Admin)
     */
    async getBannerById(id: string) {
        const banner = await db.banner.findUnique({
            where: { id },
            include: {
                createdBy: {
                    select: { id: true, name: true, email: true },
                },
            },
        });

        if (!banner) {
            throw new APIError(httpStatus.NOT_FOUND, "Banner not found");
        }

        return banner;
    }

    /**
     * Create a new promotional banner (Admin)
     */
    async createBanner(data: CreateBannerInput, adminId: string) {
        const banner = await db.banner.create({
            data: {
                title: data.title,
                thumbnailUrl: data.thumbnailUrl,
                linkUrl: data.linkUrl,
                description: data.description,
                badgeText: data.badgeText,
                displayOrder: data.displayOrder ?? 0,
                isActive: data.isActive ?? true,
                createdById: adminId,
            },
            include: {
                createdBy: {
                    select: { id: true, name: true, email: true },
                },
            },
        });

        await this.clearCache();
        return banner;
    }

    /**
     * Update an existing banner (Admin)
     */
    async updateBanner(id: string, data: UpdateBannerInput) {
        const existing = await db.banner.findUnique({ where: { id } });
        if (!existing) {
            throw new APIError(httpStatus.NOT_FOUND, "Banner not found");
        }

        const banner = await db.banner.update({
            where: { id },
            data: {
                title: data.title !== undefined ? data.title : existing.title,
                thumbnailUrl: data.thumbnailUrl !== undefined ? data.thumbnailUrl : existing.thumbnailUrl,
                linkUrl: data.linkUrl !== undefined ? data.linkUrl : existing.linkUrl,
                description: data.description !== undefined ? data.description : existing.description,
                badgeText: data.badgeText !== undefined ? data.badgeText : existing.badgeText,
                displayOrder: data.displayOrder !== undefined ? data.displayOrder : existing.displayOrder,
                isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
            },
            include: {
                createdBy: {
                    select: { id: true, name: true, email: true },
                },
            },
        });

        await this.clearCache();
        return banner;
    }

    /**
     * Delete a banner (Admin)
     */
    async deleteBanner(id: string) {
        const existing = await db.banner.findUnique({ where: { id } });
        if (!existing) {
            throw new APIError(httpStatus.NOT_FOUND, "Banner not found");
        }

        await db.banner.delete({ where: { id } });
        await this.clearCache();
        return { success: true, message: `Banner '${existing.title}' deleted successfully` };
    }

    /**
     * Reorder banners in bulk (Admin)
     */
    async reorderBanners(data: ReorderBannersInput) {
        const updates = data.orders.map((item) =>
            db.banner.update({
                where: { id: item.id },
                data: { displayOrder: item.displayOrder },
            })
        );

        await db.$transaction(updates);
        await this.clearCache();
        return { success: true, message: "Banner display order updated successfully" };
    }

    /**
     * Direct image file upload to Bunny Storage CDN for Banner Editor
     */
    async uploadBannerImage(file: string, fileName?: string) {
        try {
            const bunnyStorage = new BunnyStorageMediaProvider();
            const result = await bunnyStorage.uploadDirect(file, fileName || `banner_${Date.now()}.jpg`);

            return {
                url: result.url,
                fileId: result.fileId,
                name: result.fileId,
            };
        } catch (error: any) {
            throw new APIError(
                httpStatus.INTERNAL_SERVER_ERROR,
                `Failed to upload banner image: ${error.message || "Bunny Storage error"}`
            );
        }
    }

    /**
     * Invalidate Redis cache
     */
    private async clearCache() {
        try {
            await redis.deleteValue(BANNER_CACHE_KEY);
        } catch {
            // Ignore cache clear errors
        }
    }
}

export const bannerService = new BannerService();
