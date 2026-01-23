import nodemailer from "nodemailer";

// Only create transporter if SMTP is configured
const transporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_PORT === "465",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null;

function isEmailConfigured(): boolean {
  return !!transporter;
}

export async function sendVerificationEmail({
  to,
  url,
}: {
  to: string;
  url: string;
}) {
  if (!isEmailConfigured()) {
    console.log("[Email] SMTP not configured, skipping verification email to:", to);
    return;
  }
  await transporter!.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: "Verify your email - OComms",
    html: `
      <h1>Verify your email</h1>
      <p>Click the link below to verify your email address:</p>
      <a href="${url}">Verify Email</a>
      <p>This link expires in 24 hours.</p>
    `,
  });
}

export async function sendInviteEmail({
  to,
  inviterName,
  orgName,
  acceptUrl,
}: {
  to: string;
  inviterName: string;
  orgName: string;
  acceptUrl: string;
}) {
  if (!isEmailConfigured()) {
    console.log("[Email] SMTP not configured, skipping invite email to:", to);
    return;
  }
  await transporter!.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: `You've been invited to ${orgName} - OComms`,
    html: `
      <h1>Workspace Invitation</h1>
      <p>${inviterName} has invited you to join ${orgName} on OComms.</p>
      <a href="${acceptUrl}">Accept Invitation</a>
    `,
  });
}

export async function sendUnlockEmail({
  to,
  resetUrl,
}: {
  to: string;
  resetUrl: string;
}) {
  if (!isEmailConfigured()) {
    console.log("[Email] SMTP not configured, skipping unlock email to:", to);
    return;
  }
  await transporter!.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: "Account Access - OComms",
    html: `
      <h1>Account Access</h1>
      <p>We noticed multiple failed login attempts on your account.</p>
      <p>If this was you, you can wait for the lockout to expire or reset your password:</p>
      <a href="${resetUrl}">Reset Password</a>
      <p>If this wasn't you, we recommend changing your password immediately.</p>
    `,
  });
}

export async function sendResetPasswordEmail({
  to,
  url,
}: {
  to: string;
  url: string;
}) {
  if (!isEmailConfigured()) {
    console.log("[Email] SMTP not configured, skipping password reset email to:", to);
    return;
  }
  await transporter!.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: "Reset Your Password - OComms",
    html: `
      <h1>Reset Your Password</h1>
      <p>You requested to reset your password. Click the link below to continue:</p>
      <a href="${url}">Reset Password</a>
      <p>This link expires in 1 hour.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `,
  });
}

export async function sendJoinRequestApprovedEmail({
  to,
  workspaceName,
  workspaceSlug,
}: {
  to: string;
  workspaceName: string;
  workspaceSlug: string;
}) {
  if (!isEmailConfigured()) {
    console.log("[Email] SMTP not configured, skipping join request approved email to:", to);
    return;
  }
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const workspaceUrl = `${baseUrl}/${workspaceSlug}`;

  await transporter!.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: `Your request to join ${workspaceName} was approved - OComms`,
    html: `
      <h1>Request Approved</h1>
      <p>Great news! Your request to join <strong>${workspaceName}</strong> has been approved.</p>
      <p>You can now access the workspace:</p>
      <a href="${workspaceUrl}">Open ${workspaceName}</a>
    `,
  });
}

export async function sendJoinRequestRejectedEmail({
  to,
  workspaceName,
  reason,
}: {
  to: string;
  workspaceName: string;
  reason?: string;
}) {
  if (!isEmailConfigured()) {
    console.log("[Email] SMTP not configured, skipping join request rejected email to:", to);
    return;
  }

  await transporter!.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: `Your request to join ${workspaceName} - OComms`,
    html: `
      <h1>Join Request Update</h1>
      <p>Your request to join <strong>${workspaceName}</strong> was not approved at this time.</p>
      ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
      <p>If you have questions, please contact the workspace administrators.</p>
    `,
  });
}
