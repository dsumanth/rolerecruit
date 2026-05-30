import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins";
import { expo } from "@better-auth/expo";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import authConfig from "./auth.config";

const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";

export const authComponent = createClient<DataModel>(components.betterAuth);

async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[email] RESEND_API_KEY is not set");
    return;
  }
  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: "RoleRecruit <noreply@rolerecruit.com>",
    to,
    subject,
    html,
  });
  if (error) {
    console.error("[email] Resend send failed:", JSON.stringify(error));
    throw new Error(`Email send failed: ${error.message ?? JSON.stringify(error)}`);
  }
  console.log("[email] sent", data?.id, "to", to);
}

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth({
    baseURL: siteUrl,
    trustedOrigins: ["rolerecruit://", "rolerecruit://*"],
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      sendResetPassword: async ({ user, url }) => {
        await sendEmail({
          to: user.email,
          subject: "Reset your RoleRecruit password",
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 480px; margin: 0 auto;">
              <h2 style="color: #1d1d1f; margin-bottom: 16px;">Reset your password</h2>
              <p style="color: #86868b; line-height: 1.6;">
                We received a request to reset the password for your RoleRecruit account.
              </p>
              <div style="margin: 32px 0;">
                <a href="${url}" style="display: inline-block; padding: 12px 24px; background: #0071e3; color: white; border-radius: 10px; text-decoration: none; font-size: 14px; font-weight: 500;">
                  Reset password
                </a>
              </div>
              <p style="color: #aeaeb2; font-size: 12px; line-height: 1.6;">
                This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
              </p>
            </div>
          `,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendEmail({
          to: user.email,
          subject: "Verify your email for RoleRecruit",
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 480px; margin: 0 auto;">
              <h2 style="color: #1d1d1f; margin-bottom: 16px;">Welcome to RoleRecruit</h2>
              <p style="color: #86868b; line-height: 1.6;">
                Please verify your email address to finish setting up your account.
              </p>
              <div style="margin: 32px 0;">
                <a href="${url}" style="display: inline-block; padding: 12px 24px; background: #0071e3; color: white; border-radius: 10px; text-decoration: none; font-size: 14px; font-weight: 500;">
                  Verify email
                </a>
              </div>
              <p style="color: #aeaeb2; font-size: 12px; line-height: 1.6;">
                If you didn't create an account, you can safely ignore this email.
              </p>
            </div>
          `,
        });
      },
    },
    plugins: [
      expo(),
      emailOTP({
        otpLength: 6,
        expiresIn: 600,
        sendVerificationOTP: async ({ email, otp }) => {
          console.log(`[email-otp] ${email}: ${otp}`);
          await sendEmail({
            to: email,
            subject: "Your RoleRecruit sign-in code",
            html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 480px; margin: 0 auto;">
              <h2 style="color: #1d1d1f; margin-bottom: 16px;">Your sign-in code</h2>
              <p style="color: #86868b; line-height: 1.6;">
                Enter this code in the RoleRecruit app to sign in:
              </p>
              <div style="margin: 32px 0; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #1d1d1f;">
                ${otp}
              </div>
              <p style="color: #aeaeb2; font-size: 12px; line-height: 1.6;">
                This code expires in 10 minutes. If you didn't request it, you can safely ignore this email.
              </p>
            </div>
          `,
          });
        },
      }),
      convex({ authConfig }),
    ],
  });

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;
    return {
      _id: user._id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      image: user.image ?? null,
    };
  },
});
