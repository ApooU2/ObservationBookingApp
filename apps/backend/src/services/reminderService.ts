import cron from 'node-cron';
import moment from 'moment';
import { Booking } from '../models/Booking';
import emailService from './emailService';

class ReminderService {
  
  public startReminderScheduler(): void {
    // Send reminders daily at 10 AM for bookings happening the next day
    cron.schedule('0 10 * * *', async () => {
      await this.sendDailyReminders();
    });

    // Send reminders 2 hours before booking start time
    cron.schedule('*/30 * * * *', async () => {
      await this.sendImmediateReminders();
    });
  }

  private async sendDailyReminders(): Promise<void> {
    try {
      const tomorrow = moment().add(1, 'day').startOf('day');
      const endOfTomorrow = moment().add(1, 'day').endOf('day');

      const bookings = await Booking.find({
        startTime: {
          $gte: tomorrow.toDate(),
          $lte: endOfTomorrow.toDate()
        },
        status: { $in: ['pending', 'confirmed'] },
        reminderSent: { $ne: true }
      }).populate([
        { path: 'telescope', select: 'name location' },
        { path: 'user', select: 'name email' }
      ]);

      for (const booking of bookings) {
        try {
          await emailService.sendBookingReminder(booking);
          booking.reminderSent = true;
          await booking.save();
        } catch (error) {
          console.error(`Failed to send reminder for booking ${booking._id}:`, error);
        }
      }

      if (bookings.length > 0) {
        console.log(`Sent ${bookings.length} booking reminders for tomorrow`);
      }
    } catch (error) {
      console.error('Error in daily reminder service:', error);
    }
  }

  private async sendImmediateReminders(): Promise<void> {
    try {
      const now = moment();
      const twoHoursFromNow = moment().add(2, 'hours');

      const bookings = await Booking.find({
        startTime: {
          $gte: now.toDate(),
          $lte: twoHoursFromNow.toDate()
        },
        status: { $in: ['pending', 'confirmed'] },
        immediateReminderSent: { $ne: true }
      }).populate([
        { path: 'telescope', select: 'name location' },
        { path: 'user', select: 'name email' }
      ]);

      for (const booking of bookings) {
        const startTime = moment(booking.startTime);
        const timeUntilStart = startTime.diff(now, 'minutes');

        // Send reminder if booking is between 90-120 minutes away
        if (timeUntilStart >= 90 && timeUntilStart <= 120) {
          try {
            await this.sendImmediateBookingReminder(booking);
            booking.immediateReminderSent = true;
            await booking.save();
          } catch (error) {
            console.error(`Failed to send immediate reminder for booking ${booking._id}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error in immediate reminder service:', error);
    }
  }

  private async sendImmediateBookingReminder(booking: any): Promise<void> {
    const user = booking.user;
    const telescope = booking.telescope;
    const startTime = moment(booking.startTime);
    const timeUntilStart = startTime.diff(moment(), 'minutes');

    const subject = `Observatory Session Starting Soon - ${telescope.name}`;
    const html = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1976d2; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
            .urgent { background: #fff3e0; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #ff9800; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔭 Observatory Session Starting Soon!</h1>
            </div>
            <div class="content">
              <p>Hello ${user.name},</p>
              
              <div class="urgent">
                <h3>⏰ Your session starts in ${Math.round(timeUntilStart)} minutes!</h3>
                <p><strong>Telescope:</strong> ${telescope.name}</p>
                <p><strong>Location:</strong> ${telescope.location}</p>
                <p><strong>Time:</strong> ${startTime.format('HH:mm')}</p>
              </div>

              <p>Final reminders:</p>
              <ul>
                <li>🚗 Leave now if you haven't already</li>
                <li>🧥 Bring warm clothing</li>
                <li>🔦 Red flashlight for night vision</li>
                <li>📝 Notebook for observations</li>
              </ul>

              <p>We can't wait to help you explore the universe!</p>
              
              <div class="footer">
                <p>Safe travels and clear skies!</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    await emailService.sendBookingReminder(booking);
  }

  // Method to manually trigger reminders (for testing)
  public async sendTestReminders(): Promise<void> {
    await this.sendDailyReminders();
    await this.sendImmediateReminders();
  }
}

export default new ReminderService();
