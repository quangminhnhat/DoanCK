if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}
require("events").EventEmitter.defaultMaxListeners = 20;

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
const { authenticateRole } = require("./middleware/roleAuth");
const multer = require("multer");
const fs = require("fs");
const connectionString = process.env.CONNECTION_STRING;
const upload = require("./middleware/upload");
const courseImageUpload = require("./middleware/courseImageUpload");
const executeQuery = require("./middleware/executeQuery");
const {
  checkAuthenticated,
  checkNotAuthenticated,
} = require("./middleware/auth");
const validateSchedule = require("./middleware/validateSchedule");

// Static files
app.use(express.static(path.join(__dirname, "public")));

//routes
const materialRoutes = require("./routes/materialRoutes");
const notificationRoutes = require("./routes/notificationsroutes");
const materialsRoutes = require("./routes/materialsroute");
const userRoutes = require("./routes/usersRoutes");
const courseRoutes = require("./routes/coursesRoutes");
const uploadmaterialRoutes = require("./routes/upload-materialRoutes");
const scheduleRoutes = require("./routes/scheduleRoutes");
const classesRoutes = require("./routes/classesRoutes");
const enrollmentsRoutes = require("./routes/enrollmentsRoutes");
const miscroutes = require("./routes/MiscRoute");

// Essential middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(methodOverride("_method"));

// Session setup
app.use(flash());
app.use(
  session({
    secret: process.env.SECRET_KEY,
    resave: false,
    saveUninitialized: false,
  })
);

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

const initalizePassport = require("./middleware/pass-config");
initalizePassport(
  passport,
  (email) => {
    console.log("Looking up user by email:", email);
    // Query modified to include admin emails and join with role-specific tables
    const query = ` 
      SELECT u.*, COALESCE(s.email, t.email, a.email) as email
      FROM users u
      LEFT JOIN students s ON u.id = s.user_id
      LEFT JOIN teachers t ON u.id = t.user_id
      LEFT JOIN admins a ON u.id = a.user_id
      WHERE s.email = ? OR t.email = ? OR a.email = ?
    `;
    return new Promise((resolve, reject) => {
      sql.query(connectionString, query, [email, email, email], (err, rows) => {
        if (err) {
          console.error("SQL error:", err);
          return reject(new Error(err));
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
          return reject(new Error(err));
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

// Add this near the top of server.js

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

//routing
app.use(materialRoutes);
app.use(notificationRoutes);
app.use(materialsRoutes);
app.use(userRoutes);
app.use(courseRoutes);
app.use(uploadmaterialRoutes);
app.use(scheduleRoutes);
app.use(classesRoutes);
app.use(enrollmentsRoutes);
app.use(miscroutes);

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

app.get("/login", checkNotAuthenticated, (req, res) => {
  res.render("login.ejs");
});
app.get(
  "/register",
  checkAuthenticated,
  authenticateRole("admin"),
  (req, res) => {
    res.render("register.ejs", {
      user: req.user,
    });
  }
);

app.post(
  "/register",
  checkAuthenticated,
  authenticateRole("admin"),
  async (req, res) => {
    // Avoid sending multiple responses
    let hasResponded = false;
    const sendResponse = (statusCode, message) => {
      if (!hasResponded) {
        hasResponded = true;
        if (statusCode === 200) {
          return res.redirect("/login");
        }
        res.status(statusCode).send(message);
      }
    };

    try {
      console.log("Hitting registration endpoint with body:", req.body);
      const {
        Name: username,
        email,
        birthday: birth,
        phone,
        Address: address,
        subject,
        salary,
        Password,
      } = req.body;

      if (
        !username ||
        !email ||
        !birth ||
        !phone ||
        !address ||
        !subject ||
        !Password
      ) {
        console.log("Missing required fields:", {
          username,
          email,
          birth,
          phone,
          address,
          subject,
        });
        return sendResponse(400, "All fields are required");
      }

      console.log("Processing registration for:", email);
      const hashpassword = await bcrypt.hash(Password, 10);
      const role = mapRole[subject];

      if (!role) {
        console.log("Invalid subject:", subject);
        return sendResponse(400, "Invalid subject selection");
      }

      const handleSqlError = (err) => {
        console.error("Insert error:", err);
        if (err.code === "ER_DUP_ENTRY") {
          return sendResponse(400, "Email or username already exists");
        }
        if (err.code === "ER_NO_REFERENCED_ROW") {
          return sendResponse(400, "Invalid reference data");
        }
        return sendResponse(
          500,
          "Registration failed. Please try again later."
        );
      };

      if (role === "student") {
        const insertQuery = `
        BEGIN TRANSACTION;
        INSERT INTO users (username, password, role, created_at, updated_at) 
        VALUES (?, ?, ?, GETDATE(), GETDATE());
        
        DECLARE @NewUserId INT;
        SET @NewUserId = SCOPE_IDENTITY();
        
        INSERT INTO students (user_id, full_name, email, phone_number, address, date_of_birth, created_at, updated_at)
        VALUES (@NewUserId, ?, ?, ?, ?, ?, GETDATE(), GETDATE());
        
        COMMIT TRANSACTION;
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
        ];

        sql.query(connectionString, insertQuery, values, (err, result) => {
          if (err) return handleSqlError(err);
          console.log("Student registered:", result);
          return sendResponse(200, "Registration successful");
        });
      } else if (role === "teacher") {
        const insertQuery = `
        BEGIN TRANSACTION;
        INSERT INTO users (username, password, role, created_at, updated_at) 
        VALUES (?, ?, ?, GETDATE(), GETDATE());
        
        DECLARE @NewUserId INT;
        SET @NewUserId = SCOPE_IDENTITY();
        
        INSERT INTO teachers (user_id, full_name, email, phone_number, address, date_of_birth, salary, created_at, updated_at)
        VALUES (@NewUserId, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE());
        
        COMMIT TRANSACTION;
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
        ];

        sql.query(connectionString, insertQuery, values, (err, result) => {
          if (err) return handleSqlError(err);
          console.log("Teacher registered:", result);
          return sendResponse(200, "Registration successful");
        });
      } else if (role === "admin") {
        const insertQuery = `
        BEGIN TRANSACTION;
        INSERT INTO users (username, password, role, created_at, updated_at) 
        VALUES (?, ?, ?, GETDATE(), GETDATE());
        
        DECLARE @NewUserId INT;
        SET @NewUserId = SCOPE_IDENTITY();
        
        INSERT INTO admins (user_id, full_name, email, phone_number, created_at, updated_at)
        VALUES (@NewUserId, ?, ?, ?, GETDATE(), GETDATE());
        
        COMMIT TRANSACTION;
      `;
        const values = [username, hashpassword, role, username, email, phone];

        sql.query(connectionString, insertQuery, values, (err, result) => {
          if (err) return handleSqlError(err);
          console.log("Admin registered:", result);
          return sendResponse(200, "Registration successful");
        });
      }
    } catch (error) {
      if (error.code === "ERR_HTTP_HEADERS_SENT") {
        console.log("Headers already sent, response already handled");
        return;
      }

      console.error("Error during registration:", error);
      return sendResponse(500, "Registration failed. Please try again later.");
    }
  }
);

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
    res.redirect("/");
  });
});

app.get("/GiaoTiepClass", (req, res) => {
  res.render("GiaoTiepClass.ejs", { user: req.user });
});
app.get("/Toan,Ly,Hoaclass", (req, res) => {
  res.render("Toan,Ly,Hoaclass.ejs", { user: req.user });
});
app.get("/AnhVanClass", (req, res) => {
  res.render("AnhVanClass.ejs", { user: req.user });
});
app.get("/VanClass", (req, res) => {
  res.render("VanClass.ejs", { user: req.user });
});
app.get("/ToanClass", (req, res) => {
  res.render("ToanClass.ejs", { user: req.user });
});
app.get("/LyClass", (req, res) => {
  res.render("LyClass.ejs", { user: req.user });
});
app.get("/HoaClass", (req, res) => {
  res.render("HoaClass.ejs", { user: req.user });
});
app.get("/SuClass", (req, res) => {
  res.render("SuClass.ejs", { user: req.user });
});

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

//route end

app.listen(3000, () => {
  console.log("Server is online at http://localhost:3000");
});

// Configure connection pool
const pool = {
  max: 10, // Maximum number of connections
  min: 0, // Minimum number of connections
  idleTimeoutMillis: 30000, // How long a connection can be idle before being released
};

// Test database connection on startup
async function testConnection() {
  try {
    await executeQuery("SELECT 1");
    console.log("Database connection successful");
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exit(1); // Exit if we can't connect to database
  }
}

testConnection();

// Add error handler middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);

  if (err.code === "ECONNREFUSED") {
    return res.status(503).json({
      error: "Database connection failed",
      details: "Unable to connect to database server",
    });
  }

  if (err.code === "PROTOCOL_CONNECTION_LOST") {
    return res.status(503).json({
      error: "Database connection lost",
      details: "Connection to database was lost",
    });
  }

  res.status(500).json({
    error: "Internal server error",
    details: err.message,
  });
});
