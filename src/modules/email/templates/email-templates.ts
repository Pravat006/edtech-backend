/**
 * Production Responsive HTML Email Templates with inline CSS
 */

const baseHeader = (title: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f6f8; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03); border: 1px solid #e5e7eb;">
          <!-- Brand Header -->
          <tr>
            <td style="background-color: #003c33; padding: 28px 32px; text-align: left;">
              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">Vie Brain</h1>
              <p style="margin: 4px 0 0 0; color: #a7f3d0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">LMS Platform</p>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding: 32px;">
`;

const baseFooter = `
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 32px; border-top: 1px solid #f3f4f6; text-align: center;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.5;">
                &copy; ${new Date().getFullYear()} Vie Brain. All rights reserved.<br>
                This is an automated system email. Please do not reply directly.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

export function renderSubAdminInviteTemplate(params: {
    name: string;
    acceptUrl: string;
    permissions: string[];
}) {
    const permList = params.permissions && params.permissions.length > 0
        ? params.permissions.map(p => `<li style="margin-bottom: 4px; font-weight: 500;">${p}</li>`).join("")
        : `<li>Standard Sub-Admin Dashboard Access</li>`;

    const html = `
    ${baseHeader("Sub-Admin Invitation")}
      <h2 style="margin-top: 0; color: #111827; font-size: 20px; font-weight: 600;">Admin Account Invitation</h2>
      <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">Hello <strong>${params.name}</strong>,</p>
      <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">
        You have been invited to join the Vie Brain Admin Platform as a <strong>Sub-Admin</strong>.
      </p>

      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin: 24px 0;">
        <h4 style="margin: 0 0 8px 0; color: #166534; font-size: 14px;">Assigned Permissions:</h4>
        <ul style="margin: 0; padding-left: 20px; color: #15803d; font-size: 13px;">
          ${permList}
        </ul>
      </div>

      <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">
        Please click the button below to set up your password and activate your admin account. This single-use link expires in 24 hours.
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${params.acceptUrl}" style="background-color: #003c33; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 9999px; font-size: 14px; font-weight: 600; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">Set Up Admin Password &rarr;</a>
      </div>

      <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
        If you did not expect this invitation, please ignore this email or notify your system Super Admin.
      </p>
    ${baseFooter}
    `;

    const text = `Hello ${params.name},\n\nYou have been invited to join the Vie Brain Admin Platform as a Sub-Admin.\n\nAssigned Permissions: ${params.permissions.join(", ")}\n\nPlease accept your invitation and set up your password using the link below (expires in 24 hours):\n${params.acceptUrl}\n\nVie Brain`;

    return { html, text };
}

export function renderDocumentVerificationTemplate(params: {
    studentName: string;
    documentType: string;
    status: "APPROVED" | "REJECTED";
    reason?: string;
}) {
    const isApproved = params.status === "APPROVED";
    const statusColor = isApproved ? "#10B981" : "#EF4444";
    const statusBg = isApproved ? "#ECFDF5" : "#FEF2F2";
    const statusBorder = isApproved ? "#A7F3D0" : "#FCA5A5";

    const html = `
    ${baseHeader("Document Verification Status")}
      <h2 style="margin-top: 0; color: #111827; font-size: 20px; font-weight: 600;">Verification Status Update</h2>
      <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">Hello <strong>${params.studentName}</strong>,</p>
      <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">
        Your submission for <strong>${params.documentType}</strong> has been reviewed by our administration team.
      </p>

      <div style="background-color: ${statusBg}; border: 1px solid ${statusBorder}; border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center;">
        <span style="font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: ${statusColor}; font-weight: 700;">Status</span>
        <h3 style="margin: 4px 0 0 0; font-size: 22px; color: ${statusColor};">${params.status}</h3>
        ${params.reason ? `<p style="margin: 12px 0 0 0; color: #991B1B; font-size: 14px;"><strong>Reason:</strong> ${params.reason}</p>` : ""}
      </div>

      ${!isApproved ? `
      <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">
        Please log into the app, go to your profile details screen, and re-upload a clear, readable copy of your ${params.documentType}.
      </p>` : `
      <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">
        Thank you for keeping your profile records up to date!
      </p>`}
    ${baseFooter}
    `;

    const text = `Hello ${params.studentName},\n\nYour submission for ${params.documentType} status: ${params.status}.${params.reason ? ` Reason: ${params.reason}` : ""}\n\nVie Brain`;

    return { html, text };
}

export function renderPasswordResetTemplate(params: {
    name: string;
    resetUrl: string;
}) {
    const html = `
    ${baseHeader("Password Reset Request")}
      <h2 style="margin-top: 0; color: #111827; font-size: 20px; font-weight: 600;">Reset Your Password</h2>
      <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">Hello <strong>${params.name}</strong>,</p>
      <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">
        We received a request to reset the password for your account. Click the button below to proceed.
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${params.resetUrl}" style="background-color: #003c33; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 9999px; font-size: 14px; font-weight: 600; display: inline-block;">Reset Password &rarr;</a>
      </div>

      <p style="color: #6b7280; font-size: 13px;">
        This link will expire in 15 minutes. If you did not request a password reset, no further action is required.
      </p>
    ${baseFooter}
    `;

    const text = `Hello ${params.name},\n\nUse the link below to reset your password (expires in 15 minutes):\n${params.resetUrl}\n\nVie Brain`;

    return { html, text };
}

export function renderEmailVerificationOtpTemplate(params: {
    name: string;
    otpCode: string;
}) {
    const html = `
    ${baseHeader("Email Verification OTP")}
      <h2 style="margin-top: 0; color: #111827; font-size: 20px; font-weight: 600;">Verify Your Email Address</h2>
      <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">Hello <strong>${params.name}</strong>,</p>
      <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">
        Please use the following 6-digit verification code to complete your email update on Vie Brain:
      </p>

      <div style="background-color: #f0fdf4; border: 1px dashed #10b981; border-radius: 16px; padding: 24px; margin: 28px 0; text-align: center;">
        <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #047857; font-weight: 700;">Verification Code</span>
        <div style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #064e3b; margin-top: 8px;">
          ${params.otpCode}
        </div>
      </div>

      <p style="color: #6b7280; font-size: 13px;">
        This code is valid for 5 minutes. If you did not request to update your email, please secure your account immediately.
      </p>
    ${baseFooter}
    `;

    const text = `Hello ${params.name},\n\nYour email verification code for Vie Brain is: ${params.otpCode}\n\nThis code expires in 5 minutes.`;

    return { html, text };
}
