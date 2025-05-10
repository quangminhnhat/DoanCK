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
const multer = require("multer");
const fs = require("fs");

//require ("./schedular")

app.use(express.json());
//app.use("/materials", materialsRouter);

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
app.set("view engine", "ejs");
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const uploadFolder = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadFolder)) {
  fs.mkdirSync(uploadFolder);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadFolder);
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

//routing

app.post(
  "/upload-material",
  checkAuthenticated,
  (req, res, next) => {
    if (req.user.role !== "teacher" && req.user.role !== "admin") {
      return res.status(403).send("Only teachers and admins can upload materials.");
    }
    next();
  },
  upload.single("material"),
  (req, res) => {
    const { course_id } = req.body;
    const file = req.file;

    if (!course_id || !file) {
      return res.status(400).send("Missing course_id or file.");
    }

    const insertQuery = `
    INSERT INTO materials (course_id, file_name, file_path, mime_type)
    VALUES (?, ?, ?, ?)
  `;

    const values = [
      course_id,
      file.originalname,
      path.join("uploads", file.filename),
      file.mimetype,
    ];

    sql.query(connectionString, insertQuery, values, (err) => {
      if (err) {
        console.error("Insert material error:", err);
        return res.status(500).send("Database insert error");
      }
      console.log("Material uploaded successfully.");
      res.send("File uploaded and saved to database.");
    });
  }
);

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

app.post("/notifications", checkAuthenticated, (req, res) => {
  const { userId, message } = req.body;
  const senderRole = req.user.role;

  // Only allow staff to send notifications
  if (senderRole !== "admin" && senderRole !== "teacher") {
    return res.status(403).send("Only staff can send notifications.");
  }

  if (!userId || !message) {
    return res.status(400).send("User ID and message are required.");
  }

  const insertQuery = `
    INSERT INTO notifications (user_id, message)
    VALUES (?, ?);
  `;

  sql.query(connectionString, insertQuery, [userId, message], (err) => {
    if (err) {
      console.error("Insert notification error:", err);
      return res.status(500).send("Database insert error");
    }

    console.log("Notification sent to user ID:", userId);
    res.status(201).send("Notification sent successfully!");
  });
});

app.post("/courses", checkAuthenticated, (req, res) => {
  const { course_name, description, start_date, end_date } = req.body;
  const role = req.user.role;

  // Only staff can add courses
  if (role !== "admin" && role !== "teacher") {
    return res.status(403).send("Unauthorized access");
  }

  if (!course_name || !start_date || !end_date) {
    return res.status(400).send("Missing required fields");
  }

  const insertQuery = `
    INSERT INTO courses (course_name, description, start_date, end_date)
    VALUES (?, ?, ?, ?)
  `;

  sql.query(
    connectionString,
    insertQuery,
    [course_name, description, start_date, end_date],
    (err, result) => {
      if (err) {
        console.error("Insert course error:", err);
        return res.status(500).send("Database error");
      }
      console.log("Course added:", result);
      res.redirect("/courses"); // or res.send() if not using a view
    }
  );
});

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

app.get("/", (req, res) => {
  res.render("index.ejs", { user: req.user });
});
app.get("/login", checkNotAuthenticated, (req, res) => {
  res.render("login.ejs");
});
app.get("/register", checkNotAuthenticated, (req, res) => {
  res.render("register.ejs");
});
app.get("/notifications", checkAuthenticated, (req, res) => {
  res.render("notifications.ejs", { user: req.user });
});
app.get("/courses/new", checkAuthenticated, (req, res) => {
  if (req.user.role !== "admin" && req.user.role !== "teacher") {
    return res.status(403).send("Unauthorized access");
  }
  res.render("addCourse.ejs");
});
app.get("/courses", checkAuthenticated, (req, res) => {
  const query = "SELECT * FROM courses ORDER BY start_date DESC";
  sql.query(connectionString, query, (err, rows) => {
    if (err) {
      console.error("Fetch courses error:", err);
      return res.status(500).send("Database error");
    }
    res.render("courses.ejs", { courses: rows, user: req.user });
  });
});

app.get("/courses/:id/edit", checkAuthenticated, (req, res) => {
  const courseId = req.params.id;
  const query = "SELECT * FROM courses WHERE id = ?";
  sql.query(connectionString, query, [courseId], (err, result) => {
    if (err) {
      console.error("Edit fetch error:", err);
      return res.status(500).send("Database error");
    }
    if (result.length === 0) return res.status(404).send("Course not found");
    res.render("editCourse", { course: result[0] });
  });
});
app.post("/courses/:id", checkAuthenticated, (req, res) => {
  const { course_name, description, start_date, end_date } = req.body;
  const role = req.user.role;

  // Check authorization first
  if (role !== "admin" && role !== "teacher") {
    return res.status(403).send("Unauthorized access");
  }

  // Validate input
  if (!course_name || !start_date || !end_date) {
    return res.status(400).send("Missing required fields");
  }

  const query = `
    UPDATE courses 
    SET course_name = ?, 
        description = ?, 
        start_date = ?, 
        end_date = ?, 
        updated_at = GETDATE()
    WHERE id = ?
  `;

  const values = [
    course_name,
    description,
    start_date,
    end_date,
    req.params.id,
  ];

  // Execute query with proper error handling
  sql.query(connectionString, query, values, (err, result) => {
    try {
      if (err) {
        console.error("Update error:", err);
        return res.status(500).send("Update failed");
      }
      if (!result || result.rowsAffected === 0) {
        return res.status(404).send("Course not found");
      }
      res.redirect("/courses");
    } catch (error) {
      // Ignore headers already sent error
      if (error.code !== "ERR_HTTP_HEADERS_SENT") {
        console.error("Unhandled error:", error);
      }
    }
  });
});

app.delete("/courses/:id", checkAuthenticated, (req, res) => {
  const query = "DELETE FROM courses WHERE id = ?";
  sql.query(connectionString, query, [req.params.id], (err) => {
    if (err) {
      console.error("Delete error:", err);
      return res.status(500).send("Delete failed");
    }
    res.redirect("/courses");
  });
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

app.post(
  "/upload-material",
  checkAuthenticated,
  upload.single("material"),
  (req, res) => {
    const { course_id } = req.body;
    const file = req.file;

    if (!course_id || !file) {
      return res.status(400).send("Missing course_id or file.");
    }

    const insertQuery = `
    INSERT INTO materials (course_id, file_name, file_path, mime_type)
    VALUES (?, ?, ?, ?)
  `;

    const values = [
      course_id,
      file.originalname,
      path.join("uploads", file.filename),
      file.mimetype,
    ];

    sql.query(connectionString, insertQuery, values, (err) => {
      if (err) {
        console.error("Insert material error:", err);
        return res.status(500).send("Database insert error");
      }
      console.log("Material uploaded successfully.");
      res.send("File uploaded and saved to database.");
    });
  }
);

//you gonna need to redo this part
app.get("/schedule", checkAuthenticated, (req, res) => {
  // 1. Determine the Monday of the week
  let monday;
  if (req.query.weekStart) {
    monday = new Date(req.query.weekStart);
  } else {
    const today = new Date();
    const offset = (today.getDay() + 6) % 7; // Mon = 0
    monday = new Date(today);
    monday.setDate(today.getDate() - offset);
  }

  // 2. Build days and periods
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

  // 3. SQL query for schedule in week
  const userId = req.user.id;
  const role = req.user.role;
  const startOfWeek = days[0].iso;
  const endOfWeek = days[6].iso;

  let query, params;
  if (role === "student") {
    query = `
      SELECT s.schedule_date, s.start_time,
             c.class_name, t.full_name AS teacher
      FROM students st
      JOIN enrollments e ON st.id = e.student_id
      JOIN classes c     ON e.class_id = c.id
      JOIN schedules s   ON c.id = s.class_id
      JOIN teachers t    ON c.teacher_id = t.id
      WHERE st.user_id = ?
        AND s.schedule_date BETWEEN ? AND ?
    `;
    params = [userId, startOfWeek, endOfWeek];
  } else if (role === "teacher") {
    query = `
      SELECT s.schedule_date, s.start_time,
             c.class_name, NULL AS teacher
      FROM teachers t
      JOIN classes c    ON t.id = c.teacher_id
      JOIN schedules s  ON c.id = s.class_id
      WHERE t.user_id = ?
        AND s.schedule_date BETWEEN ? AND ?
    `;
    params = [userId, startOfWeek, endOfWeek];
  } else {
    return res.status(403).send("Unauthorized role");
  }

  console.log("Role:", role, "UserId:", userId);
  console.log("Date Range:", startOfWeek, "→", endOfWeek);

  sql.query(connectionString, query, params, (err, rows) => {
    if (err) {
      console.error("SQL Error:", err);
      return res.status(500).send("Database error");
    }

    const timeToPeriod = {
      "07:00:00": 0,
      "08:00:00": 1,
      "09:00:00": 2,
      "10:00:00": 3,
      "11:00:00": 4,
      "12:00:00": 5,
      "13:00:00": 6,
      "14:00:00": 7,
      "15:00:00": 8,
      "16:00:00": 9,
      "17:00:00": 10,
      "18:00:00": 11,
      "19:00:00": 12,
      "20:00:00": 13,
      "21:00:00": 14,
    };

    const scheduleData = rows.map((r) => {
      const isoDate = r.schedule_date.toISOString().slice(0, 10);
      const dayObj = days.find((d) => d.iso === isoDate);

      const timeStr = r.start_time.toTimeString().slice(0, 8); 
      const periodIndex = timeToPeriod[timeStr]; 

      return {
        date: isoDate, 
        periodIndex,
        className: r.class_name,
        teacher: r.teacher || "",
      };
    });
    console.log("Schedule data:", scheduleData);

    const maxPeriod = scheduleData.length
      ? Math.max(...scheduleData.map((s) => s.periodIndex))
      : 0;

    // 4. Prev/Next week
    const prevWeekStart = new Date(monday);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const nextWeekStart = new Date(monday);
    nextWeekStart.setDate(nextWeekStart.getDate() + 7);

    // 5. Render
    res.render("schedule", {
      user: req.user,
      days,
      periods,
      scheduleData,
      weekStart: monday.toISOString().slice(0, 10),
      prevWeekStart: prevWeekStart.toISOString().slice(0, 10),
      nextWeekStart: nextWeekStart.toISOString().slice(0, 10),
      maxPeriod,
    });
  });
});

app.get("/upload", checkAuthenticated, (req, res) => {
  res.render("uploadMaterial.ejs");
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
