//lib import
const express = require("express");
const app = express(); 
const path = require("path");
//routing
app.get("/", (req, res) => {
  res.render("index.ejs");
});
app.get("/login", (req, res) => {
  res.render("login.ejs");
});
app.get("/register", (req, res) => {
  res.render("register.ejs");
});
//route end

app.use(express.static(path.join(__dirname, 'public')));
app.listen(3000);
