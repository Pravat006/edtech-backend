import { db } from "@/config/database";
import { redis } from "@/config/redis";
import { APIError } from "@/utils/APIError";
import httpStatus from "http-status";
import { CreateCmsPageInput, UpdateCmsPageInput } from "./cms.schema";

const CMS_CACHE_TTL = 3600; // 1 hour

export class CmsService {
  /**
   * Get all published static pages (for public apps)
   */
  async getPublicPages() {
    const cacheKey = "cms:public:pages";
    try {
      const cached = await redis.getValue(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {
      // Ignore cache errors
    }

    const pages = await db.cmsPage.findMany({
      where: { isPublished: true },
      select: {
        id: true,
        slug: true,
        title: true,
        metaTitle: true,
        metaDescription: true,
        updatedAt: true,
      },
      orderBy: { title: "asc" },
    });

    try {
      await redis.setValue(cacheKey, JSON.stringify(pages), CMS_CACHE_TTL);
    } catch {
      // Ignore cache errors
    }

    return pages;
  }

  /**
   * Get a specific published page by slug (for public mobile/web apps)
   */
  async getPublicPageBySlug(slug: string) {
    const cacheKey = `cms:public:slug:${slug}`;
    try {
      const cached = await redis.getValue(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {
      // Ignore cache errors
    }

    const page = await db.cmsPage.findUnique({
      where: { slug, isPublished: true },
      select: {
        id: true,
        slug: true,
        title: true,
        content: true,
        metaTitle: true,
        metaDescription: true,
        version: true,
        updatedAt: true,
      },
    });

    if (!page) {
      throw new APIError(httpStatus.NOT_FOUND, "Static page not found or not published");
    }

    try {
      await redis.setValue(cacheKey, JSON.stringify(page), CMS_CACHE_TTL);
    } catch {
      // Ignore cache errors
    }

    return page;
  }

  /**
   * Get all pages for Admin (including drafts and update history)
   */
  async getAllPagesAdmin() {
    return await db.cmsPage.findMany({
      include: {
        updatedBy: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { revisions: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  /**
   * Get page by ID with full revision history (Admin)
   */
  async getPageByIdAdmin(id: string) {
    const page = await db.cmsPage.findUnique({
      where: { id },
      include: {
        updatedBy: {
          select: { id: true, name: true, email: true },
        },
        revisions: {
          include: {
            createdBy: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { version: "desc" },
        },
      },
    });

    if (!page) {
      throw new APIError(httpStatus.NOT_FOUND, "CMS Page not found");
    }

    return page;
  }

  /**
   * Create a new static page (Admin)
   */
  async createPageAdmin(data: CreateCmsPageInput, adminId: string) {
    const existing = await db.cmsPage.findUnique({
      where: { slug: data.slug },
    });

    if (existing) {
      throw new APIError(httpStatus.CONFLICT, `A page with slug '${data.slug}' already exists`);
    }

    const page = await db.cmsPage.create({
      data: {
        slug: data.slug,
        title: data.title,
        content: data.content,
        metaTitle: data.metaTitle || data.title,
        metaDescription: data.metaDescription,
        isPublished: data.isPublished,
        version: 1,
        updatedById: adminId,
        revisions: {
          create: {
            title: data.title,
            content: data.content,
            version: 1,
            createdById: adminId,
          },
        },
      },
      include: {
        updatedBy: { select: { id: true, name: true, email: true } },
      },
    });

    await this.clearCache(page.slug);
    return page;
  }

  /**
   * Update an existing static page (Admin)
   * Automatically creates a new revision entry & increments version number
   */
  async updatePageAdmin(id: string, data: UpdateCmsPageInput, adminId: string) {
    const existing = await db.cmsPage.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new APIError(httpStatus.NOT_FOUND, "CMS Page not found");
    }

    const newVersion = existing.version + 1;
    const updatedContent = data.content !== undefined ? data.content : existing.content;
    const updatedTitle = data.title !== undefined ? data.title : existing.title;

    const page = await db.cmsPage.update({
      where: { id },
      data: {
        title: updatedTitle,
        content: updatedContent,
        metaTitle: data.metaTitle !== undefined ? data.metaTitle : existing.metaTitle,
        metaDescription: data.metaDescription !== undefined ? data.metaDescription : existing.metaDescription,
        isPublished: data.isPublished !== undefined ? data.isPublished : existing.isPublished,
        version: newVersion,
        updatedById: adminId,
        revisions: {
          create: {
            title: updatedTitle,
            content: updatedContent,
            version: newVersion,
            createdById: adminId,
          },
        },
      },
      include: {
        updatedBy: { select: { id: true, name: true, email: true } },
        revisions: {
          orderBy: { version: "desc" },
          take: 5,
        },
      },
    });

    await this.clearCache(page.slug);
    return page;
  }

  /**
   * Revert a page to a specific revision (Admin)
   */
  async revertPageAdmin(pageId: string, revisionId: string, adminId: string) {
    const revision = await db.cmsPageRevision.findUnique({
      where: { id: revisionId },
    });

    if (!revision || revision.pageId !== pageId) {
      throw new APIError(httpStatus.NOT_FOUND, "Revision history entry not found");
    }

    return await this.updatePageAdmin(
      pageId,
      {
        title: revision.title,
        content: revision.content,
      },
      adminId
    );
  }

  /**
   * Deactivate a page (Admin) - Soft unpublish instead of hard delete
   */
  async deletePageAdmin(id: string) {
    const page = await db.cmsPage.findUnique({ where: { id } });
    if (!page) {
      throw new APIError(httpStatus.NOT_FOUND, "CMS Page not found");
    }

    await db.cmsPage.update({
      where: { id },
      data: { isPublished: false },
    });
    await this.clearCache(page.slug);
    return {
      success: true,
      message: `CMS page '${page.title}' has been deactivated (unpublished) instead of hard-deleted to preserve content history.`,
    };
  }

  /**
   * Toggle publication status of a CMS page (Admin)
   */
  async togglePageStatusAdmin(id: string, isPublished: boolean) {
    const page = await db.cmsPage.findUnique({ where: { id } });
    if (!page) {
      throw new APIError(httpStatus.NOT_FOUND, "CMS Page not found");
    }

    const updated = await db.cmsPage.update({
      where: { id },
      data: { isPublished },
    });
    await this.clearCache(page.slug);
    return {
      success: true,
      message: `CMS page '${updated.title}' is now ${isPublished ? "Published" : "Deactivated (Draft)"}.`,
      data: updated,
    };
  }

  /**
   * Clear Redis Cache for public endpoints
   */
  private async clearCache(slug: string) {
    try {
      await redis.deleteValue("cms:public:pages");
      await redis.deleteValue(`cms:public:slug:${slug}`);
    } catch {
      // Ignore cache clearing errors
    }
  }
}

export const cmsService = new CmsService();
