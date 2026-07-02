import { NextResponse } from "next/server";
import connectMongo from "@/lib/mongodb";
import pdfViewers from "@/models/pdfViewers";
import crypto from "crypto";
import nodemailer from "nodemailer";

const generateVerificationEmail = (verifyUrl) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Email Verification</title>
</head>
<body style="margin:0; padding:0; background-color:#f3f4f6; font-family:Arial, sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f3f4f6; padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="background:#ffffff; border-radius:8px; padding:40px; text-align:center; box-shadow:0 4px 12px rgba(0,0,0,0.05);">
          <tr>
            <td>

              <h1 style="color:#4f46e5; margin-bottom:20px;">QuantumCrafters Studio</h1>

              <h2 style="color:#111827; margin-bottom:10px;">Verify Your Email</h2>
              <p style="color:#374151; font-size:16px; line-height:24px; margin-bottom:30px;">
                Please confirm your email by clicking the button below. This link will expire in <strong>1 hour</strong>.
              </p>

              <a href="${verifyUrl}" 
                 style="display:inline-block; background-color:#4f46e5; color:#ffffff; 
                        text-decoration:none; padding:12px 24px; border-radius:6px; 
                        font-size:16px; font-weight:bold;">
                Verify Email
              </a>

              <p style="margin-top:30px; font-size:14px; color:#6b7280;">
                If the button does not work, copy and paste this link:
              </p>

              <p style="word-break:break-all; font-size:14px; color:#2563eb;">
                ${verifyUrl}
              </p>

              <hr style="margin:30px 0; border:none; border-top:1px solid #e5e7eb;" />
              <p style="font-size:12px; color:#9ca3af;">
                If you did not request this email, ignore it.
              </p>
              <p style="font-size:12px; color:#9ca3af;">© ${new Date().getFullYear()} QuantumCrafters Studio</p>

            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

export async function POST(req) {
  try {
    await connectMongo();
    const { email, name, path } = await req.json();

    // generate token
    const token = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    // find user
    let user = await pdfViewers.findOne({ email: email, pdftype: path });

    // create transporter
    let transporter = nodemailer.createTransport({
      host: "smtpout.secureserver.net",
      port: 465,
      secure: true,
      auth: {
        user: process.env.NEXT_EMAIL_USER,
        pass: process.env.NEXT_EMAIL_PASS,
      },
    });

    const verifyUrl = `${process.env.NEXT_PUBLIC_Live_URL}/api/verify-email?token=${token}&email=${email}&path=${path}`;

    // -----------------------------------------
    // 🟢 CASE 1: NEW USER
    // -----------------------------------------
    if (!user) {
      user = new pdfViewers({
        name,
        email,
        verifyToken: token,
        verifyTokenExpiry: expiry,
        pdftype: path,
        isVerified: false, // important
      });

      await user.save();

      // 1️⃣ Send Verification Email to USER
      await transporter.sendMail({
        from: process.env.NEXT_EMAIL_USER,
        to: email,
        subject: "Verify your email",
        html: generateVerificationEmail(verifyUrl),
      });

      // 2️⃣ Send Notification Email to ADMIN
      await transporter.sendMail({
        from: process.env.NEXT_EMAIL_USER,
        to: process.env.ADMIN_NOTIFICATION_EMAIL, // admin email in env
        subject: "New PDF Access Request",
        html: `
          <h2>New User Requested Access</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>PDF:</strong> ${path}</p>
          <p>User has been sent a verification email.</p>
        `
      });

      return NextResponse.json({
        success: true,
        message: "Verification email sent!",
        isVerified: false,
      });
    }

    // -----------------------------------------
    // 🟢 CASE 2: EXISTING USER (Verify email again)
    // -----------------------------------------
    if (!user.isVerified) {

      user.verifyToken = token;
      user.verifyTokenExpiry = expiry;
      await user.save();

      // 1️⃣ Send Verification Email to USER
      await transporter.sendMail({
        from: process.env.NEXT_EMAIL_USER,
        to: email,
        subject: "Verify your email",
        html: generateVerificationEmail(verifyUrl),
      });

      // 2️⃣ Send Notification Email to ADMIN
      await transporter.sendMail({
        from: process.env.NEXT_EMAIL_USER,
        to: process.env.ADMIN_NOTIFICATION_EMAIL,
        subject: "User Re-Requested Access",
        html: `
          <h2>User Re-requested Verification</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>PDF:</strong> ${path}</p>
          <p>User has been sent a new verification email.</p>
        `
      });

      return NextResponse.json({
        success: true,
        message: "Verification email sent again!",
        isVerified: false,
      });
    }

    // -----------------------------------------
    // 🟢 CASE 3: USER ALREADY VERIFIED
    // -----------------------------------------
    const redirectUrl = `${process.env.NEXT_PUBLIC_Live_URL}${path}?token=${token}`;

    return NextResponse.json({
      success: true,
      url: redirectUrl,
      isVerified: true,
    });

  } catch (err) {
    console.error("Email error:", err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
