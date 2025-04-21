//lib import
const express = require("express");
const app = express();
const path = require("path");
const bcrypt = require("bcrypt");
const sql = require("msnodesqlv8");
const connectionString =
  "Driver={ODBC Driver 17 for SQL Server};Server=DESKTOP-ILINDAV\\SQLEXPRESS;Database=DOANCS;Trusted_Connection=Yes;";

const mapRole = {
  subject1: "student",
  subject2: "teacher",
  subject3: "admin",
};

app.use(express.urlencoded({ extended: false }));

app.post("/register", async (req, res) => {
  try {
    const hashpassword = await bcrypt.hash(req.body.Password, 10);
    const username = req.body.Name;
    const email = req.body.email;
    const birth = req.body.birthday;
    const phone = req.body.phone;
    const address = req.body.Address;
    const subject = req.body.subject;
    const salary = req.body.salary;

    // Map role
    const role = mapRole[subject];

    if (!username) {
      return res.status(400).send("Username is required");
    }
    if (!email) {
      return res.status(400).send("Email is required");
    }
    if (!phone) {
      return res.status(400).send("Phone number is required");
    }
    if (!address) {
      return res.status(400).send("Address is required");
    }
    if (!birth) {
      return res.status(400).send("Date of birth is required");
    }
    if (role === "teacher" && !salary) {
      return res.status(400).send("Salary is required for teachers");
    }

    res.redirect("/login");
    /* const insertQuery = `
      INSERT INTO users (username, password, role, email, name, gender, birthday, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE());
    `;

    const values = [username, hashpassword, role, email, gender, birth];

    sql.query(connectionString, insertQuery, values, (err, result) => {
      if (err) {
        console.error("Insert error:", err);
        res.status(500).send("Database insert error");
      } else {
        console.log("User registered:", result);
        res.send("Registration successful!");
      }
    });

const insertQueryUser = `INSERT INTO users (username, password, role, created_at, updated_at) VALUES (?, ?, ?, GETDATE(), GETDATE());`;
const valuesUser = [username, hashpassword, role];*/

    if (role === "student") {
      const insertQuery = `INSERT INTO users (username, password, role, created_at, updated_at) VALUES (?, ?, ?, GETDATE(), GETDATE());
       INSERT INTO students (user_id, full_name, email, phone_number, address, date_of_birth, created_at, updated_at)
        SELECT id, ?, ?, ?, ?, ?, GETDATE(), GETDATE()
        FROM users
        WHERE username = ?;
      `;
      const values = [username, hashpassword, role, username, email, phone, address, birth, username];


      sql.query(connectionString, insertQuery, values, (err, result) => {
        if (err) {
          console.error("Insert error:", err);
          return res.status(500).send("Database insert error");
        }
        console.log("User registered:", result);       
      });

    } else if (role === "teacher") {
      const insertQuery = `INSERT INTO users (username, password, role, created_at, updated_at) VALUES (?, ?, ?, GETDATE(), GETDATE());
      INSERT INTO teachers (user_id, full_name, email, phone_number, address, date_of_birth, salary, created_at, updated_at)
        SELECT id, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE()
        FROM users
        WHERE username = ?;
      `;
      const values = [username, hashpassword, role,username, email, phone, address, birth, salary, username];



      sql.query(connectionString, insertQuery, values, (err, result) => {
        if (err) {
          console.error("Insert error:", err);
          return res.status(500).send("Database insert error");
        }
        console.log("User registered:", result);

      });
    } else {
      const insertQuery = `INSERT INTO users (username, password, role, created_at, updated_at) VALUES (?, ?, ?, GETDATE(), GETDATE());`;
      const values = [username, hashpassword, role];
      sql.query(connectionString, insertQuery, values, (err, result) => {
        if (err) {
          console.error("Insert error:", err);
          res.status(500).send("Database insert error");
        } else {
          console.log("User registered:", result);
        }
      });
    }
  } catch (error) {
    console.error("Error during registration:", error);
    res.redirect("/register");
  }
});


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

app.use(express.static(path.join(__dirname, "public")));
app.listen(3000);
