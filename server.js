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
// Static files
app.use(express.static(path.join(__dirname, "public")));

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

const connectionString =
  "Driver={ODBC Driver 17 for SQL Server};Server=DESKTOP-M7HENCK;Database=DOANCS;Trusted_Connection=Yes;";
const initalizePassport = require("./pass-config");
const { time } = require("console");
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
function executeQuery(query, params = []) {
  return new Promise((resolve, reject) => {
    sql.query(connectionString, query, params, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

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
  authenticateRole(["admin", "teacher"]),
  upload.single("material"),
  async (req, res) => {
    try {
      const { course_id } = req.body;
      const file = req.file;

      // Input validation
      if (!course_id || !file) {
        return res.status(400).json({
          error: "Missing required fields",
          details: {
            course_id: !course_id ? "Missing course ID" : null,
            file: !file ? "No file uploaded" : null,
          },
        });
      }

      // Verify course exists first
      const courseCheckQuery = "SELECT id FROM courses WHERE id = ?";
      const courseResult = await new Promise((resolve, reject) => {
        sql.query(
          connectionString,
          courseCheckQuery,
          [course_id],
          (err, result) => {
            if (err) reject(err);
            else resolve(result);
          }
        );
      });

      if (!courseResult || courseResult.length === 0) {
        return res.status(404).json({
          error: "Course not found",
          course_id,
        });
      }

      const insertQuery = `
        INSERT INTO materials (course_id, file_name, file_path, uploaded_at)
        VALUES (?, ?, ?, GETDATE())
      `;

      const values = [
        course_id,
        file.originalname,
        path.join("uploads", file.filename),
      ];

      await new Promise((resolve, reject) => {
        sql.query(connectionString, insertQuery, values, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });

      res.redirect("/materials");
    } catch (error) {
      console.error("Material upload error:", error);

      // Delete uploaded file if database insert fails
      if (req.file) {
        const filePath = path.join(__dirname, "uploads", req.file.filename);
        fs.unlink(filePath, (err) => {
          if (err) console.error("Error deleting file:", err);
        });
      }

      res.status(500).json({
        error: "Failed to upload material",
        details: error.message,
      });
    }
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

app.post(
  "/notifications",
  checkAuthenticated,
  authenticateRole(["admin", "teacher"]),
  (req, res) => {
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
      res.redirect("/notifications");
    });
  }
);

app.get(
  "/my-courses",
  checkAuthenticated,
  authenticateRole("student"),
  async (req, res) => {
    try {
      // Different queries based on user role
      let query;
      let params = [];

      query = `
        SELECT 
          c.course_name,
          c.description AS course_description,
          c.tuition_fee,
          t.full_name AS teacher_name,
          t.email AS teacher_email,
          t.phone_number AS teacher_phone,   
          c.start_date AS course_start,
          c.end_date AS course_end,
          cls.class_name,
          cls.start_time AS class_start_time,
          cls.end_time AS class_end_time,
          s.day_of_week,
          s.schedule_date,
          s.start_time AS schedule_start,
          s.end_time AS schedule_end
        FROM enrollments e
        JOIN students st ON e.student_id = st.id
        JOIN classes cls ON e.class_id = cls.id
        JOIN teachers t ON cls.teacher_id = t.id
        JOIN courses c ON cls.course_id = c.id
        LEFT JOIN schedules s ON cls.id = s.class_id
        WHERE st.user_id = ?
        ORDER BY t.full_name, c.course_name, s.schedule_date
      `;
      params = [req.user.id];
      const courses = await executeQuery(query, params);
      res.render("my-courses.ejs", {
        user: req.user,
        courses: courses,
      });
    } catch (error) {
      console.error("Error fetching courses:", error);
      res.status(500).send("Error loading courses");
    }
  }
);

app.get("/notifications", checkAuthenticated, async (req, res) => {
  try {
    // Get notifications based on user role
    let query;
    let params = [];

    if (req.user.role === "admin") {
      query = `
              SELECT n.*, 
                  COALESCE(s.full_name, t.full_name, a.full_name) as receiver_name,
                  sender.full_name as sender_name
              FROM notifications n
              LEFT JOIN students s ON n.user_id = s.user_id
              LEFT JOIN teachers t ON n.user_id = t.user_id
              LEFT JOIN admins a ON n.user_id = a.user_id
              LEFT JOIN admins sender ON n.sender_id = sender.user_id
              ORDER BY n.created_at DESC
          `;
    } else {
      query = `
              SELECT n.*, 
                  COALESCE(s.full_name, t.full_name, a.full_name) as sender_name
              FROM notifications n
              LEFT JOIN students s ON n.sender_id = s.user_id
              LEFT JOIN teachers t ON n.sender_id = t.user_id
              LEFT JOIN admins a ON n.sender_id = a.user_id
              WHERE n.user_id = ?
              ORDER BY n.created_at DESC
          `;
      params = [req.user.id];
    }

    const notifications = await executeQuery(query, params);

    // If admin/teacher, get list of users for sending notifications
    let users = [];
    if (req.user.role === "admin" || req.user.role === "teacher") {
      const userQuery = `
              SELECT u.id, COALESCE(s.full_name, t.full_name, a.full_name) as full_name
              FROM users u
              LEFT JOIN students s ON u.id = s.user_id
              LEFT JOIN teachers t ON u.id = t.user_id
              LEFT JOIN admins a ON u.id = a.user_id
          `;
      users = await executeQuery(userQuery);
    }

    res.render("notifications.ejs", {
      user: req.user,
      notifications: notifications,
      users: users,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).send("Error loading notifications");
  }
});

// Mark notification as read
app.post("/notifications/:id/read", checkAuthenticated, async (req, res) => {
  try {
    const query = `
            UPDATE notifications 
            SET [read] = 1, 
                updated_at = GETDATE()
            WHERE id = ? AND user_id = ?
        `;
    await executeQuery(query, [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ error: "Failed to update notification" });
  }
});

// Delete notification (admin only)
app.delete("/notifications/:id", checkAuthenticated, async (req, res) => {
  try {
    await executeQuery("DELETE FROM notifications WHERE id = ?", [
      req.params.id,
    ]);
    res.redirect("/notifications");
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).send("Failed to delete notification");
  }
});

app.get(
  "/materials",
  checkAuthenticated,
  authenticateRole(["admin", "teacher"]),
  (req, res) => {
    const query = `SELECT * FROM materials ORDER BY uploaded_at DESC`;

    sql.query(connectionString, query, (err, rows) => {
      if (err) {
        console.error("Fetch materials error:", err);
        return res.status(500).send("Database error");
      }
      res.render("materials.ejs", { materials: rows, user: req.user });
    });
  }
);

app.get(
  "/materials/:id/edit",
  checkAuthenticated,
  authenticateRole(["admin", "teacher"]),
  (req, res) => {
    const materialId = req.params.id;
    const query = `SELECT * FROM materials WHERE id = ?`;

    sql.query(connectionString, query, [materialId], (err, result) => {
      if (err) return res.status(500).send("Database error");
      if (result.length === 0)
        return res.status(404).send("Material not found");

      res.render("editMaterial.ejs", { material: result[0], user: req.user });
    });
  }
);

app.get("/users", checkAuthenticated, authenticateRole("admin"), (req, res) => {
  const query = `
    	SELECT u.id, u.username, u.role, u.created_at, u.updated_at,
       COALESCE(s.full_name, t.full_name, a.full_name) AS full_name,
       COALESCE(s.email, t.email, a.email) AS email,
       COALESCE(s.phone_number, t.phone_number, a.phone_number) AS phone
FROM users u
LEFT JOIN students s ON u.id = s.user_id
LEFT JOIN teachers t ON u.id = t.user_id
LEFT JOIN admins a   ON u.id = a.user_id
ORDER BY u.created_at DESC;
  `;

  sql.query(connectionString, query, (err, rows) => {
    if (err) return res.status(500).send("Database error");
    res.render("userList", { users: rows, user: req.user });
  });
});

app.get(
  "/users/:id/edit",
  checkAuthenticated,
  /*authenticateRole("admin"),*/
  (req, res) => {
    const userId = req.params.id;
    const query = "SELECT * FROM users WHERE id = ?";

    sql.query(connectionString, query, [userId], (err, rows) => {
      if (err || rows.length === 0)
        return res.status(500).send("User not found");
      res.render("editUser", { user: rows[0] });
    });
  }
);

app.get("/", (req, res) => {
  res.render("index.ejs", { user: req.user });
});

app.get("/school", (req, res) => {
  res.render("school.ejs", { user: req.user });
});

app.get("/news", (req, res) => {
  res.render("news.ejs", { user: req.user });
});

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

app.get("/notifications", checkAuthenticated, (req, res) => {
  res.render("notifications.ejs", { user: req.user });
});
app.get(
  "/courses/new",
  checkAuthenticated,
  authenticateRole("admin"),
  (req, res) => {
    res.render("addCourse.ejs", { user: req.user });
  }
);
app.get(
  "/courses",
  checkAuthenticated,
  authenticateRole(["admin", "teacher"]),
  (req, res) => {
    const query = `
    SELECT 
 c.course_name,
    c.description AS course_description,
    t.full_name AS teacher_name,
    t.email AS teacher_email,
    t.phone_number AS teacher_phone,   
    c.start_date AS course_start,
    c.end_date AS course_end,
    cls.class_name,
    cls.start_time AS class_start_time,
    cls.end_time AS class_end_time,
    s.day_of_week,
    s.schedule_date,
    s.start_time AS schedule_start,
    s.end_time AS schedule_end
FROM classes cls
JOIN teachers t ON cls.teacher_id = t.id
JOIN courses c ON cls.course_id = c.id
LEFT JOIN schedules s ON cls.id = s.class_id
ORDER BY t.full_name, c.course_name, s.schedule_date;
`;
    sql.query(connectionString, query, (err, rows) => {
      if (err) {
        console.error("Fetch courses error:", err);
        return res.status(500).send("Database error");
      }
      res.render("courses.ejs", { courses: rows, user: req.user });
    });
  }
);

app.get(
  "/courses/:id/edit",
  checkAuthenticated,
  authenticateRole("admin"),
  (req, res) => {
    const courseId = req.params.id;
    const query = "SELECT * FROM courses WHERE id = ?";
    sql.query(connectionString, query, [courseId], (err, result) => {
      if (err) {
        console.error("Edit fetch error:", err);
        return res.status(500).send("Database error");
      }
      if (result.length === 0) return res.status(404).send("Course not found");
      res.render("editCourse", { course: result[0], user: req.user });
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

      const timeStr = r.start_time.toISOString().slice(11, 19);
      const periodIndex = timeToPeriod[timeStr];

      return {
        time: timeStr,
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

app.get(
  "/schedule/new",
  checkAuthenticated,
  authenticateRole("admin"),
  (req, res) => {
    const classQuery = "SELECT id, class_name FROM classes";
    sql.query(connectionString, classQuery, (err, result) => {
      if (err) return res.status(500).send("Class fetch error");
      res.render("newSchedule.ejs", { classes: result, user: req.user });
    });
  }
);

app.get(
  "/schedules",
  checkAuthenticated,
  authenticateRole("admin"),
  (req, res) => {
    const query = `
    SELECT s.*, c.class_name
    FROM schedules s
    JOIN classes c ON s.class_id = c.id
    ORDER BY s.schedule_date DESC
  `;

    sql.query(connectionString, query, (err, rows) => {
      if (err) {
        console.error("Fetch schedules error:", err);
        return res.status(500).send("Database error");
      }
      res.render("schedules.ejs", { schedules: rows, user: req.user });
    });
  }
);

app.get(
  "/schedules/:id/edit",
  checkAuthenticated,
  authenticateRole("admin"),
  (req, res) => {
    const scheduleId = req.params.id;

    const scheduleQuery = `SELECT * FROM schedules WHERE id = ?`;
    const classQuery = `SELECT id, class_name FROM classes`;

    sql.query(
      connectionString,
      scheduleQuery,
      [scheduleId],
      (err, scheduleResult) => {
        if (err || scheduleResult.length === 0)
          return res.status(500).send("Schedule not found");

        sql.query(connectionString, classQuery, (err, classList) => {
          if (err) return res.status(500).send("Class fetch error");

          res.render("editSchedule.ejs", {
            schedule: scheduleResult[0],
            classes: classList,
            user: req.user,
          });
        });
      }
    );
  }
);

app.post(
  "/classes",
  checkAuthenticated,
  authenticateRole(["admin", "teacher"]),
  (req, res) => {
    const { class_name, course_id, teacher_id, start_time, end_time } =
      req.body;

    if (!class_name || !course_id || !teacher_id || !start_time || !end_time) {
      return res.status(400).send("Missing required fields");
    }

    const query = `
    INSERT INTO classes (class_name, course_id, teacher_id, start_time, end_time)
    VALUES (?, ?, ?, ?, ?);
  `;

    sql.query(
      connectionString,
      query,
      [class_name, course_id, teacher_id, start_time, end_time],
      (err) => {
        if (err) {
          console.error("Insert class error:", err);
          return res.status(500).send("Database error");
        }
        res.redirect("/classes"); // or render a success page
      }
    );
  }
);

app.get(
  "/classes",
  checkAuthenticated,
  authenticateRole(["admin", "teacher"]),
  (req, res) => {
    const query = `
    SELECT c.*, co.course_name, t.full_name AS teacher_name
    FROM classes c
    JOIN courses co ON c.course_id = co.id
    JOIN teachers t ON c.teacher_id = t.id
    ORDER BY c.created_at DESC
  `;
    sql.query(connectionString, query, (err, rows) => {
      if (err) {
        console.error("Fetch classes error:", err);
        return res.status(500).send("Database error");
      }
      res.render("classes.ejs", { classes: rows, user: req.user });
    });
  }
);

app.get(
  "/classes/:id/edit",
  checkAuthenticated,
  authenticateRole(["admin", "teacher"]),
  (req, res) => {
    const classId = req.params.id;

    const classQuery = "SELECT * FROM classes WHERE id = ?";
    const courseQuery = "SELECT id, course_name FROM courses";
    const teacherQuery = "SELECT id, full_name FROM teachers";

    sql.query(connectionString, classQuery, [classId], (err, classResult) => {
      if (err || classResult.length === 0)
        return res.status(500).send("Class not found");

      sql.query(connectionString, courseQuery, (err, courses) => {
        if (err) return res.status(500).send("Course fetch error");

        sql.query(connectionString, teacherQuery, (err, teachers) => {
          if (err) return res.status(500).send("Teacher fetch error");

          res.render("editClass.ejs", {
            classItem: classResult[0],
            courses,
            teachers,
            user: req.user,
          });
        });
      });
    });
  }
);

app.get(
  "/enrollments",
  checkAuthenticated,
  authenticateRole("admin"),
  (req, res) => {
    const query = `
    SELECT e.id, s.full_name AS student_name, c.class_name, e.enrollment_date
    FROM enrollments e
    JOIN students s ON e.student_id = s.id
    JOIN classes c ON e.class_id = c.id
    ORDER BY e.enrollment_date DESC
  `;

    sql.query(connectionString, query, (err, rows) => {
      if (err) {
        console.error("Fetch enrollments error:", err);
        return res.status(500).send("Database error");
      }
      res.render("enrollments.ejs", { enrollments: rows, user: req.user });
    });
  }
);

app.get(
  "/enrollments/:id/edit",
  checkAuthenticated,
  authenticateRole("admin"),
  (req, res) => {
    const id = req.params.id;

    const enrollmentQuery = "SELECT * FROM enrollments WHERE id = ?";
    const studentQuery = "SELECT id, full_name FROM students";
    const classQuery = "SELECT id, class_name FROM classes";

    sql.query(connectionString, enrollmentQuery, [id], (err, result) => {
      if (err || result.length === 0)
        return res.status(404).send("Enrollment not found");

      const enrollment = result[0];
      sql.query(connectionString, studentQuery, (err, students) => {
        if (err) return res.status(500).send("Students fetch error");

        sql.query(connectionString, classQuery, (err, classes) => {
          if (err) return res.status(500).send("Classes fetch error");

          res.render("editEnrollment.ejs", {
            enrollment,
            students,
            classes,
            user: req.user,
          });
        });
      });
    });
  }
);

app.get(
  "/payments",
  checkAuthenticated,
  authenticateRole("admin"),
  (req, res) => {
    const query = `
    SELECT p.id, s.full_name AS student_name, p.amount, p.payment_date
    FROM payments p
    JOIN students s ON p.student_id = s.id
    ORDER BY p.payment_date DESC
  `;

    sql.query(connectionString, query, (err, rows) => {
      if (err) {
        console.error("Fetch payments error:", err);
        return res.status(500).send("Database error");
      }
      res.render("payments.ejs", { payments: rows, user: req.user });
    });
  }
);

app.get(
  "/payments/:id/edit",
  checkAuthenticated,
  authenticateRole("admin"),
  (req, res) => {
    const paymentId = req.params.id;

    const paymentQuery = "SELECT * FROM payments WHERE id = ?";
    const studentQuery = "SELECT id, full_name FROM students";

    sql.query(connectionString, paymentQuery, [paymentId], (err, result) => {
      if (err || result.length === 0)
        return res.status(404).send("Payment not found");

      const payment = result[0];

      sql.query(connectionString, studentQuery, (err, students) => {
        if (err) return res.status(500).send("Student fetch error");

        res.render("editPayment.ejs", {
          payment,
          students,
          user: req.user,
        });
      });
    });
  }
);

app.get(
  "/payments/new",
  checkAuthenticated,
  authenticateRole("admin"),
  (req, res) => {
    res.render("Newpayments.ejs", { user: req.user });
  }
);

app.get(
  "/enrollments/new",
  checkAuthenticated,
  authenticateRole("admin"),
  (req, res) => {
    res.render("Addenrollments.ejs", { user: req.user });
  }
);

app.get(
  "/upload",
  authenticateRole(["admin", "teacher"]),
  checkAuthenticated,
  (req, res) => {
    res.render("uploadMaterial.ejs", { user: req.user });
  }
);

app.get(
  "/classes/new",
  checkAuthenticated,
  authenticateRole(["admin", "teacher"]),
  (req, res) => {
    // Get courses and teachers data
    const courseQuery = "SELECT id, course_name FROM courses";
    const teacherQuery = "SELECT id, full_name FROM teachers";

    // First get courses
    sql.query(connectionString, courseQuery, (err, courses) => {
      if (err) {
        console.error("Course fetch error:", err);
        return res.status(500).send("Error fetching courses");
      }

      // Then get teachers
      sql.query(connectionString, teacherQuery, (err, teachers) => {
        if (err) {
          console.error("Teacher fetch error:", err);
          return res.status(500).send("Error fetching teachers");
        }

        // Render with both courses and teachers data
        res.render("addClass.ejs", {
          user: req.user,
          courses: courses,
          teachers: teachers,
        });
      });
    });
  }
);

app.get("/profile", checkAuthenticated, (req, res) => {
  const userId = req.user.id;
  const role = req.user.role;

  let query = "";
  if (role === "student") {
    query = `
      SELECT full_name, email, phone_number
      FROM students
      WHERE user_id = ?
    `;
  } else if (role === "teacher") {
    query = `
      SELECT full_name, email, phone_number
      FROM teachers
      WHERE user_id = ?
    `;
  } else if (role === "admin") {
    query = `
      SELECT full_name, email, phone_number
      FROM admins
      WHERE user_id = ?
    `;
  } else {
    return res.render("profile", { user: req.user, details: null });
  }

  sql.query(connectionString, query, [userId], (err, result) => {
    if (err || result.length === 0) {
      console.error("Profile fetch error:", err);
      return res.status(500).send("Error fetching profile");
    }
    res.render("profile.ejs", {
      user: req.user,
      details: result[0],
    });
  });
});

app.post(
  "/materials/:id",
  checkAuthenticated,
  authenticateRole(["admin", "teacher"]),
  (req, res) => {
    const { course_id, file_name } = req.body;
    const query = `
    UPDATE materials
    SET course_id = ?, 
        file_name = ?, 
        uploaded_at = GETDATE()
    WHERE id = ?
  `;

    sql.query(
      connectionString,
      query,
      [course_id, file_name, req.params.id],
      (err) => {
        if (err) {
          console.error("Update material error:", err);
          return res.status(500).send("Database error");
        }
        res.redirect("/materials");
      }
    );
  }
);

app.delete(
  "/materials/:id",
  checkAuthenticated,
  authenticateRole(["admin", "teacher"]),
  (req, res) => {
    const materialId = req.params.id;

    const getFilePathQuery = "SELECT file_path FROM materials WHERE id = ?";
    sql.query(
      connectionString,
      getFilePathQuery,
      [materialId],
      (err, result) => {
        if (err || result.length === 0)
          return res.status(500).send("Not found");

        const filePath = path.join(__dirname, result[0].file_path);

        // Delete from DB
        const deleteQuery = "DELETE FROM materials WHERE id = ?";
        sql.query(connectionString, deleteQuery, [materialId], (err) => {
          if (err) return res.status(500).send("Delete error");

          // Remove file from disk
          fs.unlink(filePath, (fsErr) => {
            if (fsErr) console.error("File deletion error:", fsErr);
            res.redirect("/materials");
          });
        });
      }
    );
  }
);

app.post(
  "/courses",
  checkAuthenticated,
  authenticateRole("admin"),
  (req, res) => {
    const { course_name, description, start_date, end_date } = req.body;
    const role = req.user.role;
    console.log("test");

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

app.post(
  "/users/:id",
  checkAuthenticated,
  authenticateRole("admin"),
  (req, res) => {
    const { username, role } = req.body;
    const query = `
    UPDATE users SET username = ?, role = ?, updated_at = GETDATE()
    WHERE id = ?
  `;

    sql.query(
      connectionString,
      query,
      [username, role, req.params.id],
      (err) => {
        try {
          if (err) {
            console.error("Update error:", err);
            return res.status(500).send("Update error");
          }
          res.redirect("/users");
        } catch (error) {
          // Ignore headers already sent error
          if (error.code !== "ERR_HTTP_HEADERS_SENT") {
            console.error("Unhandled error:", error);
          }
        }
      }
    );
  }
);

app.delete(
  "/users/:id",
  checkAuthenticated,
  authenticateRole("admin"),
  (req, res) => {
    const query = "DELETE FROM users WHERE id = ?";
    sql.query(connectionString, query, [req.params.id], (err) => {
      if (err) return res.status(500).send("Delete failed");
      res.redirect("/users");
    });
  }
);

app.post(
  "/courses/:id",
  checkAuthenticated,
  authenticateRole("admin"),
  (req, res) => {
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
          if (error.code !== "ERR_HTTP_HEADERS_SENT") {
            console.error("Unhandled error:", error);
          }
        }
      } catch (error) {
        // Ignore headers already sent error
        if (error.code !== "ERR_HTTP_HEADERS_SENT") {
          console.error("Unhandled error:", error);
        }
      }
    });
  }
);

app.delete(
  "/courses/:id",
  checkAuthenticated,
  authenticateRole("admin"),
  (req, res) => {
    const query = "DELETE FROM courses WHERE id = ?";
    sql.query(connectionString, query, [req.params.id], (err) => {
      if (err) {
        console.error("Delete error:", err);
        return res.status(500).send("Delete failed");
      }
      res.redirect("/courses");
    });
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

app.post(
  "/upload-material",
  checkAuthenticated,
  authenticateRole(["admin", "teacher"]),
  upload.single("material"),
  (req, res) => {
    const { course_id } = req.body;
    const file = req.file;

    if (!course_id || !file) {
      return res.status(400).send("Missing course_id or file.");
    }

    const insertQuery = `
    INSERT INTO materials (course_id, file_name, file_path, uploaded_at)
    VALUES (?, ?, ?, GETDATE())
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
  "/schedules",
  checkAuthenticated,
  authenticateRole("admin"),
  (req, res) => {
    const { class_id, day_of_week, schedule_date, start_time, end_time } =
      req.body;

    const query = `
    INSERT INTO schedules (class_id, day_of_week, schedule_date, start_time, end_time)
    VALUES (?, ?, ?, ?, ?)
  `;

    const values = [class_id, day_of_week, schedule_date, start_time, end_time];

    sql.query(connectionString, query, values, (err) => {
      if (err) {
        console.error("Insert schedule error:", err);
        return res.status(500).send("Insert failed");
      }
      res.redirect("/schedules");
    });
  }
);

app.post(
  "/schedules/:id",
  checkAuthenticated,
  authenticateRole("admin"),
  (req, res) => {
    const { class_id, day_of_week, schedule_date, start_time, end_time } =
      req.body;
    const query = `
    UPDATE schedules
    SET class_id = ?, day_of_week = ?, schedule_date = ?, start_time = ?, end_time = ?
    WHERE id = ?
  `;

    const values = [
      class_id,
      day_of_week,
      schedule_date,
      start_time,
      end_time,
      req.params.id,
    ];
    sql.query(connectionString, query, values, (err) => {
      if (err) {
        console.error("Update schedule error:", err);
        return res.status(500).send("Update failed");
      }
      res.redirect("/schedules");
    });
  }
);

app.delete(
  "/schedules/:id",
  checkAuthenticated,
  authenticateRole("admin"),
  (req, res) => {
    const query = `DELETE FROM schedules WHERE id = ?`;
    sql.query(connectionString, query, [req.params.id], (err) => {
      if (err) {
        console.error("Delete schedule error:", err);
        return res.status(500).send("Delete failed");
      }
      res.redirect("/schedules");
    });
  }
);

app.post(
  "/schedules",
  checkAuthenticated,
  authenticateRole("admin"),
  (req, res) => {
    const { class_id, day_of_week, schedule_date, start_time, end_time } =
      req.body;

    const query = `
    INSERT INTO schedules (class_id, day_of_week, schedule_date, start_time, end_time)
    VALUES (?, ?, ?, ?, ?)
  `;

    const values = [class_id, day_of_week, schedule_date, start_time, end_time];

    sql.query(connectionString, query, values, (err) => {
      if (err) {
        console.error("Insert schedule error:", err);
        return res.status(500).send("Insert failed");
      }
      res.redirect("/schedules");
    });
  }
);

app.post(
  "/classes/:id",
  checkAuthenticated,
  authenticateRole(["admin", "teacher"]),
  (req, res) => {
    const { class_name, course_id, teacher_id, start_time, end_time } =
      req.body;

    const query = `
    UPDATE classes
    SET class_name = ?, course_id = ?, teacher_id = ?, 
        start_time = ?, end_time = ?, updated_at = GETDATE()
    WHERE id = ?
  `;

    const values = [
      class_name,
      course_id,
      teacher_id,
      start_time,
      end_time,
      req.params.id,
    ];
    sql.query(connectionString, query, values, (err) => {
      try {
        if (err) {
          console.error("Update class error:", err);
          return res.status(500).send("Update failed");
        }
        res.redirect("/classes");
      } catch (error) {
        // Ignore headers already sent error
        if (error.code !== "ERR_HTTP_HEADERS_SENT") {
          console.error("Unhandled error:", error);
        }
      }
    });
  }
);

app.delete(
  "/classes/:id",
  checkAuthenticated,
  authenticateRole("admin"),
  (req, res) => {
    const classId = req.params.id;

    const deleteQuery = "DELETE FROM classes WHERE id = ?";
    sql.query(connectionString, deleteQuery, [classId], (err) => {
      if (err) {
        console.error("Delete class error:", err);
        return res
          .status(500)
          .send("Delete failed.xóa hết học viên trong lớp nếu chưa xóa");
      }
      res.redirect("/classes");
    });
  }
);

app.post(
  "/enrollments/new",
  checkAuthenticated,
  authenticateRole("admin"),
  (req, res) => {
    const { student_id, class_id, enrollment_date } = req.body;

    if (!student_id || !class_id || !enrollment_date) {
      return res.status(400).send("Missing required fields");
    }

    const query = `
    INSERT INTO enrollments (student_id, class_id, enrollment_date)
    VALUES (?, ?, ?);
  `;

    sql.query(
      connectionString,
      query,
      [student_id, class_id, enrollment_date],
      (err) => {
        if (err) {
          console.error("Enrollment insert error:", err);
          return res.status(500).send("Database error");
        }
        res.redirect("/enrollments"); // or success message
      }
    );
  }
);

app.post(
  "/enrollments/:id",
  checkAuthenticated,
  authenticateRole("admin"),
  (req, res) => {
    const { student_id, class_id, enrollment_date } = req.body;
    const query = `
    UPDATE enrollments
    SET student_id = ?, class_id = ?, enrollment_date = ?
    WHERE id = ?
  `;

    sql.query(
      connectionString,
      query,
      [student_id, class_id, enrollment_date, req.params.id],
      (err) => {
        if (err) {
          console.error("Update enrollment error:", err);
          return res.status(500).send("Update failed");
        }
        res.redirect("/enrollments");
      }
    );
  }
);

app.delete(
  "/enrollments/:id",
  checkAuthenticated,
  authenticateRole("admin"),
  (req, res) => {
    const query = "DELETE FROM enrollments WHERE id = ?";
    sql.query(connectionString, query, [req.params.id], (err) => {
      if (err) {
        console.error("Delete enrollment error:", err);
        return res.status(500).send("Delete failed");
      }
      res.redirect("/enrollments");
    });
  }
);

app.post(
  "/payments/new",
  checkAuthenticated,
  authenticateRole("admin"),
  (req, res) => {
    const { student_id, amount, payment_date } = req.body;

    if (!student_id || !amount || !payment_date) {
      return res.status(400).send("Missing required fields");
    }

    const query = `
    INSERT INTO payments (student_id, amount, payment_date)
    VALUES (?, ?, ?);
  `;

    sql.query(
      connectionString,
      query,
      [student_id, amount, payment_date],
      (err) => {
        if (err) {
          console.error("Payment insert error:", err);
          return res.status(500).send("Database error");
        }
        res.redirect("/payments");
      }
    );
  }
);

app.post(
  "/payments/:id",
  checkAuthenticated,
  authenticateRole("admin"),
  (req, res) => {
    const { student_id, amount, payment_date } = req.body;
    const query = `
    UPDATE payments
    SET student_id = ?, amount = ?, payment_date = ?
    WHERE id = ?
  `;

    sql.query(
      connectionString,
      query,
      [student_id, amount, payment_date, req.params.id],
      (err) => {
        if (err) {
          console.error("Update payment error:", err);
          return res.status(500).send("Update failed");
        }
        res.redirect("/payments");
      }
    );
  }
);

app.delete(
  "/payments/:id",
  checkAuthenticated,
  authenticateRole("admin"),
  (req, res) => {
    const query = "DELETE FROM payments WHERE id = ?";
    sql.query(connectionString, query, [req.params.id], (err) => {
      if (err) {
        console.error("Delete payment error:", err);
        return res.status(500).send("Delete failed");
      }
      res.redirect("/payments");
    });
  }
);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

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
