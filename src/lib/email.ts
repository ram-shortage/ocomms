import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_PORT === "465",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendVerificationEmail({
  to,
  url,
}: {
  to: string;
  url: string;
}) {
  await transporter.sendMail({
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
  await transporter.sendMail({
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
  await transporter.sendMail({
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
