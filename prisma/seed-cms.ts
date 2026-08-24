import { db } from "../src/config/database";

const defaultPages = [
  {
    slug: "terms-and-conditions",
    title: "Terms of Use",
    metaTitle: "Terms of Use | XYZ Education Platform",
    metaDescription: "Terms of use and service agreements for XYZ Education Platform.",
    content: `# Terms of Use

*Last updated: August 24, 2026*

Welcome to XYZ Education Platform! These Terms of Use govern your access to and use of our educational platform, courses, and related services. By accessing or using our application, you agree to be bound by these terms.

---

### 1. Account Registration
To access certain features of the platform, you must register for an account. You agree to provide accurate, current, and complete information during registration. You are responsible for maintaining the confidentiality of your credentials.

### 2. Intellectual Property & Course License
All courses, videos, PDFs, and documentation on this platform are the intellectual property of XYZ Education Platform or its content partners.
- You are granted a **limited, non-transferable license** for personal educational use.
- You may not record, redistribute, or commercially exploit any course materials.

### 3. Payments & Refund Terms
Certain courses or features require payment. Payments are processed securely via our payment gateways. Refunds for courses are subject to our [Refund Policy](/refund-policy).

### 4. Code of Conduct
Respectful communication is required in all community discussion forums and support channels. Harassment, abuse, or spamming will result in immediate account suspension.

---

*If you have any questions regarding these terms, please contact our support team.*
`,
  },
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    metaTitle: "Privacy Policy | XYZ Education Platform",
    metaDescription: "Learn how XYZ Education Platform collects, protects, and handles your personal information.",
    content: `# Privacy Policy

*Last updated: August 24, 2026*

Your privacy is important to us. This Privacy Policy outlines how XYZ Education Platform collects, uses, and safeguards your data.

---

### 1. Information We Collect
- **Personal Info**: Name, phone number, email address, and profile details.
- **Usage Data**: Course progress, quiz scores, and AI interaction history.
- **Technical Data**: Device ID, push notification tokens, and IP address.

### 2. How We Use Your Data
- To deliver personalized course recommendations and track learning progress.
- To process transactions and send verification SMS/email alerts.
- To improve our AI tutor features and platform performance.

### 3. Data Protection & Security
We implement SSL encryption, secure token storage, and strict database access controls. We do not sell your personal data to third parties.

---

*For privacy inquiries or data removal requests, contact privacy@xyzeducation.com.*
`,
  },
  {
    slug: "how-to-use",
    title: "How to Use XYZ Education",
    metaTitle: "Student App Guide | XYZ Education Platform",
    metaDescription: "Step-by-step student guide to navigating courses, asking AI doubts, and tracking progress.",
    content: `# How to Use XYZ Education

Welcome to XYZ Education Platform! Here is your quick start guide to getting the most out of your learning experience.

---

### 📚 1. Browsing & Enrolling in Courses
1. Go to the **Explore / Home** tab.
2. Select your subject or exam goal.
3. Tap on any course to preview lessons and view the syllabus.
4. Tap **Enroll Now** to get instant access.

### 🤖 2. Asking AI Doubts
Stuck on a tricky concept? 
- Tap the **AI Tutor** button on any lesson screen.
- Ask questions in plain language to get instant explanations and step-by-step hints!

### 📥 3. Offline Downloads
Download video lectures and study PDFs to keep learning even without an active internet connection.

### 📜 4. Earning Certificates
Complete 100% of your course lessons and quizzes to automatically unlock your verified Completion Certificate!
`,
  },
  {
    slug: "about-us",
    title: "About Us",
    metaTitle: "About Us | XYZ Education Platform",
    metaDescription: "Discover the mission and vision behind XYZ Education Platform.",
    content: `# About XYZ Education Platform

We believe learning should feel clear, approachable, and meaningful. XYZ Education Platform was created to bring high-quality educational resources directly to students.

---

### Our Core Values
- **Learning Made Simple**: Complex topics explained with structured clarity.
- **Thoughtfully Curated Content**: Practical lessons designed for concept mastery.
- **AI-Powered Guidance**: Instant doubt resolution whenever you need help.

*Thank you for being part of our journey as we build a better way to learn.*
`,
  },
  {
    slug: "refund-policy",
    title: "Refund & Cancellation Policy",
    metaTitle: "Refund Policy | XYZ Education Platform",
    metaDescription: "Details regarding course purchase refunds and cancellation requests.",
    content: `# Refund & Cancellation Policy

*Last updated: August 24, 2026*

### 1. Refund Eligibility
- Refund requests submitted within **7 days** of course purchase are eligible for review, provided less than 20% of the course content has been watched.
- Live batch courses are non-refundable once live sessions have commenced.

### 2. How to Request a Refund
Contact our support desk via the app or email support@xyzeducation.com with your payment transaction ID.

### 3. Processing Timeline
Approved refunds will be processed to the original payment method within 5–7 business days.
`,
  },
  {
    slug: "faq",
    title: "Frequently Asked Questions",
    metaTitle: "FAQ & Help | XYZ Education Platform",
    metaDescription: "Frequently asked questions about course enrollment, payments, and app features.",
    content: `# Frequently Asked Questions

### Q: Can I access my courses on multiple devices?
**A:** Yes! You can log in with your registered phone number across mobile devices and web browsers.

### Q: How do I get my certificate?
**A:** Once you reach 100% completion in all lessons and quizzes of an enrolled course, your certificate will automatically generate in your profile under **Certificates**.

### Q: What payment options are supported?
**A:** We accept UPI (Google Pay, PhonePe, Paytm), Credit/Debit Cards, Net Banking, and Wallets via Razorpay and Stripe.
`,
  },
  {
    slug: "media-speaks",
    title: "Media & Press",
    metaTitle: "Media Speaks | XYZ Education Platform",
    metaDescription: "News highlights and press mentions about XYZ Education Platform.",
    content: `# Media Speaks & Press

Discover what leading educational portals and news outlets are saying about XYZ Education Platform.

- **EdTech Digest**: "XYZ Education Platform revolutionizes mobile learning with AI tutor integrations."
- **Education Today**: "Empowering students across regions with accessible, structured curriculum."
`,
  },
];

async function main() {
  console.log("🌱 Seeding default CMS static pages for XYZ Education Platform...");

  for (const page of defaultPages) {
    await db.cmsPage.upsert({
      where: { slug: page.slug },
      update: {
        title: page.title,
        content: page.content,
        metaTitle: page.metaTitle,
        metaDescription: page.metaDescription,
      },
      create: {
        slug: page.slug,
        title: page.title,
        content: page.content,
        metaTitle: page.metaTitle,
        metaDescription: page.metaDescription,
        isPublished: true,
        version: 1,
        revisions: {
          create: {
            title: page.title,
            content: page.content,
            version: 1,
          },
        },
      },
    });
  }

  console.log("✅ CMS static pages seeded successfully for XYZ Education Platform!");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding CMS pages:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
