import express from "express";
const app = express();

const VERIFY_TOKEN = "verify_token_123";   // <-- Your token

// Meta Webhook Verification (GET)
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

// Keep-alive root
app.get("/", (req, res) => res.send("Meta Verification Server Running"));

app.listen(3000, () => console.log("Server running on port 3000"));
