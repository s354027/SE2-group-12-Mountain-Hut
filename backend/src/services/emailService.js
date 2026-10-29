/**
 * Author: Raul Oppezzo.
 * Description: A service for sending emails using nodemailer.
 */

import nodemailer from "nodemailer";

// Create a transporter object
const transporter = nodemailer.createTransport({
  pool: true,
  host: process.env.SMTP_HOST || "localhost",
  port: process.env.SMTP_PORT || 1025,
  secure: false,
});

/**
 * Sends an email using the configured transporter.
 * @param {*} to The recipient's email address.
 * @param {*} subject The subject of the email.
 * @param {*} html The HTML content of the email.
 * @returns {Promise<boolean>} Returns true if the email was sent successfully, false otherwise.
 */
const sendEmail = async (to, subject, html) => {
  try {
    const mailOptions = {
      from: process.env.SMTP_FROM || "<noreply@mountainhut.it>",
      to,
      subject,
      html,
    };
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
};

/**
 * Verifies the email transporter to ensure it's ready to send emails.
 * Logs a message indicating whether the transporter is ready or if there was an error.
 */
export const verifyTransporter = async () => {
  try {
    await transporter.verify();
    console.log("Email transporter is ready to send messages");
  } catch (err) {
    console.error(err);
  }
};

/**
 * Sends a booking confirmation email to the specified recipient.
 * @param {string} to The recipient's email address.
 * @param {string} username The name of the user making the reservation.
 * @param {number} reservationId The unique identifier for the reservation.
 * @param {string} date The slot date, in the format "DD/MM/YYYY".
 * @param {string} slotStart The slot start time, in the format "HH:MM".
 * @param {string} slotEnd The slot end time, in the format "HH:MM".
 * @param {number} partySize The number of guests in the reservation.
 * @param {string|null} partyRequirements Any requirements provided for the party.
 * @returns {Promise<boolean>} Returns true if the email was sent successfully, false otherwise.
 */
export const sendBookingConfirmation = async (
  to,
  username,
  reservationId,
  date,
  slotStart,
  slotEnd,
  partySize,
  partyRequirements = null,
) => {
  if (typeof to !== "string" || !to.trim()) {
    throw new TypeError("to must be a non-empty email address");
  }
  if (typeof username !== "string" || !username.trim()) {
    throw new TypeError("username must be a non-empty string");
  }
  if (!Number.isInteger(reservationId)) {
    throw new TypeError("reservationId must be an integer");
  }
  if (!Number.isInteger(partySize) || partySize < 1) {
    throw new TypeError("partySize must be a positive integer");
  }
  if (
    partyRequirements !== null &&
    typeof partyRequirements !== "string"
  ) {
    throw new TypeError("partyRequirements must be a string or null");
  }

  const subject = `Booking Confirmation #${reservationId}`;

  const html = `
  <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 28px auto 0; padding: 28px;">
    <h1 style="color: #1a3a2a; margin-top: 0;">Your Reservation Is Confirmed! 🥳</h1>
    <p>Dear ${username},</p>
    <p>We are pleased to confirm your reservation. Here are the details of your booking:</p>
  
    <div style="font-size: 14px; font-weight: bold; margin-bottom: 12px; width: 100%; max-width: 340px;">
      Booking reference: <span style="font-size: 16px;">#${reservationId}</span>
    </div>
  
    <div style="border: 1px solid #e2e8e4; border-radius: 10px; padding: 15px; margin: 0 0 24px 0; width: 100%; max-width: 340px;">
    
      <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 12px;">
        <tr>
          <td style="width: 40px; vertical-align: middle;">
            <div style="background-color: #f0f0f0; width: 34px; height: 34px; border-radius: 6px; text-align: center; line-height: 34px; font-size: 18px;">📅</div>
          </td>
          <td style="vertical-align: middle; padding-left: 10px;">
            <div style="font-size: 11px; text-transform: capitalize; color: #6b7c73; font-weight: bold;">Date</div>
            <div style="font-size: 15px; color: #2c3e35; font-weight: bold;">${date}</div>
          </td>
        </tr>
      </table>
    
      <hr style="border: none; border-top: 1px solid #e2e8e4; margin: 10px 0;">
    
      <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 12px; margin-top: 12px;">
        <tr>
          <td style="width: 40px; vertical-align: middle;">
            <div style="background-color: #f0f0f0; width: 34px; height: 34px; border-radius: 6px; text-align: center; line-height: 34px; font-size: 18px;">⏰</div>
          </td>
          <td style="vertical-align: middle; padding-left: 10px;">
            <div style="font-size: 11px; text-transform: capitalize; color: #6b7c73; font-weight: bold;">Time</div>
            <div style="font-size: 15px; color: #2c3e35; font-weight: bold;">${slotStart} – ${slotEnd}</div>
          </td>
        </tr>
      </table>
    
      <hr style="border: none; border-top: 1px solid #e2e8e4; margin: 10px 0;">
      
      <table role="presentation" style="width: 100%; border-collapse: collapse; margin-top: 12px;">
        <tr>
          <td style="width: 40px; vertical-align: middle;">
            <div style="background-color: #f0f0f0; width: 34px; height: 34px; border-radius: 6px; text-align: center; line-height: 34px; font-size: 18px;">👥</div>
          </td>
          <td style="vertical-align: middle; padding-left: 10px;">
            <div style="font-size: 11px; text-transform: capitalize; color: #6b7c73; font-weight: bold;">Party size</div>
            <div style="font-size: 15px; color: #2c3e35; font-weight: bold;">${partySize} people</div>
          </td>
        </tr>
      </table>

      <hr style="border: none; border-top: 1px solid #e2e8e4; margin: 10px 0;">

      <table role="presentation" style="width: 100%; border-collapse: collapse; margin-top: 12px;">
        <tr>
          <td style="width: 40px; vertical-align: middle;">
            <div style="background-color: #f0f0f0; width: 34px; height: 34px; border-radius: 6px; text-align: center; line-height: 34px; font-size: 18px;">📝</div>
          </td>
          <td style="vertical-align: middle; padding-left: 10px;">
            <div style="font-size: 11px; text-transform: capitalize; color: #6b7c73; font-weight: bold;">Party requirements</div>
            <div style="font-size: 14px; color: #2c3e35; font-weight: bold;">${partyRequirements?.trim() || "None specified"}</div>
          </td>
        </tr>
      </table>
      
    </div>
  
    <p>We look forward to welcoming you and providing you with a wonderful dining experience.</p>
    <p>See you soon!<br><strong>The Mountain Hut Team</strong></p>
    
    <hr style="border: none; border-top: 1px solid #e2e8e4; margin: 20px 0; width: 100%">
    
    <p style="font-size: 12px; margin: 0; color: #777; text-align: center;">This is an automated reservation confirmation email.</p>
  </div>
  `;
  return await sendEmail(to, subject, html);
};
