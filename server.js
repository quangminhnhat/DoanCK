//lib import
const express = require("express");
const app = express(); 
const path = require("path");
const bcrypt = require("bcrypt");
const sql = require("msnodesqlv8");
const connectionString =
  "Driver={ODBC Driver 17 for SQL Server};Server=DESKTOP-ILINDAV\\SQLEXPRESS;Database=DOANCS;Trusted_Connection=Yes;";



/*



//sql query
sql.query(connectionString, `SELECT * FROM users;`, (err, rows) => {
  user = rows;
});*/




app.use(express.urlencoded({ extended: false  }));


app.post("/register", async(req, res) => {
try {
 const hashpassword = await bcrypt.hash(req.body.Password, 10);
 const username = req.body.Username;
 const name = req.body.Name;
 const email = req.body.Email;
 const birth = req.body.birthday;
 if(req.body.femaleGender == )
} catch  {
}});

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
