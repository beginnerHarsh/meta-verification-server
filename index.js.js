import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

// Your existing verification token
const VERIFY_TOKEN = "verify_token_123";

// 1. Meta Webhook Verification (GET)
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified!");
    return res.status(200).send(challenge);
  } else {
    return res.sendStatus(403);
  }
});

// 2. Handle WhatsApp POST events & forward to n8n
app.post("/webhook", async (req, res) => {
  console.log("Incoming WhatsApp message:", JSON.stringify(req.body, null, 2));

  try {
    await axios.post(
      "https://harshkumar7017.app.n8n.cloud/webhook/whatsapp-incoming",
      req.body,
      {
        headers: { "Content-Type": "application/json" }
      }
    );

    res.sendStatus(200);
  } catch (error) {
    console.error("Error forwarding to n8n:", error.message);
    res.sendStatus(500);
  }
});

// Root
app.get("/", (req, res) => {
  res.send("Meta Verification Server Running");
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));

