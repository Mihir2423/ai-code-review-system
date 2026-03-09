import express from "express";

const app = express();

app.use(express.json());

app.post("/process", (req, res) => {
  console.log("PR Process request received");
  res.sendStatus(200);
});

app.listen(4003, () => {
  console.log("PR Processor running");
});
