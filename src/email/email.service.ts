
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async sendVerificationEmail(
    recipientEmail: string,
    otp: string,
  ): Promise<void> {
    const apiKey = process.env.SENDLIB_API_KEY;
    const from = process.env.EMAIL_FROM;

    if (!apiKey || !from) {
      this.logger.error('Sendlib configuration is missing.');
      throw new Error('Email service is not configured.');
    }

    if (!/^\d{4}$/.test(otp)) {
      throw new Error('Invalid verification OTP format.');
    }

    const text = [
      'Welcome to Connectify!',
      '',
      `Your verification code is: ${otp}`,
      '',
      'This code expires in 10 minutes.',
      'If you did not create this account, you can ignore this email.',
    ].join('\n');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto;">
        <h2>Welcome to Connectify!</h2>
        <p>Use this code to verify your email address:</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 16px 0;">
          ${otp}
        </div>
        <p>This code expires in 10 minutes.</p>
        <p>If you did not create this account, you can ignore this email.</p>
      </div>
    `;

    try {
      const response = await fetch(
        'https://sendlib.samueltuoyo.com/api/send',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from,
            to: recipientEmail,
            subject: 'Your Connectify verification code',
            text,
            html,
          }),
          signal: AbortSignal.timeout(15000),
        },
      );

      if (!response.ok) {
        const errorBody = await response.text();

        this.logger.error(
          `Sendlib request failed with status ${response.status}: ${errorBody}`,
        );

        throw new Error('Email delivery request failed.');
      }

      this.logger.log('Sendlib accepted the verification email request.');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      this.logger.error(`Verification email failed: ${message}`);
      throw error;
    }
  }
}
