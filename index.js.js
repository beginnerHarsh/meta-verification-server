import express from "express";
import axios from "axios";
import crypto from "crypto";

const app = express();

// Raw body is needed for signature verification
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    }
  })
);

const VERIFY_TOKEN = "verify_token_123";
const APP_SECRET = "be27263714ae8a5e75fc54e6b61b1436"; // ← IMPORTANT
const N8N_URL = "https://harshkumar7017.app.n8n.cloud/webhook/whatsapp-incoming";

// In-memory deduplication store
const processedMessageIds = new Set();
const processedStatusIds = new Set();

// Helper: verify signature
function verifySignature(req) {
  const signature = req.headers["x-hub-signature-256"];
  if (!signature) return false;

  const expected =
    "sha256=" +
    crypto
      .createHmac("sha256", APP_SECRET)
      .update(req.rawBody)
      .digest("hex");

  return signature === expected;
}

// 1. Webhook verification
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified!");
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// 2. Webhook receiver
app.post("/webhook", async (req, res) => {
  console.log("----- Incoming WhatsApp Webhook -----");

  // 🔐 Signature verification
  if (!verifySignature(req)) {
    console.warn("❌ Signature verification failed");
    return res.sendStatus(401);
  }
  console.log("🔐 Signature verified");

  const body = req.body;
  const value = body?.entry?.[0]?.changes?.[0]?.value;
  if (!value) {
    console.log("⚠ Invalid webhook structure");
    return res.sendStatus(200);
  }

  // --------------- MESSAGE EVENTS ---------------
  if (value.messages) {
    const msg = value.messages[0];

    console.log("\n📩 Received MESSAGE event:");
    console.log(JSON.stringify(msg, null, 2));

    // Deduplication
    if (processedMessageIds.has(msg.id)) {
      console.log("⏭ Skipping duplicate message:", msg.id);
      return res.sendStatus(200);
    }
    processedMessageIds.add(msg.id);

    try {
      await axios.post(N8N_URL, body, {
        headers: { "Content-Type": "application/json" }
      });

      console.log("➡ Forwarded message to n8n");
      return res.sendStatus(200);
    } catch (err) {
      console.error("❌ Error forwarding message:", err.message);
      return res.sendStatus(500);
    }
  }

  // --------------- STATUS EVENTS ---------------
  if (value.statuses) {
    const status = value.statuses[0];

    console.log("\n📨 Received STATUS event:");
    console.log(JSON.stringify(status, null, 2));

    // Deduplication
    if (processedStatusIds.has(status.id)) {
      console.log("⏭ Skipping duplicate status:", status.id);
      return res.sendStatus(200);
    }
    processedStatusIds.add(status.id);

    // Retry protection: WA may resend up to 3 times
    console.log("🛑 Ignoring status event (not forwarded to n8n)");
    return res.sendStatus(200);
  }

  // Unknown event
  console.log("🤷 Received unknown event type, ignoring.");
  return res.sendStatus(200);
});

// Root
app.get("/", (req, res) => {
  res.send("Meta Verification Server Running with Logging + Security");
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Server running on port " + PORT));
