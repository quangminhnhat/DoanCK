if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}




//lib import
const express = require("express");
const app = express();
const path = require("path");
const bcrypt = require("bcrypt");
const sql = require("msnodesqlv8");
const passport = require("passport");
const flash = require("express-flash");
const session = require("express-session");
const methodOverride = require("method-override");






app.use(express.urlencoded({ extended: false }));
const connectionString =
  "Driver={ODBC Driver 17 for SQL Server};Server=DESKTOP-ILINDAV\\SQLEXPRESS;Database=DOANCS;Trusted_Connection=Yes;";
app.use(flash());
app.use(
  session({
    secret: process.env.SECRET_KEY,
    resave: false,
    saveUninitialized: false,
  })
);
const initalizePassport = require("./pass-config");
initalizePassport(passport, email => {
  // Replace with your user retrieval logic
  const query = ` SELECT u.*
      FROM users u
      LEFT JOIN students s ON u.id = s.user_id
      LEFT JOIN teachers t ON u.id = t.user_id
      WHERE s.email = ? OR t.email = ?
    `;
  return new Promise((resolve, reject) => {
    sql.query(connectionString, query, [email, email], (err, rows) => {
      if (err) {
        console.error("SQL error:", err);
        return reject(err);
      }
      if (rows.length > 0) {
        resolve(rows[0]);
      } else {
        resolve(null);
      }
    });
  });
}, (id => {
  const query = `SELECT * FROM users WHERE id = ?`;
  return new Promise((resolve, reject) => {
    sql.query(connectionString, query, [id], (err, rows) => {
      if (err) {
        console.error("SQL error:", err);
        return reject(err);
      }
      if (rows.length > 0) {
        resolve(rows[0]);
      } else {
        resolve(null);
      }
    });
  });
}));




app.use(passport.initialize());
app.use(passport.session());
app.use(methodOverride("_method"));


app.post(
  "/login", checkNotAuthenticated,
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login",
    failureFlash: true,
  })
);
/*app.post("/login", async (req, res) => {
  try {
    sql.query(
      connectionString,
      "SELECT * FROM users WHERE username = ?",
      [req.body.Name],
      (err, result) => {
        if (err) {
          console.error("Query error:", err);
          return res.status(500).send("Database query error");
        }
        if (result.length === 0) {
          return res.status(401).send("Invalid username or password");
        }

        const user = result[0];
        bcrypt.compare(req.body.password, user.password, (err, isMatch) => {
          if (err) {
            console.error("Password comparison error:", err);
            return res.status(500).send("Password comparison error");
          }
          if (!isMatch) {
            res.redirect("/login"); // Redirect to login page if password is incorrect
          }
          // Successful login
          res.redirect("/"); // Redirect to home page after successful login
        });
      }
    );
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).send("An unexpected error occurred");
  }


});*/








const mapRole = {
  subject1: "student",
  subject2: "teacher",
  subject3: "admin",
};



app.post("/register", checkNotAuthenticated, async (req, res) => {
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
      const values = [
        username,
        hashpassword,
        role,
        username,
        email,
        phone,
        address,
        birth,
        username,
      ];

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
      const values = [
        username,
        hashpassword,
        role,
        username,
        email,
        phone,
        address,
        birth,
        salary,
        username,
      ];

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
app.set("view engine", "ejs");

//routing
app.get("/", (req, res) => {
  res.render("index.ejs",{user : req.user});
});
app.get("/login", checkNotAuthenticated, (req, res) => {
  res.render("login.ejs");
});
app.get("/register", checkNotAuthenticated, (req, res) => {
  res.render("register.ejs");
});
//route end

app.use(express.static(path.join(__dirname, "public")));


/*app.get("link ở đây", (req, res) => {
  res.render("view ở đây ");
});*/







app.delete("/logout", (req, res) => {
  req.logOut((err) => {
    if (err) {
      console.error("Error during logout:", err);
      return res.status(500).send("Logout error");
    }
    res.redirect("/login");
  });
});











function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/login");
}

function checkNotAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect("/");
  }
  next();
}





app.listen(3000);
