import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  async sendVerificationEmail(
    recipientEmail: string,
    otp: string,
  ): Promise<void> {
    const from = process.env.EMAIL_FROM;

    if (
      !from ||
      !process.env.SMTP_HOST ||
      !process.env.SMTP_USER ||
      !process.env.SMTP_PASSWORD
    ) {
      this.logger.error(
        'Email SMTP configuration is missing. Check EMAIL_FROM, SMTP_HOST, SMTP_USER, and SMTP_PASSWORD.',
      );

      throw new Error('Email SMTP configuration is missing.');
    }

    if (!/^\d{4}$/.test(otp)) {
      throw new Error('Invalid verification OTP format.');
    }

    this.logger.log(`Attempting SMTP delivery to ${recipientEmail}`);

    try {
      await this.transporter.sendMail({
        from,
        to: recipientEmail,
        subject: 'Your Connectify verification code',
        text: [
          'Welcome to Connectify!',
          '',
          `Your verification code is: ${otp}`,
          '',
          'This code expires in 10 minutes.',
          'If you did not create this account, you can ignore this email.',
        ].join('\n'),
        html: `
        <h2>Welcome to Connectify!</h2>
        <p>Your verification code is:</p>
        <h1>${otp}</h1>
        <p>This code expires in 10 minutes.</p>
        <p>If you did not create this account, you can ignore this email.</p>
      `,
      });

      this.logger.log(`SMTP delivery accepted for ${recipientEmail}`);
    } catch (error) {
      const err = error instanceof Error ? error : undefined;

      this.logger.error(
        `SMTP delivery failed for ${recipientEmail}. ` +
          `Error: ${err?.message ?? String(error)}`,
        err?.stack,
      );

      throw error;
    }
  }
}
