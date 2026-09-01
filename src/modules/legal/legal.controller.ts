import { Request, Response } from "express";
import httpStatus from "http-status";
import { db } from "@/config/database";
import { APIError } from "@/utils/APIError";
import { z } from "zod";

export const getConsentStatus = async (req: Request, res: Response) => {
    const userId = req.user!.id;

    // The essential legal documents are T&C and Privacy Policy
    const requiredSlugs = ["terms-and-conditions", "privacy-policy"];
    
    const pendingPages = [];
    let requiresConsent = false;

    for (const slug of requiredSlugs) {
        // Find the latest active revision for this CMS page
        const page = await db.cmsPage.findUnique({
            where: { slug },
            include: {
                revisions: {
                    orderBy: { version: "desc" },
                    take: 1
                }
            }
        });

        if (page && page.revisions.length > 0) {
            const latestRevision = page.revisions[0];
            
            // Check if the user has consented to this exact revision
            const consent = await db.userLegalConsent.findUnique({
                where: {
                    userId_pageId_revisionId: {
                        userId,
                        pageId: page.id,
                        revisionId: latestRevision.id
                    }
                }
            });

            if (!consent) {
                requiresConsent = true;
                pendingPages.push({
                    pageId: page.id,
                    slug: page.slug,
                    title: page.title,
                    revisionId: latestRevision.id,
                    version: latestRevision.version,
                    content: latestRevision.content
                });
            }
        }
    }

    res.status(httpStatus.OK).json({ success: true, requiresConsent, pendingPages });
};

const consentSchema = z.object({
    pageId: z.string().uuid("Invalid Page ID"),
    revisionId: z.string().uuid("Invalid Revision ID")
});

export const recordConsent = async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { pageId, revisionId } = req.body;
    
    // Validate input manually since this is a simple schema
    const validation = consentSchema.safeParse({ pageId, revisionId });
    if (!validation.success) {
        throw new APIError(httpStatus.BAD_REQUEST, "Invalid input data: " + validation.error.message);
    }

    // Verify the page and revision actually exist
    const revision = await db.cmsPageRevision.findUnique({
        where: { id: revisionId, pageId }
    });

    if (!revision) {
        throw new APIError(httpStatus.NOT_FOUND, "The specified legal document version does not exist.");
    }

    // Record consent
    const ipAddress = req.ip || req.socket.remoteAddress || "Unknown";
    const userAgent = req.headers["user-agent"] || "Unknown";

    await db.userLegalConsent.upsert({
        where: {
            userId_pageId_revisionId: {
                userId,
                pageId,
                revisionId
            }
        },
        create: {
            userId,
            pageId,
            revisionId,
            ipAddress,
            userAgent
        },
        update: {
            ipAddress,
            userAgent,
            acceptedAt: new Date()
        }
    });

    res.status(httpStatus.OK).json({ success: true, message: "Consent recorded successfully." });
};
