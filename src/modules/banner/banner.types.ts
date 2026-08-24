export interface IBannerResponse {
    id: string;
    title: string;
    thumbnailUrl: string;
    linkUrl: string;
    description?: string | null;
    badgeText?: string | null;
    displayOrder: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
