import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import dotenv from "dotenv";
dotenv.config();

export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export class EmailService {
  private static transporter: Transporter | null = null;

  // Initialize email transporter with Gmail SMTP
  private static getTransporter(): Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    console.log('Initializing email transporter with Gmail SMTP',process.env.EMAIL_USER);

    // Gmail SMTP configuration
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD, // App Password for Gmail
      },
    });

    return this.transporter;
  }

  // Send email
  static async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      // Check if email is configured
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
        console.warn('⚠️  Email service not configured. Skipping email notification.');
        return false;
      }

      const transporter = this.getTransporter();

      const mailOptions = {
        from: `"WhatsApp API" <${process.env.EMAIL_USER}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('✅ Email sent successfully:', info.messageId);
      return true;
    } catch (error) {
      console.error('❌ Failed to send email:', error);
      return false;
    }
  }

  // Send WhatsApp disconnection notification
  static async sendDisconnectionNotification(
    userEmail: string,
    userName: string,
    phoneNumber: string | null,
    whatsappName: string | null,
    accountToken: string
  ): Promise<boolean> {
    const subject = 'WhatsApp Account Disconnected - Action Required';

    // Build reconnection link
    const dashboardUrl = process.env.FRONTEND_DASHBOARD_URL || 'http://localhost:3000';
    const reconnectionLink = `${dashboardUrl}/relink/${accountToken}`;

    const text = `
Dear ${userName},

Your WhatsApp account has been disconnected from the WhatsApp API service.

ACCOUNT DETAILS
- Phone Number: ${phoneNumber || 'Not available'}
- WhatsApp Name: ${whatsappName || 'Not available'}

REASON FOR DISCONNECTION
Your WhatsApp session was disconnected. This could happen due to:
- Logging out from WhatsApp on your phone
- Network connectivity issues
- WhatsApp service interruptions
- Manual disconnection

ACTION REQUIRED
To reconnect your WhatsApp account, please click the link below:
${reconnectionLink}

Alternatively, you may reconnect manually:
1. Log in to your WhatsApp API dashboard
2. Navigate to your accounts section
3. Click on "Reconnect" for the disconnected account
4. Scan the QR code with your WhatsApp mobile app

NEED ASSISTANCE?
If you're experiencing repeated disconnections or need assistance, please contact our support team.

Best regards,
Indas WhatsApp API Team

---
This is an automated notification. Please do not reply to this email.
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f5f5f5;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 30px auto;
      background-color: #ffffff;
      border: 1px solid #e0e0e0;
    }
    .header {
      background-color: #2c3e50;
      color: #ffffff;
      padding: 30px;
      text-align: center;
      border-bottom: 3px solid #34495e;
    }
    .header h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .content {
      padding: 40px 30px;
    }
    .greeting {
      font-size: 16px;
      margin-bottom: 20px;
    }
    .section {
      margin: 25px 0;
    }
    .section-title {
      font-size: 14px;
      font-weight: 700;
      color: #2c3e50;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 10px;
      padding-bottom: 5px;
      border-bottom: 2px solid #ecf0f1;
    }
    .info-table {
      width: 100%;
      margin: 15px 0;
      border-collapse: collapse;
    }
    .info-table td {
      padding: 8px 0;
      border-bottom: 1px solid #ecf0f1;
    }
    .info-table td:first-child {
      font-weight: 600;
      width: 150px;
      color: #555;
    }
    .reconnect-button {
      text-align: center;
      margin: 35px 0;
    }
    .reconnect-button a {
      display: inline-block;
      background-color: #2c3e50;
      color: #ffffff;
      padding: 14px 35px;
      text-decoration: none;
      font-size: 15px;
      font-weight: 600;
      border: 2px solid #2c3e50;
      transition: all 0.3s ease;
    }
    .reconnect-button a:hover {
      background-color: #34495e;
      border-color: #34495e;
    }
    .steps {
      margin: 20px 0;
    }
    .steps ol {
      margin: 10px 0;
      padding-left: 20px;
    }
    .steps li {
      margin: 10px 0;
      line-height: 1.5;
    }
    .note {
      background-color: #f8f9fa;
      border-left: 3px solid #2c3e50;
      padding: 15px;
      margin: 20px 0;
      font-size: 14px;
    }
    .footer {
      background-color: #f8f9fa;
      padding: 20px 30px;
      border-top: 1px solid #e0e0e0;
      text-align: center;
      font-size: 12px;
      color: #777;
    }
    .signature {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #ecf0f1;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>WhatsApp Account Disconnected</h1>
    </div>

    <div class="content">
      <div class="greeting">
        Dear <strong>${userName}</strong>,
      </div>

      <p>Your WhatsApp account has been disconnected from the WhatsApp API service.</p>

      <div class="section">
        <div class="section-title">Account Details</div>
        <table class="info-table">
          <tr>
            <td>Phone Number:</td>
            <td>${phoneNumber || 'Not available'}</td>
          </tr>
          <tr>
            <td>WhatsApp Name:</td>
            <td>${whatsappName || 'Not available'}</td>
          </tr>
        </table>
      </div>

      <div class="note">
        <strong>Action Required:</strong> Please reconnect your WhatsApp account to resume using the API service.
      </div>

      <div class="reconnect-button">
        <a href="${reconnectionLink}">Reconnect Your Account</a>
      </div>

      

      <p>If you're experiencing repeated disconnections or need assistance, please contact our support team.</p>

      <div class="signature">
        <p>Best regards,<br>
        <strong>Indas WhatsApp API Team</strong></p>
      </div>
    </div>

    <div class="footer">
      <p>This is an automated notification. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    return await this.sendEmail({
      to: userEmail,
      subject,
      text,
      html,
    });
  }

  // Verify email configuration
  static async verifyConnection(): Promise<boolean> {
    try {
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
        console.warn('⚠️  Email credentials not configured');
        return false;
      }

      const transporter = this.getTransporter();
      await transporter.verify();
      console.log('✅ Email service is ready');
      return true;
    } catch (error) {
      console.error('❌ Email service verification failed:', error);
      return false;
    }
  }
}
