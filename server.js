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
const { authenticateRole } = require("./roleAuth");
//require ("./schedular")

app.use(express.urlencoded({ extended: false }));
const connectionString =
  "Driver={ODBC Driver 17 for SQL Server};Server=LAPTOP-ND7KAD0J;Database=DOANCS;Trusted_Connection=Yes;";
app.use(flash());
app.use(
  session({
    secret: process.env.SECRET_KEY,
    resave: false,
    saveUninitialized: false,
  })
);
const initalizePassport = require("./pass-config");
initalizePassport(
  passport,
  (email) => {
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
  },
  (id) => {
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
  }
);

app.use(passport.initialize());
app.use(passport.session());
app.use(methodOverride("_method"));

app.post(
  "/login",
  checkNotAuthenticated,
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
    res.redirect("/login");
  } catch (error) {
    console.error("Error during registration:", error);
    res.redirect("/register");
  }
});
app.set("view engine", "ejs");

//routing
app.get("/", (req, res) => {
  res.render("index.ejs", { user: req.user });
});
app.get("/login", checkNotAuthenticated, (req, res) => {
  res.render("login.ejs");
});
app.get("/register", checkNotAuthenticated, (req, res) => {
  res.render("register.ejs");
});

app.use(express.static(path.join(__dirname, "public")));

/*
link bình thường
app.get("link ở đây", (req, res) => {
  res.render("view ở đây ");
});
*/

/*
link role
app.get("/admin", checkAuthenticated, authenticateRole("admin"), (req, res) => {
  res.render("admin.ejs", { user: req.user });
});
*/
app.delete("/logout", (req, res) => {
  req.logOut((err) => {
    if (err) {
      console.error("Error during logout:", err);
      return res.status(500).send("Logout error");
    }
    res.redirect("/login");
  });
});

app.get("/schedule", checkAuthenticated, (req, res) => {
  // 1. Determine the Monday to show
  let monday;
  if (req.query.weekStart) {
    monday = new Date(req.query.weekStart);
  } else {
    const today = new Date();
    const offset = (today.getDay() + 6) % 7; // Mon=0, …, Sun=6
    monday = new Date(today);
    monday.setDate(today.getDate() - offset);
  }

  // 2. Build days (Mon→Sun) and periods (Tiết 1→15)
  const fmt = (d) =>
    d.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  const names = [
    "Thứ 2",
    "Thứ 3",
    "Thứ 4",
    "Thứ 5",
    "Thứ 6",
    "Thứ 7",
    "Chủ nhật",
  ];
  const days = Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(monday);
    dt.setDate(monday.getDate() + i);
    return {
      name: names[i],
      date: fmt(dt),
      iso: dt.toISOString().slice(0, 10),
    };
  });
  const periods = Array.from({ length: 15 }, (_, i) => `Tiết ${i + 1}`);

  // 3. SQL query only for those days
  const userId = req.user.id;
  const role = req.user.role;
  const placeholders = days.map(() => "?").join(",");
  let query, params;

  if (role === "student") {
    query = `
      SELECT s.day_of_week AS day, s.start_time,
             c.class_name, t.full_name AS teacher
      FROM students st
      JOIN enrollments e   ON st.id = e.student_id
      JOIN classes c       ON e.class_id = c.id
      JOIN schedules s     ON c.id = s.class_id
      JOIN teachers t      ON c.teacher_id = t.id
      WHERE st.user_id = ?
        AND s.day_of_week IN (${placeholders})
    `;
    params = [userId, ...days.map((d) => d.name)];
  } else if (role === "teacher") {
    query = `
      SELECT s.day_of_week AS day, s.start_time,
             c.class_name, NULL AS teacher
      FROM teachers t2
      JOIN classes c    ON t2.id = c.teacher_id
      JOIN schedules s  ON c.id = s.class_id
      WHERE t2.user_id = ?
        AND s.day_of_week IN (${placeholders})
    `;
    params = [userId, ...days.map((d) => d.name)];
  } else {
    return res.status(403).send("Unauthorized role");
  }

  sql.query(connectionString, query, params, (err, rows) => {
    if (err) {
      console.error("Schedule fetch error:", err);
      return res.status(500).send("Failed to load schedule");
    }

    // 4. Map start_time → periodIndex (07:00→0, 08:00→1, …)
    const scheduleData = rows.map((r) => {
      const hour = parseInt(r.start_time.split(":")[0], 10);
      return {
        day: r.day,
        periodIndex: hour - 7,
        className: r.class_name,
        teacher: r.teacher || "",
      };
    });

    // 5. Compute prev/next weekStart strings
    const prevMon = new Date(monday);
    prevMon.setDate(prevMon.getDate() - 7);
    const nextMon = new Date(monday);
    nextMon.setDate(nextMon.getDate() + 7);

    const prevWeekStart = prevMon.toISOString().slice(0, 10);
    const nextWeekStart = nextMon.toISOString().slice(0, 10);

    // 6. Render with all the locals you need
    // ✅ correct
    res.render("schedule", {
      user: req.user,
      days,
      periods,
      scheduleData,
      weekStart: monday.toISOString().slice(0, 10),
      prevWeekStart,
      nextWeekStart,
    });

  });
});


//route end

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
