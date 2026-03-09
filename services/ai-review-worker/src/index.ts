import express from "express";

const app = express();

app.use(express.json());

app.post("/review", (req, res) => {
  console.log("Review request received");
  res.sendStatus(200);
});

app.listen(4001, () => {
  console.log("AI Review Worker running");
});
