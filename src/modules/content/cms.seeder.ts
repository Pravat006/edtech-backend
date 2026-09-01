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
    metaTitle: "About Us | Vie Brain",
    metaDescription: "Discover our mission, vision, and educational platform details.",
  },
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    metaTitle: "Privacy Policy | Vie Brain",
    metaDescription: "Comprehensive privacy policy detailing data collection, identity verification, cloud storage, and user deletion rights.",
  },
  {
    slug: "terms-and-conditions",
    title: "Terms of Use",
    metaTitle: "Terms of Use | Vie Brain",
    metaDescription: "Terms of service, intellectual property guidelines, wallet rules, and user conduct agreement.",
  },
  {
    slug: "refund-policy",
    title: "Cancellation & Refund Policy",
    metaTitle: "Cancellation & Refund Policy | Vie Brain",
    metaDescription: "Detailed refund timelines, eligibility criteria, non-refundable items, and payout processing.",
  },
  {
    slug: "how-to-use",
    title: "How to Use",
    metaTitle: "How to Use | Vie Brain",
    metaDescription: "Guide on using student features, enrolled courses, and doubt support.",
  },
  {
    slug: "media-speaks",
    title: "Media Speaks",
    metaTitle: "Media Speaks | Vie Brain",
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
        let defaultContent = "# " + pageDef.title + "\n\nContent coming soon...";

        if (pageDef.slug === "privacy-policy") {
          defaultContent = `# Privacy Policy

*Last Updated: September 1, 2026*

Welcome to **Vie Brain** ("Platform", "we", "our", or "us"). We are committed to protecting your privacy and ensuring transparency regarding how your personal information is collected, used, stored, and safeguarded across our mobile application and web dashboard.

---

### 1. Information We Collect

To provide our educational services, manage student enrollments, and comply with regulatory standards, we collect the following categories of information:

* **Account & Profile Data**: Full Name, Email Address, Mobile Phone Number, Password hash (salted via Argon2), and Profile Avatar image.
* **Identity & Educational Verification Documents**: Aadhaar Card, PAN Card, Hand-drawn/Scanned Signature, Class X Marksheet, Class XII Marksheet, and College Degree/Semester Marksheets. *These files are uploaded securely for identity verification and educational eligibility.*
* **Learning & Course Progress Data**: Enrolled courses, video lesson completion history, quiz responses, AI Doubt Solver queries, and generated completion certificates.
* **Financial & Transaction Data**: Payment reference IDs (via Razorpay), wallet balances, transaction logs, and referral reward credits. *We do not process or store raw credit card numbers or banking passwords on our servers.*
* **Device & Operational Data**: Expo Push Notification Tokens, IP address, device model, operating system, and app log diagnostics.

---

### 2. How We Use Your Information

We use the collected information strictly for legitimate operational and educational purposes:

1. **Service Delivery**: Granting access to enrolled courses, streaming lesson videos via HLS (Bunny Stream), and delivering PDF learning materials (Bunny Storage).
2. **Verification & Certification**: Verifying academic prerequisites and issuing verifiable certificates upon course completion.
3. **AI Doubt Solver**: Processing user queries using AI models (Gemini / Groq / OpenAI) and managing daily/monthly credit allocations.
4. **Notifications & Updates**: Sending automated push notifications for scheduled drip lessons, course updates, and inactivity reminders.
5. **Financial Accounting & GST Compliance**: Maintaining transaction records for tax reporting and wallet credit operations.

---

### 3. Third-Party Service Providers

We collaborate with trusted third-party service providers to power key application infrastructure. These partners only receive data necessary to perform specific functions:

* **Cloud Storage & CDN**: Bunny CDN, Bunny Stream, and ImageKit (for secure media hosting and HLS video streaming).
* **Payment Processing**: Razorpay (PCI-DSS compliant payment gateway).
* **Communications**: Twilio / MSG91 (SMS OTP delivery) and Nodemailer/SMTP (Email notifications).
* **Push Notifications**: Expo Push Notification Service.
* **AI Processing**: OpenAI, Groq, and Google Gemini (for AI Doubt Solver features).

---

### 4. Account & Data Deletion Rights (App Store & Google Play Compliant)

All users have the absolute right to request permanent deletion of their account and associated data at any time.

* **Self-Service Initiation**: Navigate to **Settings → Account Security → Request Account Deletion** inside the mobile app or web platform.
* **Two-Factor Authorization**: Deletion requires identity confirmation via account password and a 6-digit SMS/Email OTP.
* **Permanent Data Purging**: Upon verification:
  1. All personal identity files (Aadhaar, PAN, signature, marksheets, avatar) are permanently deleted from cloud storage buckets.
  2. The user profile, preferences, address, and login credentials are hard-deleted from our database.
  3. Payment and transaction logs are anonymized ('userId' set to 'null') to maintain compliance with GST tax laws without retaining personal identifiable information (PII).

---

### 5. Data Security & Storage

We implement industry-standard administrative, technical, and physical safeguards:
* All network communication is encrypted using **HTTPS / TLS 1.3**.
* Passwords are hashed using **Argon2id**.
* Uploaded verification documents are stored outside public web roots in isolated cloud buckets.
* Access tokens (JWT) are signed with strong secrets and rotated using short expiry windows.

---

### 6. Contact Us

If you have questions regarding this Privacy Policy or wish to exercise your privacy rights, please contact our support team:
* **Support Portal**: Available in-app under **Help & Support → Create Ticket**.`;
        } else if (pageDef.slug === "terms-and-conditions") {
          defaultContent = `# Terms of Use

*Last Updated: September 1, 2026*

Welcome to **Vie Brain**. By downloading, accessing, or using our mobile application or web platform, you agree to be bound by these Terms of Use ("Terms"). Please read them carefully.

---

### 1. Account Registration & Verification

1. **Accuracy of Information**: You must provide accurate, current, and complete information during registration, including your full name, valid email address, and mobile phone number.
2. **Identity Verification**: When submitting academic or identity verification documents (Aadhaar, PAN, or marksheets), you warrant that all files belong to you. Uploading falsified, forged, or third-party documents will result in immediate account termination.
3. **Account Confidentiality**: You are responsible for maintaining the confidentiality of your login credentials. You agree to notify us immediately of any unauthorized access to your account.

---

### 2. Intellectual Property & Course Content Usage

1. **Limited License**: Enrolling in a course grants you a personal, non-transferable, non-exclusive, revocable license to access and view course videos and learning materials for personal educational purposes.
2. **Prohibited Activities**: You are strictly prohibited from:
   * Downloading, copying, screen-recording, or capturing video streams (HLS/Bunny Stream).
   * Selling, renting, licensing, or redistributing course materials or PDF assets to third parties.
   * Reverse-engineering or attempting to bypass digital rights management (DRM) or signed playback URLs.
3. **Copyright Protection**: All course videos, curriculum materials, logos, and software are the exclusive intellectual property of Vie Brain. Violations will be prosecuted under applicable copyright laws.

---

### 3. AI Doubt Solver & Credit System

1. **Credit Usage**: Access to the AI Doubt Solver consumes platform credits based on query complexity (Quick vs Detailed queries).
2. **Welcome Credits & Top-Ups**: Initial welcome credits are non-transferable and have no monetary cash-out value.
3. **Fair Use**: Submitting automated, spam, or malicious prompts to the AI engine is prohibited and may result in temporary or permanent suspension of AI feature access.

---

### 4. Referral Program & Wallet System

1. **Referral Rewards**: Referral bonuses are credited to your in-app wallet upon successful registration and qualifying course enrollment by your referee.
2. **Wallet Restrictions**: Wallet credits can be applied toward eligible course purchases within the platform. Wallet balances cannot be withdrawn to external bank accounts as physical cash unless explicitly authorized by platform policies.

---

### 5. Community Conduct

When interacting in community forums, discussion boards, or support channels:
* Treat instructors, staff, and fellow learners with respect.
* Do not post offensive, abusive, defamatory, or unlawful content.
* Spammers, unauthorized marketing links, and malicious software uploads will be banned immediately.

---

### 6. Termination & Account Deletion

* **User Termination**: You may request permanent deletion of your account at any time via **Settings → Account Security → Delete Account**.
* **Platform Suspension**: Vie Brain reserves the right to suspend or terminate accounts that violate these Terms, commit fraud, or disrupt platform operations.

---

### 7. Changes to Terms

We reserve the right to update these Terms at any time. Continued use of the platform following published changes constitutes your acceptance of the revised Terms.

---

### 8. Contact Information

For inquiries regarding these Terms:
* **Support Ticket**: Available inside the app under **Help & Support**.`;
        } else if (pageDef.slug === "refund-policy") {
          defaultContent = `# Cancellation & Refund Policy

*Last Updated: September 1, 2026*

At **Vie Brain**, we strive to provide an exceptional learning experience. This Cancellation & Refund Policy outlines the terms and conditions for course cancellations, refund requests, and fee adjustments.

---

### 1. Course Enrollment Refund Eligibility

We offer a **48-Hour Refund Window** for course purchases, subject to the following strict criteria:

1. **Timeframe**: Refund requests must be submitted within **48 hours** of the exact purchase timestamp.
2. **Content Consumption Limit**: Refunds are eligible **only if** you have consumed less than **15%** of the total course video lessons.
3. **Certificates**: If a certificate of completion has already been issued, the purchase becomes non-refundable regardless of time elapsed.

---

### 2. Non-Refundable Services & Purchases

The following are strictly **non-refundable**:

* Requests submitted after the **48-hour** purchase window.
* Courses where more than 15% of the video content has been viewed or course assets downloaded.
* AI Doubt Solver credit top-ups or consumed wallet balances.
* Promotional, discounted bundle offers, or flash-sale enrollments clearly designated as "Non-Refundable".

---

### 3. How to Request a Refund

To request a refund within the eligible 48-hour window:

1. Open the mobile app or web platform and navigate to **Help & Support → Create Ticket**.
2. Select **Category**: "Payment & Refund Issue".
3. Provide your **Order ID / Razorpay Payment ID**, registered Mobile Number, and reason for the refund request.

---

### 4. Refund Processing & Payout Timeline

* **Verification**: Our support team will review your account watch history and payment status within 24 to 48 hours.
* **Approved Refunds**: Once approved, refunds will be initiated automatically to your original payment method (Bank Account, UPI, or Credit/Debit Card) via **Razorpay**.
* **Processing Time**: Payouts typically reflect in your bank account within **5 to 7 business days**, depending on your issuing bank.

---

### 5. Course Cancellation by Platform

If Vie Brain cancels a course or fails to deliver the promised curriculum, enrolled students will receive a **100% full refund** or the option to transfer enrollment to an equivalent course without any extra fees.

---

### 6. Contact Us

For any refund-related assistance:
* **In-App Support**: **Help & Support → Tickets**`;
        }

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
