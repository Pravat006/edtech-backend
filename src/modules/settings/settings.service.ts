import { db } from "@/config/database";
import { CreateCategoryConfig, UpdateCategoryConfig, UpsertPlatformSettingsBatch } from "./settings.schema";
import { redis } from "@/config/redis";

const SETTINGS_CACHE_KEY = "platform_settings:all";
const CATEGORIES_CACHE_KEY = "course_categories:all";

export class SettingsService {
    // --- Platform Settings ---

    static async getPlatformSettings(keys?: string[]) {
        if (!keys || keys.length === 0) {
            const cached = await redis.getValue(SETTINGS_CACHE_KEY);
            if (cached) return JSON.parse(cached);

            const settings = await db.platformSetting.findMany();
            const settingsMap = settings.reduce((acc, curr) => {
                acc[curr.key] = curr.value;
                return acc;
            }, {} as Record<string, string>);

            await redis.setValue(SETTINGS_CACHE_KEY, JSON.stringify(settingsMap), 3600);
            return settingsMap;
        }

        const settings = await db.platformSetting.findMany({
            where: { key: { in: keys } },
        });

        return settings.reduce((acc, curr) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {} as Record<string, string>);
    }

    static async upsertPlatformSettings(data: UpsertPlatformSettingsBatch, adminId: string) {
        const operations = data.settings.map((setting) => {
            return db.platformSetting.upsert({
                where: { key: setting.key },
                update: { value: setting.value, updatedById: adminId },
                create: { key: setting.key, value: setting.value, updatedById: adminId },
            });
        });

        await db.$transaction(operations);
        await redis.deleteValue(SETTINGS_CACHE_KEY);
        return this.getPlatformSettings();
    }

    // --- Course Category Configs ---

    static async getCategoryConfigs(isActiveOnly = false) {
        const cacheKey = isActiveOnly ? `${CATEGORIES_CACHE_KEY}:active` : CATEGORIES_CACHE_KEY;
        const cached = await redis.getValue(cacheKey);
        if (cached) return JSON.parse(cached);

        const categories = await db.courseCategoryConfig.findMany({
            where: isActiveOnly ? { isActive: true } : undefined,
            orderBy: [{ type: "asc" }, { label: "asc" }],
        });

        await redis.setValue(cacheKey, JSON.stringify(categories), 3600);
        return categories;
    }

    static async createCategoryConfig(data: CreateCategoryConfig) {
        const config = await db.courseCategoryConfig.create({
            data: {
                type: data.type,
                value: data.value.toUpperCase().replace(/\s+/g, "_"),
                label: data.label,
                isActive: data.isActive ?? true,
            },
        });
        await this.clearCategoryCache();
        return config;
    }

    static async updateCategoryConfig(id: string, data: UpdateCategoryConfig) {
        const config = await db.courseCategoryConfig.update({
            where: { id },
            data,
        });
        await this.clearCategoryCache();
        return config;
    }

    static async deleteCategoryConfig(id: string) {
        await db.courseCategoryConfig.delete({ where: { id } });
        await this.clearCategoryCache();
    }

    private static async clearCategoryCache() {
        await redis.deleteValue(CATEGORIES_CACHE_KEY);
        await redis.deleteValue(`${CATEGORIES_CACHE_KEY}:active`);
    }
}
