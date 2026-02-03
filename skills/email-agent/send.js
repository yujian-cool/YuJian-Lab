const nodemailer = require('nodemailer');
require('dotenv').config({ path: require('os').homedir() + '/.openclaw/.env' });

// Usage: node send.js <to> <subject> <body> <account_id>
// Accounts: gmail, exmail1, exmail2

const [,, to, subject, body, accountId] = process.argv;

if (!to || !subject || !body) {
  console.log("Usage: node send.js <to> <subject> <body> [account_id]");
  process.exit(1);
}

// Config
const ACCOUNTS = {
  'gmail': {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
    host: 'smtp.gmail.com',
    port: 465
  },
  'exmail1': {
    user: process.env.EXMAIL_1_USER,
    pass: process.env.EXMAIL_1_PASS,
    host: 'smtp.exmail.qq.com',
    port: 465
  },
  'exmail2': {
    user: process.env.EXMAIL_2_USER, // Default: bmw@yujian.team
    pass: process.env.EXMAIL_2_PASS,
    host: 'smtp.exmail.qq.com',
    port: 465
  }
};

const targetAccount = ACCOUNTS[accountId || 'gmail']; // Default to Gmail

if (!targetAccount || !targetAccount.user) {
  console.error("Error: Account not found or credentials missing.");
  process.exit(1);
}

async function send() {
  const transporter = nodemailer.createTransport({
    host: targetAccount.host,
    port: targetAccount.port,
    secure: true, // SSL
    auth: {
      user: targetAccount.user,
      pass: targetAccount.pass
    }
  });

  try {
    const info = await transporter.sendMail({
      from: `"温明博" <${targetAccount.user}>`,
      to: to,
      subject: subject,
      text: body
    });
    console.log(`✅ Email sent: ${info.messageId}`);
  } catch (err) {
    console.error(`❌ Send failed: ${err.message}`);
    process.exit(1);
  }
}

send();
