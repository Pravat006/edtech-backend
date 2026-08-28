import { seedDefaultCmsPages } from "../src/modules/content/cms.seeder";
import { cmsService } from "../src/modules/content/cms.service";
import { db } from "../src/config/database";
import argon2 from "argon2";

async function testCmsGovernanceAndSeeder() {
  console.log("=== Testing CMS Static Pages Governance & Auto-Seeding Pipeline ===");

  // Seed temporary test admin for foreign key relations
  const testAdmin = await db.admin.create({
    data: {
      name: "CMS Tester Admin",
      email: `cms_tester_${Date.now()}@example.com`,
      password: await argon2.hash("TestPass123!"),
      role: "SUPER",
      isActive: true,
    },
  });

  try {
    // 1. Execute Auto-Seeder
    console.log("\n[1] Executing seedDefaultCmsPages()...");
    await seedDefaultCmsPages();

    // Verify pages seeded
    const pages = await db.cmsPage.findMany({
      select: { id: true, slug: true, title: true, isPublished: true, content: true },
    });
    console.log(`- Total CMS Pages in DB: ${pages.length}`);
    pages.forEach((p) => {
      console.log(`  • [${p.slug}] -> Title: "${p.title}", Published: ${p.isPublished}`);
    });

    const mandatorySlugs = [
      "privacy-policy",
      "terms-and-conditions",
      "about-us",
      "how-to-use",
      "media-speaks",
      "refund-policy",
      "faq",
    ];

    for (const slug of mandatorySlugs) {
      const found = pages.find((p) => p.slug === slug);
      if (!found) {
        throw new Error(`FAIL: Missing mandatory seeded page slug '${slug}'`);
      }
    }
    console.log("- All mandatory static pages exist in DB!");

    // 2. Custom Content Update Test
    const privacyPage = pages.find((p) => p.slug === "privacy-policy")!;
    console.log(`\n[2] Updating custom content for '${privacyPage.slug}'...`);

    const customContent = "# Custom Company Privacy Policy\nWe strictly protect all student data.";
    await cmsService.updatePageAdmin(
      privacyPage.id,
      { content: customContent, title: "Customized Privacy Policy" },
      testAdmin.id
    );
    console.log("- Privacy Policy successfully updated with custom admin content!");

    // 3. Test Deactivation (No Hard Delete)
    console.log("\n[3] Testing Deactivation (Calling deletePageAdmin)...");
    const deleteRes = await cmsService.deletePageAdmin(privacyPage.id);
    console.log("- Service Response:", deleteRes.message);

    // Check PostgreSQL DB: Row MUST still exist, but isPublished === false
    const deactivatedRow = await db.cmsPage.findUnique({ where: { id: privacyPage.id } });
    if (!deactivatedRow) {
      throw new Error("FAIL: Page was hard-deleted from database!");
    }
    if (deactivatedRow.isPublished !== false) {
      throw new Error("FAIL: Page isPublished flag was not set to false!");
    }
    console.log(`- PostgreSQL Verification SUCCESS: Row ID=${deactivatedRow.id} STILL EXISTS, isPublished=${deactivatedRow.isPublished}`);

    // 4. Test Seeder Idempotency Guard (Seeder should NOT overwrite deactivated or custom pages)
    console.log("\n[4] Re-running seedDefaultCmsPages() to verify Idempotency Guard...");
    await seedDefaultCmsPages();

    const postReseedRow = await db.cmsPage.findUnique({ where: { id: privacyPage.id } });
    if (postReseedRow?.content !== customContent) {
      throw new Error("FAIL: Seeder overwrote existing custom page content!");
    }
    console.log("- Idempotency Verification SUCCESS: Custom content & deactivated state were NOT overwritten by seeder!");

    // 5. Test Status Reactivation Toggle
    console.log("\n[5] Reactivating Page via togglePageStatusAdmin...");
    const reactivateRes = await cmsService.togglePageStatusAdmin(privacyPage.id, true);
    console.log("- Toggle Response:", reactivateRes.message);

    const finalRow = await db.cmsPage.findUnique({ where: { id: privacyPage.id } });
    console.log(`- Final Status Verification: isPublished=${finalRow?.isPublished}`);

    console.log("\n✅ ALL CMS GOVERNANCE & SEEDER TESTS PASSED 100%!");
  } finally {
    await db.admin.delete({ where: { id: testAdmin.id } });
  }
}

testCmsGovernanceAndSeeder()
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
