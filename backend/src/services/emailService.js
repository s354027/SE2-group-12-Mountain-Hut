/**
 * Author: Raul Oppezzo.
 * Description: A service for sending emails using nodemailer.
 */

const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  pool: true,
  host: process.env.SMTP_HOST || "localhost",
  port: process.env.SMTP_PORT || 1025,
  secure: false,
});

