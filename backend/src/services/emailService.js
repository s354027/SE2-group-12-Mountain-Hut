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

// Without a listener, an async pool connection error (e.g. SMTP server down)
// would be an unhandled 'error' event and crash the whole process.
transporter.on?.("error", (err) => {
  console.error("Email transporter error:", err);
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
 * Sends a booking email to the specified recipient.
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
async function sendBookingEmail(
  to,
  username,
  reservationId,
  date,
  slotStart,
  slotEnd,
  partySize,
  partyRequirements = null,
  isModification = false,
) {
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

  const subject = isModification
    ? `Booking Updated #${reservationId}`
    : `Booking Confirmation #${reservationId}`;
  const title = isModification
    ? "Your Reservation Has Been Updated"
    : "Your Reservation Is Confirmed! 🥳";
  const introduction = isModification
    ? "The changes to your reservation have been saved. Here are the updated details:"
    : "We are pleased to confirm your reservation. Here are the details of your booking:";
  const closing = isModification
    ? "If you did not request this change, please contact the Mountain Hut team."
    : "We look forward to welcoming you and providing you with a wonderful dining experience.";
  const footer = isModification
    ? "This is an automated reservation update email."
    : "This is an automated reservation confirmation email.";

  const html = `
  <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 28px auto 0; padding: 28px;">
    <h1 style="color: #1a3a2a; margin-top: 0;">${title}</h1>
    <p>Dear ${username},</p>
    <p>${introduction}</p>
  
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
  
    <p>${closing}</p>
    <p>See you soon!<br><strong>The Mountain Hut Team</strong></p>
    
    <hr style="border: none; border-top: 1px solid #e2e8e4; margin: 20px 0; width: 100%">
    
    <p style="font-size: 12px; margin: 0; color: #777; text-align: center;">${footer}</p>
  </div>
  `;
  return await sendEmail(to, subject, html);
}

export function sendBookingConfirmation(
  to, username, reservationId, date, slotStart, slotEnd, partySize, partyRequirements = null
) {
  return sendBookingEmail(to, username, reservationId, date, slotStart, slotEnd, partySize, partyRequirements);
}

export function sendBookingModification(
  to, username, reservationId, date, slotStart, slotEnd, partySize, partyRequirements = null
) {
  return sendBookingEmail(to, username, reservationId, date, slotStart, slotEnd, partySize, partyRequirements, true);
}

/**
 * Sends the password recovery email (MH-07).
 * @param {string} to The recipient's email address.
 * @param {string} username The name of the user.
 * @param {string} resetLink The single-use link to reset the password.
 * @returns {Promise<boolean>} Returns true if the email was sent successfully, false otherwise.
 */
export const sendPasswordResetEmail = async (to, username, resetLink) => {
  if (typeof to !== "string" || !to.trim()) {
    throw new TypeError("to must be a non-empty email address");
  }
  if (typeof username !== "string" || !username.trim()) {
    throw new TypeError("username must be a non-empty string");
  }
  if (typeof resetLink !== "string" || !resetLink.trim()) {
    throw new TypeError("resetLink must be a non-empty string");
  }

  const subject = "Reset your Mountain Hut password";

  const html = `
  <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 28px auto 0; padding: 28px;">
    <h1 style="color: #1a3a2a; margin-top: 0;">Password reset</h1>
    <p>Dear ${username},</p>
    <p>We received a request to reset the password of your Mountain Hut account.</p>
    <p style="margin: 24px 0;">
      <a href="${resetLink}" style="background-color: #1a3a2a; color: #fff; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-weight: bold;">Choose a new password</a>
    </p>
    <p>The link can be used only once and expires in 24 hours.</p>
    <p>If you did not request a password reset, you can safely ignore this email.</p>
    <p><strong>The Mountain Hut Team</strong></p>
    <hr style="border: none; border-top: 1px solid #e2e8e4; margin: 20px 0; width: 100%">
    <p style="font-size: 12px; margin: 0; color: #777; text-align: center;">This is an automated email.</p>
  </div>
  `;
  return await sendEmail(to, subject, html);
};
