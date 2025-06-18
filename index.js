require("dotenv").config();
const express = require("express");
const path = require("path");
const { connectWhatsApp } = require("./src/services/whatsappService");
const apiRoutes = require("./src/routes/api");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.get("/", (req, res) => {
  res.render("index");
});

app.use("/api", apiRoutes);

app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);

 
  connectWhatsApp();
});
