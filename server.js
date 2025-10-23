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
const requestRoute = require("./routes/requestRoute");

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
    // Lookup directly on users.email (students/teachers/admins don't have an email column)
    const query = `
      SELECT u.*
      FROM users u
      WHERE u.email = ?
    `;
    return new Promise((resolve, reject) => {
      sql.query(connectionString, query, [email], (err, rows) => {
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
app.use(requestRoute);

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



app.get("/login", checkNotAuthenticated, (req, res) => {
  res.render("login.ejs");
});


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
