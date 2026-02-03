// Clean up spam messages from history
import { Database } from "bun:sqlite";

const dbPath = "/root/yujian-presence/backend/data/presence.db";

try {
  const db = new Database(dbPath);
  
  // Count spam messages
  const count = db.query("SELECT COUNT(*) as count FROM history WHERE content LIKE '%模型配额告警%'").get() as { count: number };
  console.log(`Found ${count.count} spam messages`);
  
  // Delete spam messages
  db.run("DELETE FROM history WHERE content LIKE '%模型配额告警%'");
  
  // Verify
  const remaining = db.query("SELECT COUNT(*) as count FROM history WHERE content LIKE '%模型配额告警%'").get() as { count: number };
  console.log(`Remaining spam: ${remaining.count}`);
  
  db.close();
  console.log("✅ Database cleaned successfully");
} catch (error) {
  console.error("❌ Error:", error);
  process.exit(1);
}
