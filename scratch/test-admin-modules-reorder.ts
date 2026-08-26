import { adminCourseService } from "../src/modules/courses/admin-course.service";
import { db } from "../src/config/database";

async function runTest() {
    console.log("=== Testing Admin Course Modules & Block Reordering APIs ===");

    // 1. Find a test course or create a dummy course
    let course = await db.course.findFirst({
        select: { id: true, title: true, instructorId: true }
    });

    if (!course) {
        console.log("No existing course found, fetching first admin...");
        const admin = await db.admin.findFirst();
        if (!admin) {
            console.error("No admin found in database!");
            return;
        }
        course = await db.course.create({
            data: {
                title: "Test Course for Reordering",
                description: "Test description for reorder and modules API",
                subject: "PHYSICS",
                language: "English",
                goals: ["EXAM_PREP"],
                price: 0,
                isFree: true,
                instructorId: admin.id,
            },
            select: { id: true, title: true, instructorId: true }
        });
    }

    console.log(`Using Course ID: ${course.id} ("${course.title}")`);

    // 2. Test GET /courses/:courseId/modules paginated
    const modulesData = await adminCourseService.getCourseModules(
        course.id,
        course.instructorId,
        "SUPER_ADMIN",
        { page: 1, limit: 5 }
    );

    console.log("\n[GET /courses/:id/modules Result]:");
    console.log(`Total Modules: ${modulesData.pagination.total}`);
    console.log(`Page: ${modulesData.pagination.page}/${modulesData.pagination.totalPages}`);
    console.log(`Modules returned: ${modulesData.modules.length}`);

    if (modulesData.modules.length > 0) {
        const firstModule = modulesData.modules[0];
        console.log(`First Module: "${firstModule.title}" (ID: ${firstModule.id}, Lessons: ${firstModule.lessonsCount})`);

        if (firstModule.lessons.length > 0) {
            const firstLesson = firstModule.lessons[0];
            console.log(`First Lesson: "${firstLesson.title}" (ID: ${firstLesson.id}, Blocks: ${firstLesson.blocksCount})`);

            if (firstLesson.contents.length > 1) {
                console.log("\n[Testing Lesson Block Reordering]:");
                const blocksToReorder = firstLesson.contents.map((b, idx) => ({
                    id: b.id,
                    order: firstLesson.contents.length - idx, // reverse order
                }));

                const reorderResult = await adminCourseService.reorderLessonBlocks(
                    firstLesson.id,
                    course.instructorId,
                    "SUPER_ADMIN",
                    blocksToReorder
                );
                console.log("Reorder Response:", reorderResult.message);
            }
        }
    }

    console.log("\nSUCCESS! All service methods executed error-free.");
}

runTest()
    .catch((err) => {
        console.error("Test failed with error:", err);
        process.exit(1);
    })
    .finally(async () => {
        await db.$disconnect();
    });
