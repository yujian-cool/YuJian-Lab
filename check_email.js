// check_email.js
require('dotenv').config({ path: require('os').homedir() + '/.openclaw/.env' });
const imaps = require('imap-simple');
const { simpleParser } = require('mailparser');

// Email Accounts Configuration
const ACCOUNTS = [
  {
    name: 'Gmail',
    user: process.env.GMAIL_USER,
    password: process.env.GMAIL_APP_PASSWORD,
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    authTimeout: 10000
  },
  {
    name: 'Exmail 1 (Cool)',
    user: process.env.EXMAIL_1_USER,
    password: process.env.EXMAIL_1_PASS,
    host: 'imap.exmail.qq.com',
    port: 993,
    tls: true,
    authTimeout: 10000
  },
  {
    name: 'Exmail 2 (Team)',
    user: process.env.EXMAIL_2_USER,
    password: process.env.EXMAIL_2_PASS,
    host: 'imap.exmail.qq.com',
    port: 993,
    tls: true,
    authTimeout: 10000
  }
];

async function checkAccount(account) {
  const config = {
    imap: {
      user: account.user,
      password: account.password,
      host: account.host,
      port: account.port,
      tls: account.tls,
      authTimeout: account.authTimeout,
      tlsOptions: { rejectUnauthorized: false } // Sometimes needed for corporate mail
    }
  };

  try {
    const connection = await imaps.connect(config);
    await connection.openBox('INBOX');

    // Fetch only the latest 1 email
    const searchCriteria = ['ALL'];
    const fetchOptions = {
      bodies: ['HEADER', 'TEXT'],
      markSeen: false,
      struct: true
    };
    
    // Get messages - fetching ALL then slicing is inefficient for huge boxes, 
    // but imap-simple API is simpler this way. For MVP it's fine.
    // Optimization: fetch last sequence number first? Let's just grab last 5 to be safe.
    const messages = await connection.search(searchCriteria, fetchOptions);
    
    // Sort by date descending
    messages.sort((a, b) => {
        return new Date(b.attributes.date) - new Date(a.attributes.date);
    });

    const latest = messages[0];
    
    if (!latest) {
      console.log(`[${account.name}] ✅ Connected. Box is empty.`);
      connection.end();
      return;
    }

    // Parse Body
    const all = latest.parts.find(part => part.which === 'TEXT');
    const id = latest.attributes.uid;
    const idHeader = "Imap-Id: "+id + "\r\n";
    
    const parser = await simpleParser(idHeader + (all ? all.body : ""));
    const subject = latest.parts.find(part => part.which === 'HEADER').body.subject[0];
    const from = latest.parts.find(part => part.which === 'HEADER').body.from[0];
    const date = latest.attributes.date;

    console.log(`\n📧 [${account.name}] Latest Email:`);
    console.log(`   From: ${from}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Date: ${date}`);
    
    connection.end();

  } catch (err) {
    console.error(`❌ [${account.name}] Connection Failed: ${err.message}`);
  }
}

async function run() {
  console.log("🔍 Checking connection to 3 mailboxes...");
  const promises = ACCOUNTS.map(acc => checkAccount(acc));
  await Promise.all(promises);
  console.log("\n✅ Done.");
}

run();
