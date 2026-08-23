import { db } from "@/config/db";
import { chatGateway } from "@/websocket/chat.gateway";

export class CommunityService {
    /**
     * Get discovery hub data: Recommended classmates + Support mentors
     */
    public async getDiscovery(userId: string) {
        // 1. Get user's enrolled course IDs
        const userEnrollments = await db.enrollment.findMany({
            where: {
                userId,
                status: "ACTIVE",
            },
            select: { courseId: true },
        });

        const courseIds = userEnrollments.map((e: { courseId: string }) => e.courseId);

        let peerEnrollments: any[] = [];
        if (courseIds.length > 0) {
            peerEnrollments = await db.enrollment.findMany({
                where: {
                    courseId: { in: courseIds },
                    userId: { not: userId },
                    status: "ACTIVE",
                },
                take: 25,
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            phoneNumber: true,
                        },
                    },
                    course: {
                        select: {
                            id: true,
                            title: true,
                        },
                    },
                },
            });
        }

        // Deduplicate peers by user ID
        const peerMap = new Map<string, any>();
        for (const pe of peerEnrollments) {
            if (pe.user && !peerMap.has(pe.user.id)) {
                const isOnline = chatGateway.isUserOnline(pe.user.id);
                peerMap.set(pe.user.id, {
                    id: pe.user.id,
                    name: pe.user.name || "Classmate",
                    role: "STUDENT",
                    sharedCourseTitle: pe.course?.title || "Enrolled Course",
                    isOnline,
                });
            }
        }

        let recommendedPeers = Array.from(peerMap.values());

        // Fallback: If user has no shared classmates yet, pick top active students
        if (recommendedPeers.length === 0) {
            const fallbackUsers = await db.user.findMany({
                where: {
                    id: { not: userId },
                },
                take: 10,
                select: {
                    id: true,
                    name: true,
                },
            });

            recommendedPeers = fallbackUsers.map((u: any) => ({
                id: u.id,
                name: u.name || "Learner",
                role: "STUDENT",
                sharedCourseTitle: "Supermind Learner",
                isOnline: chatGateway.isUserOnline(u.id),
            }));
        }

        // Sort: Currently online students appear first
        recommendedPeers.sort((a, b) => (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0));

        // 2. Fetch Support Mentors / Admins
        const mentors = await db.admin.findMany({
            take: 5,
            select: {
                id: true,
                name: true,
                role: true,
                email: true,
            },
        });

        const formattedMentors = mentors.map((m: any) => ({
            id: m.id,
            name: m.name || "Academic Support",
            role: m.role === "SUPER" ? "Head Academic Mentor" : "Support Representative",
            isOnline: true, // Support desk always active
        }));

        return {
            recommendedPeers,
            mentors: formattedMentors,
        };
    }

    /**
     * Search Peer Directory by name or query string
     */
    public async searchPeers(userId: string, query?: string) {
        const searchStr = (query || "").trim();

        const users = await db.user.findMany({
            where: {
                id: { not: userId },
                ...(searchStr
                    ? {
                          OR: [
                              { name: { contains: searchStr, mode: "insensitive" } },
                              { email: { contains: searchStr, mode: "insensitive" } },
                          ],
                      }
                    : {}),
            },
            take: 30,
            select: {
                id: true,
                name: true,
                email: true,
            },
        });

        const formattedUsers = users.map((u: any) => ({
            id: u.id,
            name: u.name || "Learner",
            role: "STUDENT",
            subtitle: "Student",
            isOnline: chatGateway.isUserOnline(u.id),
        }));

        // Sort online students first
        formattedUsers.sort((a, b) => (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0));
        return formattedUsers;
    }
}

export const communityService = new CommunityService();
