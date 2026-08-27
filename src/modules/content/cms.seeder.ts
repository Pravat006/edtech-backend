import { db } from "@/config/database";
import { logger } from "@/config/logger";

interface DefaultPageDef {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
}

// Mandatory Static CMS Pages matching mobile app screens & legal requirements
const DEFAULT_PAGES: DefaultPageDef[] = [
  {
    slug: "about-us",
    title: "About Us",
    metaTitle: "About Us | Supermind Education",
    metaDescription: "Discover our mission, vision, and educational platform details.",
  },
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    metaTitle: "Privacy Policy | Supermind Education",
    metaDescription: "Learn how we protect and manage your personal data.",
  },
  {
    slug: "terms-and-conditions",
    title: "Terms of Use",
    metaTitle: "Terms of Use | Supermind Education",
    metaDescription: "Terms of service and user agreement for our platform.",
  },
  {
    slug: "how-to-use",
    title: "How to Use",
    metaTitle: "How to Use | Supermind Education",
    metaDescription: "Guide on using student features, enrolled courses, and doubt support.",
  },
  {
    slug: "media-speaks",
    title: "Media Speaks",
    metaTitle: "Media Speaks | Supermind Education",
    metaDescription: "News articles, press releases, and media mentions.",
  },
];

let hasRunInCurrentProcess = false;

/**
 * Idempotent One-Time CMS Static Page Seeder.
 * Runs on server startup.
 * GUARANTEES:
 * 1. Will NEVER overwrite or alter existing pages or custom content in DB.
 * 2. Does NOT seed heavy text inside the page; seeds clean empty starter records.
 * 3. Runs safely once per deployment / boot.
 */
export async function seedDefaultCmsPages(): Promise<void> {
  if (hasRunInCurrentProcess) {
    return;
  }
  hasRunInCurrentProcess = true;

  try {
    let createdCount = 0;

    for (const pageDef of DEFAULT_PAGES) {
      const existing = await db.cmsPage.findUnique({
        where: { slug: pageDef.slug },
        select: { id: true },
      });

      // ONLY seed if page slug is completely missing from PostgreSQL DB
      if (!existing) {
        const defaultContent =
          pageDef.slug === "privacy-policy"
            ? `# Privacy Policy for Supermind Education Platform\n\n*Last Updated: August 28, 2026*\n\nWelcome to **Supermind Education**. We are committed to safeguarding your personal data and ensuring privacy compliance across our web platform and mobile applications.\n\n### 1. Information We Collect\n- **Account & Identity**: Name, email, mobile phone number, avatar.\n- **Verification Documents**: Aadhaar, PAN, signature, and educational marksheets.\n- **Learning Progress**: Enrolled courses, lesson progress, quiz attempts, certificates.\n- **Financial Data**: Transaction IDs, order history, wallet balance.\n\n### 2. Account & Data Deletion Rights (Google Play & App Store Compliant)\nAll users have the full right to delete their account at any time:\n- **Self-Service Verification**: Go to **Settings → Account Security → Request Account Deletion**.\n- **2-Step Verification**: Credential + Password -> 6-digit SMS/Email OTP -> Permanent Deletion.\n- **Cloud Assets & DB Scrub**: Avatar, identity files, marksheets, and personal data are permanently deleted.`
            : "# " + pageDef.title + "\n\nContent coming soon...";

        await db.cmsPage.create({
          data: {
            slug: pageDef.slug,
            title: pageDef.title,
            content: defaultContent,
            metaTitle: pageDef.metaTitle,
            metaDescription: pageDef.metaDescription,
            isPublished: true,
            version: 1,
          },
        });
        createdCount++;
      }
    }

    if (createdCount > 0) {
      logger.info(`[CMS_SEEDER] Initialized ${createdCount} missing static page record(s).`);
    } else {
      logger.info("[CMS_SEEDER] All mandatory static pages already exist in DB. No pages modified.");
    }
  } catch (error) {
    logger.error("[CMS_SEEDER] Error during CMS page seeding:", error);
  }
}
