import { db } from "@/config/database";

export class CertificateService {
    /**
     * Generates a PDF certificate asynchronously.
     * In a production environment, this would use Puppeteer or PDFKit,
     * upload the resulting buffer to Bunny CDN / ImageKit, and save the MediaAsset.
     */
    static async generateCertificateBackground(certificateId: string) {
        try {
            const cert = await db.certificate.findUnique({
                where: { id: certificateId },
                include: { user: true, enrollment: { include: { course: true } } },
            });

            if (!cert) return;

            // MOCK PDF GENERATION & CDN UPLOAD:
            // 1. Generate PDF with user's name and course title
            // 2. Upload to CDN
            // 3. Save MediaAsset to database
            const media = await db.mediaAsset.create({
                data: {
                    type: "CERTIFICATE",
                    url: "https://example-cdn.com/certificates/mock-cert.pdf", // Mock URL
                    mimeType: "application/pdf",
                    storageKey: `cert_${cert.id}.pdf`,
                    sizeBytes: 1024 * 500, // 500kb
                    provider: "bunny_storage",
                },
            });

            // Update Certificate with the generated MediaAsset
            await db.certificate.update({
                where: { id: certificateId },
                data: {
                    certificateMediaId: media.id,
                    issuedAt: new Date(),
                },
            });

        } catch (error) {
            console.error(`[CertificateService] Failed to generate certificate ${certificateId}`, error);
        }
    }
}
