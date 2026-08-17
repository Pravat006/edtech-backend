import { db } from "@/config/database";
import { APIError } from "@/utils/APIError";
import httpStatus from "http-status";

class WishlistService {
    /**
     * GET /v1/wishlist
     * Returns all wishlisted courses for the authenticated user.
     */
    public async getWishlist(userId: string) {
        return db.wishlist.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                createdAt: true,
                course: {
                    select: {
                        id: true,
                        title: true,
                        isFree: true,
                        price: true,
                        discountPrice: true,
                        discountValidUntil: true,
                        isPublished: true,
                        thumbnail: { select: { url: true } },
                        instructor: { select: { name: true } },
                        _count: { select: { enrollments: true } },
                    },
                },
            },
        });
    }

    /**
     * POST /v1/wishlist/:courseId
     * Adds a published course to the user's wishlist.
     * Idempotent — silently succeeds if already wishlisted.
     */
    public async addToWishlist(userId: string, courseId: string) {
        // Validate course exists and is published
        const course = await db.course.findUnique({
            where: { id: courseId },
            select: { id: true, isPublished: true },
        });

        if (!course || !course.isPublished) {
            throw new APIError(httpStatus.NOT_FOUND, "Course not found.");
        }

        // Idempotent upsert — no error if already wishlisted
        return db.wishlist.upsert({
            where: { userId_courseId: { userId, courseId } },
            update: {}, // No-op if already exists
            create: { userId, courseId },
        });
    }

    /**
     * DELETE /v1/wishlist/:courseId
     * Removes a course from the user's wishlist.
     */
    public async removeFromWishlist(userId: string, courseId: string) {
        const entry = await db.wishlist.findUnique({
            where: { userId_courseId: { userId, courseId } },
            select: { id: true },
        });

        if (!entry) {
            throw new APIError(httpStatus.NOT_FOUND, "Course not in your wishlist.");
        }

        await db.wishlist.delete({
            where: { userId_courseId: { userId, courseId } },
        });

        return { removed: true };
    }

    /**
     * GET /v1/wishlist/:courseId/check
     * Checks if a specific course is in the user's wishlist.
     * Used by the frontend to toggle the heart icon state.
     */
    public async isWishlisted(userId: string, courseId: string) {
        const entry = await db.wishlist.findUnique({
            where: { userId_courseId: { userId, courseId } },
            select: { id: true },
        });
        return { isWishlisted: !!entry };
    }
}

export const wishlistService = new WishlistService();
