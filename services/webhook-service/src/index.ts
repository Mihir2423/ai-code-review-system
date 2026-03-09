import express from "express";

const app = express();

app.use(express.json());

app.post("/webhook", (req, res) => {
  console.log("PR Event Received");
  res.sendStatus(200);
});

app.listen(4000, () => {
  console.log("Webhook service running");
});
