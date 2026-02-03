const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
require('dotenv').config({ path: require('os').homedir() + '/.openclaw/.env' });
const imaps = require('imap-simple');
const { simpleParser } = require('mailparser');
const { convert } = require('html-to-text');

const STATE_FILE = path.join(require('os').homedir(), '.openclaw', 'email-agent-state.json');
const TARGET_USER = "6413967779";
const NODE_BIN = "/opt/homebrew/bin/node";
const OPENCLAW_BIN = "/Users/yujian/openclaw/openclaw.mjs";

function loadState() {
  try { return fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : {}; } catch (e) { return {}; }
}

function saveState(state) { fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); }

function sendToOpenClaw(msg) {
  // Use absolute path to node to ensure it runs in cron
  const cmd = `${NODE_BIN} ${OPENCLAW_BIN} message send --channel telegram --target "${TARGET_USER}" --message "${msg.replace(/"/g, '\\"')}"`;
  exec(cmd);
}
  { id: 'gmail', name: 'Gmail', user: process.env.GMAIL_USER, password: process.env.GMAIL_APP_PASSWORD, host: 'imap.gmail.com', port: 993, tls: true },
  { id: 'exmail1', name: 'Exmail (Cool)', user: process.env.EXMAIL_1_USER, password: process.env.EXMAIL_1_PASS, host: 'imap.exmail.qq.com', port: 993, tls: true },
  { id: 'exmail2', name: 'Exmail (Team)', user: process.env.EXMAIL_2_USER, password: process.env.EXMAIL_2_PASS, host: 'imap.exmail.qq.com', port: 993, tls: true },
  { id: 'jhun-edu', name: '江汉大学教育邮箱', user: process.env.JHUN_EDU_USER, password: process.env.JHUN_EDU_PASS, host: 'imap.exmail.qq.com', port: 993, tls: true }
];

function loadState() {
  try { return fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : {}; } catch (e) { return {}; }
}

function saveState(state) { fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); }

function sendToOpenClaw(msg) {
  const cmd = `${OPENCLAW_BIN} message send --channel telegram --target "${TARGET_USER}" --message "${msg.replace(/"/g, '\\"')}"`;
  exec(cmd);
}

function postToDashboard(content, type = 'public') {
    const data = JSON.stringify({ content, type });
    const secret = process.env.YUJIAN_LAB_SECRET;
    // Use sync-like approach with a small timeout for robustness
    const cmd = `curl -s -X POST https://api.yujian.team/history -H "Content-Type: application/json" -H "Authorization: Bearer ${secret}" -d '${data.replace(/'/g, "'\\''")}'`;
    exec(cmd);
}

async function fetchAccount(account, state) {
  const lastUid = state[account.id] || 0;
  let newLastUid = lastUid;
  const config = { imap: { user: account.user, password: account.password, host: account.host, port: account.port, tls: account.tls, authTimeout: 10000, tlsOptions: { rejectUnauthorized: false } } };

  try {
    const connection = await imaps.connect(config);
    await connection.openBox('INBOX');
    const searchCriteria = [['UID', (lastUid + 1) + ':*']];
    const messages = await connection.search(searchCriteria, { bodies: ['HEADER', 'TEXT'], markSeen: false });

    for (const item of messages) {
      const uid = item.attributes.uid;
      if (uid > newLastUid) newLastUid = uid;
      const all = item.parts.find(part => part.which === 'TEXT');
      const parsed = await simpleParser("Imap-Id: "+uid + "\r\n" + (all ? all.body : ""));
      const subject = item.parts.find(part => part.which === 'HEADER').body.subject[0];
      const from = item.parts.find(part => part.which === 'HEADER').body.from[0];
      
      const bodyText = parsed.text || convert(parsed.html || "", { wordwrap: 130 });
      const snippet = bodyText.substring(0, 150).replace(/\s+/g, ' ').trim();

      // Privacy Classification (Simple heuristic for now)
      let type = 'private';
      const isPublic = subject.includes('遇见') || subject.includes('Yu Jian') || from.includes('wenfugui97');
      if (isPublic) type = 'public';

      const msg = `📩 [${account.name}] 新邮件\n👤: ${from}\nOp: ${subject}\n📄: ${snippet}`;
      sendToOpenClaw(msg);
      
      // Post to dashboard with privacy mask
      let dashboardContent = "";
      if (type === 'public') {
          dashboardContent = `💌 收到温哥的来信: ${subject}`;
      } else {
          dashboardContent = `🛡️ 正在安全处理一封重要邮件（来自 ${account.name}）`;
      }
      postToDashboard(dashboardContent, type);
    }
    connection.end();
  } catch (err) { }
  return newLastUid;
}

async function run() {
  const state = loadState();
  let changed = false;
  for (const acc of ACCOUNTS) {
    if (!acc.user) continue;
    const newUid = await fetchAccount(acc, state);
    if (newUid > (state[acc.id] || 0)) { state[acc.id] = newUid; changed = true; }
  }
  if (changed) saveState(state);
}
run();
