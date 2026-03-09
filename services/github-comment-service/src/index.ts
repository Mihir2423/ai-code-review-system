import express from "express";

const app = express();

app.use(express.json());

app.post("/comment", (req, res) => {
  console.log("Comment request received");
  res.sendStatus(200);
});

app.listen(4002, () => {
  console.log("GitHub Comment Service running");
});
