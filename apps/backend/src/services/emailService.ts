import nodemailer from 'nodemailer';
import { IBooking } from '../models/Booking';
import { ITelescope } from '../models/Telescope';
import { IUser } from '../models/User';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  private async sendEmail(options: EmailOptions): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: process.env.FROM_EMAIL || 'noreply@observatory.com',
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
      console.log(`Email sent to ${options.to}: ${options.subject}`);
    } catch (error) {
      console.error('Email sending failed:', error);
      throw error;
    }
  }

  async sendBookingConfirmation(booking: any): Promise<void> {
    const user = booking.user as IUser;
    const telescope = booking.telescope as ITelescope;
    const startTime = new Date(booking.startTime);
    const endTime = new Date(booking.endTime);

    const subject = `Observatory Booking Confirmed - ${telescope.name}`;
    const html = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1976d2; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
            .booking-details { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
            .button { display: inline-block; background: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔭 Observatory Booking Confirmed</h1>
            </div>
            <div class="content">
              <p>Hello ${user.name},</p>
              <p>Your observatory booking has been confirmed! Here are the details:</p>
              
              <div class="booking-details">
                <h3>Booking Details</h3>
                <p><strong>Telescope:</strong> ${telescope.name}</p>
                <p><strong>Location:</strong> ${telescope.location}</p>
                <p><strong>Date:</strong> ${startTime.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</p>
                <p><strong>Time:</strong> ${startTime.toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })} - ${endTime.toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}</p>
                <p><strong>Duration:</strong> ${Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60))} minutes</p>
                <p><strong>Purpose:</strong> ${booking.purpose}</p>
                ${booking.notes ? `<p><strong>Notes:</strong> ${booking.notes}</p>` : ''}
                <p><strong>Booking ID:</strong> ${booking._id}</p>
              </div>

              <h3>Important Information</h3>
              <ul>
                <li>Please arrive 15 minutes before your scheduled time</li>
                <li>Bring appropriate clothing for outdoor observation</li>
                <li>Check weather conditions before your visit</li>
                <li>You can cancel this booking up to 2 hours before the start time</li>
              </ul>

              <p>If you need to cancel or modify your booking, please visit our website or contact us directly.</p>
              
              <div class="footer">
                <p>Thank you for choosing our Observatory!</p>
                <p>This is an automated message. Please do not reply to this email.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
      Observatory Booking Confirmed
      
      Hello ${user.name},
      
      Your observatory booking has been confirmed!
      
      Booking Details:
      - Telescope: ${telescope.name}
      - Location: ${telescope.location}
      - Date: ${startTime.toLocaleDateString()}
      - Time: ${startTime.toLocaleTimeString()} - ${endTime.toLocaleTimeString()}
      - Purpose: ${booking.purpose}
      ${booking.notes ? `- Notes: ${booking.notes}` : ''}
      - Booking ID: ${booking._id}
      
      Important: Please arrive 15 minutes early and bring appropriate clothing.
      You can cancel up to 2 hours before your scheduled time.
      
      Thank you for choosing our Observatory!
    `;

    await this.sendEmail({
      to: user.email,
      subject,
      html,
      text,
    });
  }

  async sendBookingCancellation(booking: any): Promise<void> {
    const user = booking.user as IUser;
    const telescope = booking.telescope as ITelescope;
    const startTime = new Date(booking.startTime);

    const subject = `Observatory Booking Cancelled - ${telescope.name}`;
    const html = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #d32f2f; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
            .booking-details { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔭 Observatory Booking Cancelled</h1>
            </div>
            <div class="content">
              <p>Hello ${user.name},</p>
              <p>Your observatory booking has been cancelled as requested.</p>
              
              <div class="booking-details">
                <h3>Cancelled Booking Details</h3>
                <p><strong>Telescope:</strong> ${telescope.name}</p>
                <p><strong>Date:</strong> ${startTime.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</p>
                <p><strong>Time:</strong> ${startTime.toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}</p>
                <p><strong>Booking ID:</strong> ${booking._id}</p>
              </div>

              <p>We're sorry to see you cancel your observation session. You can make a new booking anytime on our website.</p>
              
              <div class="footer">
                <p>Thank you for using our Observatory Booking System!</p>
                <p>This is an automated message. Please do not reply to this email.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    await this.sendEmail({
      to: user.email,
      subject,
      html,
    });
  }

  async sendBookingReminder(booking: any): Promise<void> {
    const user = booking.user as IUser;
    const telescope = booking.telescope as ITelescope;
    const startTime = new Date(booking.startTime);
    const endTime = new Date(booking.endTime);

    const subject = `Reminder: Observatory Session Tomorrow - ${telescope.name}`;
    const html = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #f57c00; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
            .booking-details { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
            .weather-tip { background: #e3f2fd; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #1976d2; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔭 Observatory Session Reminder</h1>
            </div>
            <div class="content">
              <p>Hello ${user.name},</p>
              <p>This is a friendly reminder that you have an observatory session tomorrow!</p>
              
              <div class="booking-details">
                <h3>Your Booking Details</h3>
                <p><strong>Telescope:</strong> ${telescope.name}</p>
                <p><strong>Location:</strong> ${telescope.location}</p>
                <p><strong>Date:</strong> ${startTime.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</p>
                <p><strong>Time:</strong> ${startTime.toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })} - ${endTime.toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}</p>
                <p><strong>Purpose:</strong> ${booking.purpose}</p>
              </div>

              <div class="weather-tip">
                <h3>🌤️ Preparation Tips</h3>
                <ul>
                  <li>Check the weather forecast - clear skies are ideal for observation</li>
                  <li>Dress warmly in layers as temperatures drop at night</li>
                  <li>Bring a red flashlight to preserve night vision</li>
                  <li>Arrive 15 minutes early for setup and orientation</li>
                  <li>Consider bringing a notebook to record your observations</li>
                </ul>
              </div>

              <p>We're excited to help you explore the cosmos! If you need to cancel (minimum 2 hours notice required), please visit our website.</p>
              
              <div class="footer">
                <p>Clear skies and happy observing!</p>
                <p>This is an automated message. Please do not reply to this email.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    await this.sendEmail({
      to: user.email,
      subject,
      html,
    });
  }

  async sendAdminNotification(booking: any, action: 'created' | 'cancelled'): Promise<void> {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return;

    const user = booking.user as IUser;
    const telescope = booking.telescope as ITelescope;
    const startTime = new Date(booking.startTime);

    const actionText = action === 'created' ? 'New Booking Created' : 'Booking Cancelled';
    const subject = `${actionText} - ${telescope.name}`;

    const html = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2>${actionText}</h2>
          <p><strong>User:</strong> ${user.name} (${user.email})</p>
          <p><strong>Telescope:</strong> ${telescope.name}</p>
          <p><strong>Date:</strong> ${startTime.toLocaleDateString()}</p>
          <p><strong>Time:</strong> ${startTime.toLocaleTimeString()}</p>
          <p><strong>Purpose:</strong> ${booking.purpose}</p>
          <p><strong>Booking ID:</strong> ${booking._id}</p>
          ${booking.notes ? `<p><strong>Notes:</strong> ${booking.notes}</p>` : ''}
        </body>
      </html>
    `;

    await this.sendEmail({
      to: adminEmail,
      subject,
      html,
    });
  }
}

export default new EmailService();
