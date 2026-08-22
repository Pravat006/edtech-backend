import { db } from "@/config/database";
import { APIError } from "@/utils/APIError";
import httpStatus from "http-status";

export interface ListUsersQuery {
    page?: number;
    limit?: number;
    search?: string;
    status?: "all" | "verified" | "unverified";
}

export const listUsers = async (query: ListUsersQuery) => {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.search && query.search.trim()) {
        const searchTerm = query.search.trim();
        where.OR = [
            { name: { contains: searchTerm, mode: "insensitive" } },
            { email: { contains: searchTerm, mode: "insensitive" } },
            { phoneNumber: { contains: searchTerm, mode: "insensitive" } },
        ];
    }

    if (query.status === "verified") {
        where.personalDetails = {
            OR: [
                { aadhaarFileId: { not: null } },
                { panFileId: { not: null } },
            ],
        };
    } else if (query.status === "unverified") {
        where.OR = [
            { personalDetails: null },
            {
                personalDetails: {
                    aadhaarFileId: null,
                    panFileId: null,
                },
            },
        ];
    }

    const [users, total] = await Promise.all([
        db.user.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                name: true,
                email: true,
                phoneNumber: true,
                createdAt: true,
                updatedAt: true,
                avatar: {
                    select: {
                        id: true,
                        url: true,
                    },
                },
                personalDetails: {
                    select: {
                        aadhaarNumber: true,
                        panNumber: true,
                        aadhaarFileId: true,
                        panFileId: true,
                    },
                },
                _count: {
                    select: {
                        enrollments: true,
                        progress: true,
                    },
                },
            },
        }),
        db.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
        users,
        pagination: {
            total,
            page,
            limit,
            totalPages,
        },
    };
};

export const getUserById = async (userId: string) => {
    const user = await db.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
            createdAt: true,
            updatedAt: true,
            avatar: {
                select: {
                    id: true,
                    url: true,
                },
            },
            preferences: true,
            address: true,
            personalDetails: {
                include: {
                    aadhaarFile: { select: { id: true, url: true } },
                    panFile: { select: { id: true, url: true } },
                    signatureImage: { select: { id: true, url: true } },
                },
            },
            educationDetails: true,
            enrollments: {
                orderBy: { enrolledAt: "desc" },
                include: {
                    course: {
                        select: {
                            id: true,
                            title: true,
                            subject: true,
                            price: true,
                            isFree: true,
                            thumbnail: { select: { url: true } },
                        },
                    },
                    payment: {
                        select: {
                            id: true,
                            amount: true,
                            status: true,
                            createdAt: true,
                        },
                    },
                },
            },
            payments: {
                orderBy: { createdAt: "desc" },
                take: 10,
            },
            certificates: {
                include: {
                    enrollment: {
                        select: {
                            course: { select: { id: true, title: true } },
                        },
                    },
                },
            },
        },
    });

    if (!user) {
        throw new APIError(httpStatus.NOT_FOUND, "Student profile not found.");
    }

    return user;
};

export const manualEnrollUser = async (userId: string, courseId: string, customAccessDurationDays?: number) => {
    const [user, course] = await Promise.all([
        db.user.findUnique({ where: { id: userId } }),
        db.course.findUnique({ where: { id: courseId } }),
    ]);

    if (!user) {
        throw new APIError(httpStatus.NOT_FOUND, "Student profile not found.");
    }

    if (!course) {
        throw new APIError(httpStatus.NOT_FOUND, "Course not found.");
    }

    const existingEnrollment = await db.enrollment.findUnique({
        where: {
            userId_courseId: {
                userId,
                courseId,
            },
        },
    });

    if (existingEnrollment) {
        throw new APIError(httpStatus.BAD_REQUEST, "Student is already enrolled in this course.");
    }

    const accessDuration = customAccessDurationDays ?? course.accessDurationDays;
    let expiresAt: Date | null = null;
    if (accessDuration && accessDuration > 0) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + accessDuration);
    }

    const enrollment = await db.enrollment.create({
        data: {
            userId,
            courseId,
            status: "ACTIVE",
            accessDurationDays: accessDuration,
            expiresAt,
        },
        include: {
            course: {
                select: { id: true, title: true },
            },
        },
    });

    return enrollment;
};
