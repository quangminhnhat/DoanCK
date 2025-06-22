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
const e = require("express");
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

// 1. First, add the image upload configuration at the top with other configurations
const courseImageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads', 'image');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `course-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const courseImageUpload = multer({
  storage: courseImageStorage,
  fileFilter: (req, file, cb) => {
    // Allow only images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

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
  "/download/:id",
  checkAuthenticated,
  async (req, res) => {
    try {
      const materialId = req.params.id;
      const query = "SELECT file_name, file_path FROM materials WHERE id = ?";
      const result = await executeQuery(query, [materialId]);
      if (!result.length) {
        return res.status(404).send("File not found");
      }
      const filePath = path.join(__dirname, result[0].file_path);
      res.download(filePath, result[0].file_name);
    } catch (error) {
      console.error("Download error:", error);
      res.status(500).send("Download failed");
    }
  }
);

app.get("/my-courses", checkAuthenticated, async (req, res) => {
  try {
    let query;
    let params = [];

    if (req.user.role === "student") {
      query = `
          SELECT 
            c.course_name,
            c.description AS course_description,
            c.tuition_fee,
            c.image_path,
            t.full_name AS teacher_name,
            t.email AS teacher_email,
            t.phone_number AS teacher_phone,   
            cls.class_name,
            CONVERT(VARCHAR(5), cls.start_time, 108) as class_start_time,
            CONVERT(VARCHAR(5), cls.end_time, 108) as class_end_time,
            cls.weekly_schedule,
            e.payment_status,
            e.payment_date,
            CONVERT(VARCHAR(10), e.enrollment_date, 23) as formatted_enrollment_date
          FROM enrollments e
          JOIN students st ON e.student_id = st.id
          JOIN classes cls ON e.class_id = cls.id
          JOIN teachers t ON cls.teacher_id = t.id
          JOIN courses c ON cls.course_id = c.id
          WHERE st.user_id = ?
          ORDER BY t.full_name, c.course_name
        `;
      params = [req.user.id];
    } else if (req.user.role === "teacher") {
      query = `
          SELECT 
            c.course_name,
            c.description AS course_description,
            c.tuition_fee,
            c.image_path,
            t.full_name AS teacher_name,
            t.email AS teacher_email,
            t.phone_number AS teacher_phone,   
            cls.class_name,
            CONVERT(VARCHAR(5), cls.start_time, 108) as class_start_time,
            CONVERT(VARCHAR(5), cls.end_time, 108) as class_end_time,
            cls.weekly_schedule,
            (SELECT COUNT(*) FROM enrollments e WHERE e.class_id = cls.id) as student_count,
            (SELECT COUNT(*) FROM enrollments e WHERE e.class_id = cls.id AND e.payment_status = 1) as paid_students
          FROM teachers t
          JOIN classes cls ON t.id = cls.teacher_id
          JOIN courses c ON cls.course_id = c.id
          WHERE t.user_id = ?
          ORDER BY c.course_name
        `;
      params = [req.user.id];
    }

    const courses = await executeQuery(query, params);

    // Process weekly schedule for display
    const processedCourses = courses.map((course) => ({
      ...course,
      schedule: course.weekly_schedule
        ? course.weekly_schedule
            .split(",")
            .map(
              (day) =>
                ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][
                  parseInt(day) - 1
                ]
            )
            .join(", ")
        : "No schedule set",
      formatted_tuition: course.tuition_fee
        ? course.tuition_fee.toLocaleString("vi-VN", {
            style: "currency",
            currency: "VND",
          })
        : "Not set",
    }));

    res.render("my-courses.ejs", {
      user: req.user,
      courses: processedCourses,
      messages: {
        error: req.flash("error"),
        success: req.flash("success"),
      },
    });
  } catch (error) {
    console.error("Error fetching courses:", error);
    res.status(500).send("Error loading courses");
  }
});

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
  async (req, res) => {
    try {
      const materialId = req.params.id;

      // Get material details with course info
      const query = `
        SELECT m.*, c.course_name
        FROM materials m
        JOIN courses c ON m.course_id = c.id
        WHERE m.id = ?
      `;

      // Get available courses for dropdown
      const courseQuery = `
        SELECT id, course_name 
        FROM courses 
        WHERE end_date >= GETDATE()
        ORDER BY course_name
      `;

      const [material, courses] = await Promise.all([
        executeQuery(query, [materialId]),
        executeQuery(courseQuery),
      ]);

      if (!material.length) {
        return res.status(404).send("Material not found");
      }

      res.render("editMaterial.ejs", {
        material: material[0],
        courses,
        user: req.user,
      });
    } catch (error) {
      console.error("Error loading material edit form:", error);
      res.status(500).send("Error loading material edit form");
    }
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
  async (req, res) => {
    try {
      const userId = req.params.id;
      const query = `
        SELECT u.id, u.username, u.role,
          COALESCE(s.full_name, t.full_name, a.full_name) AS full_name,
          COALESCE(s.email, t.email, a.email) AS email,
          COALESCE(s.phone_number, t.phone_number, a.phone_number) AS phone_number
        FROM users u
        LEFT JOIN students s ON u.id = s.user_id
        LEFT JOIN teachers t ON u.id = t.user_id
        LEFT JOIN admins a ON u.id = a.user_id
        WHERE u.id = ?
      `;

      const result = await executeQuery(query, [userId]);
      
      if (!result.length) {
        return res.status(404).send("User not found");
      }

      res.render("editUser.ejs", { 
        user: req.user,
        editUser: result[0]
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).send("Error loading user data");
    }
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
  "/schedule/new",
  checkAuthenticated,
  authenticateRole("admin"),
  async (req, res) => {
    try {
      const query = `
        SELECT 
          c.id,
          c.class_name,
          c.course_id,
          c.teacher_id,
          CONVERT(varchar(5), c.start_time, 108) as start_time,
          CONVERT(varchar(5), c.end_time, 108) as end_time,
          c.weekly_schedule,
          co.course_name,
          CONVERT(varchar(10), co.start_date, 23) as start_date,
          CONVERT(varchar(10), co.end_date, 23) as end_date,
          t.full_name as teacher_name
        FROM classes c
        INNER JOIN courses co ON c.course_id = co.id
        INNER JOIN teachers t ON c.teacher_id = t.id
        WHERE co.end_date >= GETDATE()
        ORDER BY co.start_date ASC, c.class_name
      `;

      let classes = await executeQuery(query);

      // Process weekly schedule for display
      const processedClasses = classes.map((cls) => ({
        ...cls,
        formattedStartTime: cls.start_time,
        formattedEndTime: cls.end_time,
        schedule: cls.weekly_schedule
          ? cls.weekly_schedule
              .split(",")
              .map((day) => {
                const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
                return days[parseInt(day) - 1];
              })
              .join(", ")
          : "No schedule set",
      }));

      res.render("newSchedule.ejs", {
        classes: processedClasses,
        user: req.user,
        currentDate: new Date().toISOString().split("T")[0],
      });
    } catch (err) {
      console.error("Error loading schedule form:", err);
      console.error(err.stack);
      res.status(500).send("Error loading schedule form");
    }
  }
);




app.delete(
  "/courses/:id",
  checkAuthenticated,
  authenticateRole("admin"),
  async (req, res) => {
    try {
      const courseId = req.params.id;

      // Check if course has any classes
      const classCheckQuery = `
      SELECT COUNT(*) as classCount 
      FROM classes 
      WHERE course_id = ?
    `;
      const classCheck = await executeQuery(classCheckQuery, [courseId]);

      if (classCheck[0].classCount > 0) {
        req.flash("error", "Cannot delete course that has classes");
        return res.redirect("/courses");
      }

      // Check if course has any materials
      const materialCheckQuery = `
      SELECT COUNT(*) as materialCount 
      FROM materials 
      WHERE course_id = ?
    `;
      const materialCheck = await executeQuery(materialCheckQuery, [courseId]);

      if (materialCheck[0].materialCount > 0) {
        req.flash("error", "Cannot delete course that has materials");
        return res.redirect("/courses");
      }

      // If no dependencies, delete the course
      const deleteQuery = `DELETE FROM courses WHERE id = ?`;
      await executeQuery(deleteQuery, [courseId]);

      req.flash("success", "Course deleted successfully");
      res.redirect("/courses");
    } catch (error) {
      console.error("Course deletion error:", error);
      req.flash("error", "Failed to delete course");
      res.redirect("/courses");
    }
  }
);


app.get("/courses/:id", checkAuthenticated, authenticateRole(["admin", "teacher"]), async (req, res) => {
  try {
    const courseId = req.params.id;
    
    // Get course details with class and material counts
    const query = `
      SELECT 
        c.*,
        CONVERT(varchar(10), c.start_date, 23) as formatted_start_date,
        CONVERT(varchar(10), c.end_date, 23) as formatted_end_date,
        (SELECT COUNT(*) FROM classes WHERE course_id = c.id) as class_count,
        (SELECT COUNT(*) FROM materials WHERE course_id = c.id) as material_count,
        (
          SELECT STRING_AGG(CONCAT(t.full_name, ' (', cls.class_name, ')'), ', ')
          FROM classes cls
          JOIN teachers t ON cls.teacher_id = t.id
          WHERE cls.course_id = c.id
        ) as teachers_and_classes
      FROM courses c
      WHERE c.id = ?
    `;

    const courseResult = await executeQuery(query, [courseId]);

    if (!courseResult.length) {
      return res.status(404).send("Course not found");
    }

    // Get all classes for this course
    const classesQuery = `
      SELECT 
        cls.id,
        cls.class_name,
        t.full_name as teacher_name,
        CONVERT(varchar(5), cls.start_time, 108) as start_time,
        CONVERT(varchar(5), cls.end_time, 108) as end_time,
        cls.weekly_schedule,
        (SELECT COUNT(*) FROM enrollments WHERE class_id = cls.id) as student_count
      FROM classes cls
      JOIN teachers t ON cls.teacher_id = t.id
      WHERE cls.course_id = ?
      ORDER BY cls.class_name
    `;

    const classesResult = await executeQuery(classesQuery, [courseId]);

    // Get all materials for this course
    const materialsQuery = `
      SELECT id, file_name, uploaded_at
      FROM materials
      WHERE course_id = ?
      ORDER BY uploaded_at DESC
    `;

    const materialsResult = await executeQuery(materialsQuery, [courseId]);

    // Process the course data
    const course = {
      ...courseResult[0],
      classes: classesResult.map(cls => ({
        ...cls,
        schedule: cls.weekly_schedule ? 
          cls.weekly_schedule.split(',')
            .map(day => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][parseInt(day) - 1])
            .join(', ') : 
          'No schedule set'
      })),
      materials: materialsResult
    };

    res.render("courseDetail.ejs", {
      course,
      user: req.user,
      messages: {
        error: req.flash('error'),
        success: req.flash('success')
      }
    });

  } catch (error) {
    console.error("Error fetching course details:", error);
    res.status(500).send("Error loading course details");
  }
});


app.get("/courses/:id/edit", checkAuthenticated, authenticateRole("admin"), async (req, res) => {
  try {
    const courseId = req.params.id;
    
    // Get course details
    const query = `
      SELECT 
        c.*,
        CONVERT(varchar(10), c.start_date, 23) as formatted_start_date,
        CONVERT(varchar(10), c.end_date, 23) as formatted_end_date,
        (SELECT COUNT(*) FROM classes WHERE course_id = c.id) as class_count,
        (SELECT COUNT(*) FROM materials WHERE course_id = c.id) as material_count,
        (
          SELECT STRING_AGG(CONCAT(t.full_name, ' (', cls.class_name, ')'), ', ') 
          FROM classes cls
          JOIN teachers t ON cls.teacher_id = t.id
          WHERE cls.course_id = c.id
        ) as teachers_and_classes
      FROM courses c
      WHERE c.id = ?
    `;

    const courseResult = await executeQuery(query, [courseId]);

    if (!courseResult.length) {
      return res.status(404).send("Course not found");
    }

    const course = {
      ...courseResult[0],
      start_date: new Date(courseResult[0].start_date),
      end_date: new Date(courseResult[0].end_date)
    };

    res.render("editCourse.ejs", {
      course,
      user: req.user,
      messages: {
        error: req.flash('error'),
        success: req.flash('success')
      }
    });

  } catch (error) {
    console.error("Error loading course edit form:", error);
    res.status(500).send("Error loading course edit form");
  }
});


app.get(
  "/courses",
  checkAuthenticated,
  authenticateRole(["admin", "teacher"]),
  async (req, res) => {
    try {
      const query = `
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM classes WHERE course_id = c.id) as class_count,
        (SELECT COUNT(*) FROM materials WHERE course_id = c.id) as material_count,
        (
          SELECT STRING_AGG(CONCAT(t.full_name, ' (', cls.class_name, ')'), ', ')
          FROM classes cls
          JOIN teachers t ON cls.teacher_id = t.id
          WHERE cls.course_id = c.id
        ) as teachers_and_classes
      FROM courses c
      ORDER BY c.created_at DESC
    `;

      const courses = await executeQuery(query);

      // Process the results
      const processedCourses = courses.map((course) => ({
        ...course,
        hasClasses: course.class_count > 0,
        teacherInfo: course.teachers_and_classes || "No classes assigned",
      }));

      res.render("courses.ejs", {
        courses: processedCourses,
        user: req.user,
      });
    } catch (err) {
      console.error("Fetch courses error:", err);
      res.status(500).send("Error loading courses");
    }
  }
);

// 2. Update the course creation route
app.post("/courses", 
  checkAuthenticated, 
  authenticateRole("admin"),
  courseImageUpload.single('course_image'),
  async (req, res) => {
  try {
    const { course_name, description, start_date, end_date, tuition_fee } = req.body;

      // Handle image path
      const image_path = req.file ? 
        path.join('uploads', 'image', req.file.filename) : null;

    const query = `
        INSERT INTO courses (
          course_name, 
          description, 
          start_date, 
          end_date, 
          tuition_fee,
          image_path,
          created_at, 
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, GETDATE(), GETDATE())
    `;

    await executeQuery(query, [
      course_name,
      description,
      start_date,
      end_date,
        tuition_fee || null,
        image_path
    ]);

    res.redirect("/courses");
  } catch (err) {
      // Clean up uploaded file if query fails
      if (req.file) {
        fs.unlink(req.file.path, (unlinkErr) => {
          if (unlinkErr) console.error('Error deleting file:', unlinkErr);
        });
      }
    console.error("Course creation error:", err);
    res.status(500).send("Failed to create course");
  }
  }
);

// 3. Update the course edit route
app.post("/courses/:id", 
  checkAuthenticated, 
  authenticateRole("admin"),
  courseImageUpload.single('course_image'),
  async (req, res) => {
  try {
      const courseId = req.params.id;
    const { course_name, description, start_date, end_date, tuition_fee } = req.body;

      // Get current course info
      const currentCourse = await executeQuery(
        "SELECT image_path FROM courses WHERE id = ?", 
      [courseId]
    );

      if (!currentCourse.length) {
      return res.status(404).send("Course not found");
    }

      let image_path = currentCourse[0].image_path;

      // If new image uploaded, update path and delete old image
      if (req.file) {
        if (image_path) {
          const oldImagePath = path.join(__dirname, image_path);
          fs.unlink(oldImagePath, err => {
            if (err) console.error("Error deleting old image:", err);
          });
        }
        image_path = path.join('uploads', 'image', req.file.filename);
      }

    const query = `
      UPDATE courses 
      SET course_name = ?,
          description = ?,
          start_date = ?,
          end_date = ?,
          tuition_fee = ?,
            image_path = ?,
          updated_at = GETDATE()
      WHERE id = ?
    `;

    await executeQuery(query, [
      course_name,
      description,
      start_date,
      end_date,
      tuition_fee || null,
        image_path,
      courseId
    ]);

    res.redirect("/courses");
  } catch (err) {
      // Clean up uploaded file if query fails
      if (req.file) {
        fs.unlink(req.file.path, (unlinkErr) => {
          if (unlinkErr) console.error('Error deleting file:', unlinkErr);
        });
      }
    console.error("Course update error:", err);
    res.status(500).send("Failed to update course");
  }
  }
);

// 4. Update the course delete route to handle image deletion
app.delete("/courses/:id", 
  checkAuthenticated, 
  authenticateRole("admin"), 
  async (req, res) => {
  try {
    const courseId = req.params.id;

      // Get course info for image deletion
      const course = await executeQuery(
        "SELECT image_path FROM courses WHERE id = ?", 
        [courseId]
      );

      // Delete image file if exists
      if (course[0]?.image_path) {
        const imagePath = path.join(__dirname, course[0].image_path);
        fs.unlink(imagePath, err => {
          if (err) console.error("Error deleting course image:", err);
        });
      }

      // Delete course record
    await executeQuery("DELETE FROM courses WHERE id = ?", [courseId]);
      
    res.redirect("/courses");
  } catch (err) {
    console.error("Course deletion error:", err);
    res.status(500).send("Failed to delete course");
  }
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



app.delete(
  "/schedules/:id",
  checkAuthenticated,
  authenticateRole("admin"),
  async (req, res) => {
    try {
      const scheduleId = req.params.id;
      
      // Check if schedule exists
      const checkQuery = "SELECT id FROM schedules WHERE id = ?";
      const schedule = await executeQuery(checkQuery, [scheduleId]);
      
      if (!schedule.length) {
        return res.status(404).send("Schedule not found");
      }

      // Delete schedule
      const deleteQuery = "DELETE FROM schedules WHERE id = ?";
      await executeQuery(deleteQuery, [scheduleId]);
      
      res.redirect("/schedules");
    } catch (err) {
      console.error("Delete schedule error:", err);
      res.status(500).send("Failed to delete schedule");
    }
  }
);


app.get(
  "/schedules",
  checkAuthenticated,
  authenticateRole("admin"),
  async (req, res) => {
    try {
      const query = `
      SELECT 
        s.*,
        c.class_name,
        co.course_name,
        t.full_name as teacher_name,
        CONVERT(VARCHAR(5), s.start_time, 108) as formatted_start_time,
        CONVERT(VARCHAR(5), s.end_time, 108) as formatted_end_time
      FROM schedules s
      JOIN classes c ON s.class_id = c.id
      JOIN courses co ON c.course_id = co.id
      JOIN teachers t ON c.teacher_id = t.id
      ORDER BY s.schedule_date DESC, s.start_time ASC
    `;

      const schedules = await executeQuery(query);
      res.render("schedules.ejs", { schedules, user: req.user });
    } catch (err) {
      console.error("Fetch schedules error:", err);
      res.status(500).send("Error loading schedules");
    }
  }
);


// Add schedule validation middleware
const validateSchedule = async (req, res, next) => {
  try {
    const { class_id, schedule_date } = req.body;

    // Get course dates
    const courseQuery = `
      SELECT co.start_date, co.end_date, co.id as course_id
      FROM courses co
      JOIN classes c ON co.id = c.course_id 
      WHERE c.id = ?
    `;
    
    const courseDates = await executeQuery(courseQuery, [class_id]);
    
    if (!courseDates.length) {
      return res.status(404).send("Class or course not found");
    }

    const scheduleDate = new Date(schedule_date);
    const courseStart = new Date(courseDates[0].start_date);
    const courseEnd = new Date(courseDates[0].end_date);

    if (scheduleDate < courseStart || scheduleDate > courseEnd) {
      return res.status(400).send("Schedule date must be within course dates");
    }

    // Add course_id to request body for next middleware
    req.body.course_id = courseDates[0].course_id;
    next();

  } catch (err) {
    console.error("Schedule validation error:", err);
    res.status(500).send("Validation error");
  }
};

// Post route with validation
app.post(
  "/schedules",
  checkAuthenticated,
  authenticateRole("admin"),
  async (req, res) => {
    try {
      const { class_id, schedule_date, start_time, end_time, day_of_week } =
        req.body;

      // Input validation
      if (
        !class_id ||
        !schedule_date ||
        !start_time ||
        !end_time ||
        !day_of_week
      ) {
        return res.status(400).send("Missing required fields");
      }

      // Get course_id for the class
      const courseQuery = "SELECT course_id FROM classes WHERE id = ?";
      const courseResult = await executeQuery(courseQuery, [class_id]);

      if (!courseResult.length) {
        return res.status(404).send("Class not found");
      }

      const course_id = courseResult[0].course_id;

      // Check for schedule conflicts
      const conflictQuery = `
      SELECT id FROM schedules 
      WHERE class_id = ? 
      AND schedule_date = ? 
      AND ((start_time <= ? AND end_time >= ?) 
        OR (start_time <= ? AND end_time >= ?)
        OR (start_time >= ? AND end_time <= ?))
    `;

      const conflicts = await executeQuery(conflictQuery, [
        class_id,
        schedule_date,
        start_time,
        start_time,
        end_time,
        end_time,
        start_time,
        end_time,
      ]);

      if (conflicts.length > 0) {
        return res.status(409).send("Schedule conflict detected");
      }

      const insertQuery = `
      INSERT INTO schedules (
        class_id, 
        course_id,
        day_of_week, 
        schedule_date, 
        start_time, 
        end_time,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, GETDATE(), GETDATE())
    `;

      await executeQuery(insertQuery, [
        class_id,
        course_id,
        day_of_week,
        schedule_date,
        start_time,
        end_time,
      ]);

      res.redirect("/schedules");
    } catch (err) {
      console.error("Create schedule error:", err);
      res.status(500).send("Failed to create schedule");
    }
  }
);


app.get("/schedules/:id/edit", checkAuthenticated, authenticateRole("admin"), async (req, res) => {
  try {
    const scheduleId = req.params.id;

    // Get schedule details with all related information
    const scheduleQuery = `
      SELECT 
        s.*,
        c.id as class_id,
        c.class_name,
        c.weekly_schedule,
        co.id as course_id,
        co.course_name,
        co.start_date as course_start,
        co.end_date as course_end,
        t.full_name as teacher_name,
        CONVERT(varchar(5), s.start_time, 108) as formatted_start_time,
        CONVERT(varchar(5), s.end_time, 108) as formatted_end_time,
        CONVERT(varchar(10), s.schedule_date, 23) as formatted_schedule_date
      FROM schedules s
      JOIN classes c ON s.class_id = c.id
      JOIN courses co ON c.course_id = co.id
      JOIN teachers t ON c.teacher_id = t.id
      WHERE s.id = ?
    `;

    // Get all available classes for dropdown
    const classesQuery = `
      SELECT 
        c.id,
        c.class_name,
        co.course_name,
        t.full_name as teacher_name,
        CONVERT(varchar(10), co.start_date, 23) as start_date,
        CONVERT(varchar(10), co.end_date, 23) as end_date,
        c.weekly_schedule
      FROM classes c
      JOIN courses co ON c.course_id = co.id
      JOIN teachers t ON c.teacher_id = t.id
      WHERE co.end_date >= GETDATE()
      ORDER BY co.start_date ASC, c.class_name
    `;

    // Execute both queries concurrently
    const [scheduleResults, classesResults] = await Promise.all([
      executeQuery(scheduleQuery, [scheduleId]),
      executeQuery(classesQuery)
    ]);

    if (!scheduleResults.length) {
      console.error(`Schedule not found with ID: ${scheduleId}`);
      return res.status(404).render('error.ejs', {
        message: 'Schedule not found',
        user: req.user
      });
    }

    // Process weekly schedule for classes
    const processedClasses = classesResults.map(cls => ({
      ...cls,
      schedule: cls.weekly_schedule ? 
        cls.weekly_schedule.split(',')
          .map(day => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][parseInt(day) - 1])
          .join(', ') : 
        'No schedule set'
    }));

    res.render("editSchedule.ejs", {
      schedule: {
        ...scheduleResults[0],
        day_name: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][
          new Date(scheduleResults[0].schedule_date).getDay()
        ]
      },
      classes: processedClasses,
      user: req.user,
      messages: {
        error: req.flash('error'),
        success: req.flash('success')
      }
    });

  } catch (err) {
    console.error("Schedule edit error:", err);
    res.status(500).render('error.ejs', {
      message: 'Error loading schedule edit form',
      error: err,
      user: req.user
    });
  }
});


//you gonna need to redo this part
app.get("/schedule", checkAuthenticated, (req, res) => {
  // 1. Week calculation
  let monday;
  if (req.query.weekStart) {
    monday = new Date(req.query.weekStart);
  } else {
    const today = new Date();
    const offset = (today.getDay() + 6) % 7; // Mon = 0
    monday = new Date(today);
    monday.setDate(today.getDate() - offset);
  }

  // 2. Days setup
  const dayNames = [
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
      name: dayNames[i],
      date: dt.toLocaleDateString("vi-VN"),
      iso: dt.toISOString().slice(0, 10),
    };
  });

  // 3. Query based on user role
  const userId = req.user.id;
  const role = req.user.role;

  let query;
  let params = [];

  if (role === "student") {
      query = `
        SELECT 
          cls.id as class_id,
          cls.class_name,
          co.course_name,
          t.full_name AS teacher,
          CONVERT(VARCHAR(5), cls.start_time, 108) as start_time,
          CONVERT(VARCHAR(5), cls.end_time, 108) as end_time,
          cls.weekly_schedule,
          s.schedule_date AS extra_date,
          s.start_time AS extra_start,
          s.end_time AS extra_end,
          co.start_date AS course_start,
          co.end_date AS course_end 
        FROM students st
        JOIN enrollments e ON st.id = e.student_id
        JOIN classes cls ON e.class_id = cls.id
        JOIN courses co ON cls.course_id = co.id
        JOIN teachers t ON cls.teacher_id = t.id
        LEFT JOIN schedules s ON cls.id = s.class_id 
          AND s.schedule_date BETWEEN ? AND ?
        WHERE st.user_id = ?
          AND co.start_date <= ?  -- Thêm điều kiện này
          AND co.end_date >= ?    -- Thêm điều kiện này
      `;
      params = [days[0].iso, days[6].iso, userId, days[6].iso, days[0].iso]; 
  } else if (role === "teacher") {
    query = `
      SELECT 
        cls.id as class_id,
        cls.class_name,
        co.course_name,
        NULL AS teacher,
        CONVERT(VARCHAR(5), cls.start_time, 108) as start_time,
        CONVERT(VARCHAR(5), cls.end_time, 108) as end_time,
        cls.weekly_schedule,
        s.schedule_date AS extra_date,
        s.start_time AS extra_start,
        s.end_time AS extra_end
      FROM teachers t
      JOIN classes cls ON t.id = cls.teacher_id
      JOIN courses co ON cls.course_id = co.id
      LEFT JOIN schedules s ON cls.id = s.class_id 
        AND s.schedule_date BETWEEN ? AND ?
      WHERE t.user_id = ?
    `;
    params = [days[0].iso, days[6].iso, userId];
  } else {
    return res.status(403).send("Unauthorized role");
  }

  sql.query(connectionString, query, params, (err, rows) => {
    if (err) {
      console.error("SQL Error Details:", {
        error: err.message,
        code: err.code,
        query: query,
        params: params,
      });
      return res.status(500).send("Database operation failed");
    }

    const scheduleData = [];
    const periodMap = {}; // To track which periods are already filled

    // Helper function to convert time string to period number
    const timeToPeriod = (timeValue) => {
      // Xử lý cả Date object và string
      let hours, minutes;
      if (timeValue instanceof Date) {
        hours = timeValue.getHours();
        minutes = timeValue.getMinutes();
      } else if (typeof timeValue === "string") {
        [hours, minutes] = timeValue.split(":").map(Number);
      } else {
        // Fallback nếu có kiểu dữ liệu khác
        const timeStr = timeValue.toString();
        [hours, minutes] = timeStr.split(":").map(Number);
      }

      // Tính toán period dựa trên giờ bắt đầu là 7:00
      return Math.floor(hours - 7 + minutes / 60) + 1;
    };
    // Trong phần xử lý kết quả query
    const courseStart = rows.length > 0 ? rows[0].course_start : null;
    const courseEnd = rows.length > 0 ? rows[0].course_end : null;

    // Process regular weekly classes
    rows.forEach((row) => {
      if (row.weekly_schedule) {
        const weekDays = row.weekly_schedule.split(",").map(Number);

        weekDays.forEach((dayIndex) => {
          if (dayIndex >= 1 && dayIndex <= 7) {
            const startPeriod = timeToPeriod(row.start_time);
            const endPeriod = timeToPeriod(row.end_time);
            const dayIso = days[dayIndex - 1].iso; // Lấy ngày ISO tương ứng

            // Thêm từng tiết học vào scheduleData
            for (let period = startPeriod; period <= endPeriod; period++) {
              scheduleData.push({
                type: "regular",
                date: dayIso,
                startPeriod: period,
                endPeriod: period,
                className: row.class_name,
                courseName: row.course_name,
                teacher: row.teacher || "",
                classId: row.class_id,
              });
            }
          }
        });
      }

      // Process extra sessions
      if (row.extra_date) {
        const extraDate = new Date(row.extra_date).toISOString().slice(0, 10);
        const startPeriod = timeToPeriod(row.extra_start);
        const endPeriod = timeToPeriod(row.extra_end);

        for (let period = startPeriod; period <= endPeriod; period++) {
          const key = `${extraDate}-${period}`;

          if (!periodMap[key]) {
            scheduleData.push({
              type: "extra",
              date: extraDate,
              startPeriod: period,
              endPeriod: period,
              className: row.class_name,
              courseName: row.course_name,
              teacher: row.teacher || "",
              classId: row.class_id,
            });
            periodMap[key] = true;
          }
        }
      }
    });
    

    res.render("schedule", {
      user: req.user,
      days,
      scheduleData,
      courseStart, 
      courseEnd, 
      weekStart: days[0].iso,
      prevWeekStart: new Date(new Date(monday).setDate(monday.getDate() - 7))
        .toISOString()
        .slice(0, 10),
      nextWeekStart: new Date(new Date(monday).setDate(monday.getDate() + 7))
        .toISOString()
        .slice(0, 10),
    });
  });
});//you gonna need to redo this part
app.get("/schedule", checkAuthenticated, (req, res) => {
  // 1. Week calculation
  let monday;
  if (req.query.weekStart) {
    monday = new Date(req.query.weekStart);
  } else {
    const today = new Date();
    const offset = (today.getDay() + 6) % 7; // Mon = 0
    monday = new Date(today);
    monday.setDate(today.getDate() - offset);
  }

  // 2. Days setup
  const dayNames = [
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
      name: dayNames[i],
      date: dt.toLocaleDateString("vi-VN"),
      iso: dt.toISOString().slice(0, 10),
    };
  });

  // 3. Query based on user role
  const userId = req.user.id;
  const role = req.user.role;

  let query;
  let params = [];

  if (role === "student") {
      query = `
        SELECT 
          cls.id as class_id,
          cls.class_name,
          co.course_name,
          t.full_name AS teacher,
          CONVERT(VARCHAR(5), cls.start_time, 108) as start_time,
          CONVERT(VARCHAR(5), cls.end_time, 108) as end_time,
          cls.weekly_schedule,
          s.schedule_date AS extra_date,
          s.start_time AS extra_start,
          s.end_time AS extra_end,
          co.start_date AS course_start,
          co.end_date AS course_end 
        FROM students st
        JOIN enrollments e ON st.id = e.student_id
        JOIN classes cls ON e.class_id = cls.id
        JOIN courses co ON cls.course_id = co.id
        JOIN teachers t ON cls.teacher_id = t.id
        LEFT JOIN schedules s ON cls.id = s.class_id 
          AND s.schedule_date BETWEEN ? AND ?
        WHERE st.user_id = ?
          AND co.start_date <= ?  -- Thêm điều kiện này
          AND co.end_date >= ?    -- Thêm điều kiện này
      `;
      params = [days[0].iso, days[6].iso, userId, days[6].iso, days[0].iso]; 
  } else if (role === "teacher") {
    query = `
      SELECT 
        cls.id as class_id,
        cls.class_name,
        co.course_name,
        NULL AS teacher,
        CONVERT(VARCHAR(5), cls.start_time, 108) as start_time,
        CONVERT(VARCHAR(5), cls.end_time, 108) as end_time,
        cls.weekly_schedule,
        s.schedule_date AS extra_date,
        s.start_time AS extra_start,
        s.end_time AS extra_end
      FROM teachers t
      JOIN classes cls ON t.id = cls.teacher_id
      JOIN courses co ON cls.course_id = co.id
      LEFT JOIN schedules s ON cls.id = s.class_id 
        AND s.schedule_date BETWEEN ? AND ?
      WHERE t.user_id = ?
    `;
    params = [days[0].iso, days[6].iso, userId];
  } else {
    return res.status(403).send("Unauthorized role");
  }

  sql.query(connectionString, query, params, (err, rows) => {
    if (err) {
      console.error("SQL Error Details:", {
        error: err.message,
        code: err.code,
        query: query,
        params: params,
      });
      return res.status(500).send("Database operation failed");
    }

    const scheduleData = [];
    const periodMap = {}; // To track which periods are already filled

    // Helper function to convert time string to period number
    const timeToPeriod = (timeValue) => {
      // Xử lý cả Date object và string
      let hours, minutes;
      if (timeValue instanceof Date) {
        hours = timeValue.getHours();
        minutes = timeValue.getMinutes();
      } else if (typeof timeValue === "string") {
        [hours, minutes] = timeValue.split(":").map(Number);
      } else {
        // Fallback nếu có kiểu dữ liệu khác
        const timeStr = timeValue.toString();
        [hours, minutes] = timeStr.split(":").map(Number);
      }

      // Tính toán period dựa trên giờ bắt đầu là 7:00
      return Math.floor(hours - 7 + minutes / 60) + 1;
    };
    // Trong phần xử lý kết quả query
    const courseStart = rows.length > 0 ? rows[0].course_start : null;
    const courseEnd = rows.length > 0 ? rows[0].course_end : null;

    // Process regular weekly classes
    rows.forEach((row) => {
      if (row.weekly_schedule) {
        const weekDays = row.weekly_schedule.split(",").map(Number);

        weekDays.forEach((dayIndex) => {
          if (dayIndex >= 1 && dayIndex <= 7) {
            const startPeriod = timeToPeriod(row.start_time);
            const endPeriod = timeToPeriod(row.end_time);
            const dayIso = days[dayIndex - 1].iso; // Lấy ngày ISO tương ứng

            // Thêm từng tiết học vào scheduleData
            for (let period = startPeriod; period <= endPeriod; period++) {
              scheduleData.push({
                type: "regular",
                date: dayIso,
                startPeriod: period,
                endPeriod: period,
                className: row.class_name,
                courseName: row.course_name,
                teacher: row.teacher || "",
                classId: row.class_id,
              });
            }
          }
        });
      }

      // Process extra sessions
      if (row.extra_date) {
        const extraDate = new Date(row.extra_date).toISOString().slice(0, 10);
        const startPeriod = timeToPeriod(row.extra_start);
        const endPeriod = timeToPeriod(row.extra_end);

        for (let period = startPeriod; period <= endPeriod; period++) {
          const key = `${extraDate}-${period}`;

          if (!periodMap[key]) {
            scheduleData.push({
              type: "extra",
              date: extraDate,
              startPeriod: period,
              endPeriod: period,
              className: row.class_name,
              courseName: row.course_name,
              teacher: row.teacher || "",
              classId: row.class_id,
            });
            periodMap[key] = true;
          }
        }
      }
    });
    

    res.render("schedule", {
      user: req.user,
      days,
      scheduleData,
      courseStart, 
      courseEnd, 
      weekStart: days[0].iso,
      prevWeekStart: new Date(new Date(monday).setDate(monday.getDate() - 7))
        .toISOString()
        .slice(0, 10),
      nextWeekStart: new Date(new Date(monday).setDate(monday.getDate() + 7))
        .toISOString()
        .slice(0, 10),
    });
  });
});



app.get(
  "/classes",
  checkAuthenticated,
  authenticateRole(["admin", "teacher"]),
  async (req, res) => {
    try {
      const query = `
      SELECT 
        c.id, 
        c.class_name,
        c.weekly_schedule,
        co.course_name,
        t.full_name AS teacher_name,
        CONVERT(VARCHAR(5), c.start_time, 108) as formatted_start_time,
        CONVERT(VARCHAR(5), c.end_time, 108) as formatted_end_time,
        (SELECT COUNT(*) FROM enrollments WHERE class_id = c.id) as student_count
      FROM classes c
      JOIN courses co ON c.course_id = co.id
      JOIN teachers t ON c.teacher_id = t.id
      ORDER BY c.created_at DESC
    `;

      const classes = await executeQuery(query);

      // Process weekly schedule for display
      classes.forEach((cls) => {
        if (cls.weekly_schedule) {
          const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
          cls.scheduleDisplay = cls.weekly_schedule
            .split(",")
            .map((day) => days[parseInt(day) - 1])
            .join(", ");
        } else {
          cls.scheduleDisplay = "No schedule set";
        }
      });

      res.render("classes.ejs", { classes, user: req.user });
    } catch (err) {
      console.error("Fetch classes error:", err);
      res.status(500).send("Error loading classes");
    }
  }
);


// Edit this section in server.js
app.get("/classes", checkAuthenticated, authenticateRole(["admin", "teacher"]), async (req, res) => {
  try {
    const query = `
      SELECT 
        c.*, 
        co.course_name,
        t.full_name AS teacher_name,
        CONVERT(VARCHAR(5), c.start_time, 108) as formatted_start_time,
        CONVERT(VARCHAR(5), c.end_time, 108) as formatted_end_time
      FROM classes c
      JOIN courses co ON c.course_id = co.id
      JOIN teachers t ON c.teacher_id = t.id
      ORDER BY c.created_at DESC
    `;

    const classes = await executeQuery(query);
    res.render("classes.ejs", { classes, user: req.user });
  } catch (err) {
    console.error("Fetch classes error:", err);
    res.status(500).send("Error loading classes");
  }
});

app.post(
  "/classes/:id",
  checkAuthenticated,
  authenticateRole(["admin", "teacher"]),
  async (req, res) => {
    try {
      const {
        class_name,
        course_id,
        teacher_id,
        start_time,
        end_time,
        weekly_days,
      } = req.body;
      const classId = req.params.id;

      // Input validation
      if (
        !class_name ||
        !course_id ||
        !teacher_id ||
        !start_time ||
        !end_time ||
        !weekly_days
      ) {
        return res.status(400).send("Missing required fields");
      }

      // Convert weekly_days array to comma-separated string
      const weekly_schedule = Array.isArray(weekly_days)
        ? weekly_days.join(",")
        : weekly_days;

      const updateQuery = `
      UPDATE classes 
      SET class_name = ?,
          course_id = ?,
          teacher_id = ?,
          start_time = ?,
          end_time = ?,
          weekly_schedule = ?,
          updated_at = GETDATE()
      WHERE id = ?
    `;

      await executeQuery(updateQuery, [
        class_name,
        course_id,
        teacher_id,
        start_time,
        end_time,
        weekly_schedule,
        classId,
      ]);

      res.redirect("/classes");
    } catch (error) {
      console.error("Error updating class:", error);
      res.status(500).send("Failed to update class");
    }
  }
);

app.get(
  "/classes/:id/edit",
  checkAuthenticated,
  authenticateRole(["admin", "teacher"]),
  async (req, res) => {
    try {
      const classId = req.params.id;
      // Lấy thông tin lớp học
      const classQuery = `
        SELECT 
          c.*, 
          CONVERT(varchar(5), c.start_time, 108) as formatted_start_time,
          CONVERT(varchar(5), c.end_time, 108) as formatted_end_time
        FROM classes c
        WHERE c.id = ?
      `;
      // Lấy danh sách khóa học
      const courseQuery = `SELECT id, course_name FROM courses ORDER BY course_name`;
      // Lấy danh sách giáo viên
      const teacherQuery = `SELECT id, full_name FROM teachers ORDER BY full_name`;

      const [classResult, courses, teachers] = await Promise.all([
        executeQuery(classQuery, [classId]),
        executeQuery(courseQuery),
        executeQuery(teacherQuery),
      ]);

      if (!classResult.length) {
        return res.status(404).send("Class not found");
      }

      // Đổi tên trường cho EJS
      const classItem = {
        ...classResult[0],
        course_id: classResult[0].course_id,
        teacher_id: classResult[0].teacher_id,
        class_name: classResult[0].class_name,
        formatted_start_time: classResult[0].formatted_start_time,
        formatted_end_time: classResult[0].formatted_end_time,
        weekly_schedule: classResult[0].weekly_schedule,
      };

      // Đổi tên trường cho EJS dropdown
      const courseList = courses.map(c => ({
        id: c.id,
        name: c.course_name
      }));
      const teacherList = teachers.map(t => ({
        id: t.id,
        name: t.full_name
      }));

      res.render("editClass.ejs", {
        user: req.user,
        classItem,
        courses: courseList,
        teachers: teacherList,
      });
    } catch (error) {
      console.error("Error loading class edit form:", error);
      res.status(500).send("Error loading class edit form");
    }
  }
);

app.delete(
  "/classes/:id",
  checkAuthenticated,
  authenticateRole(["admin", "teacher"]),
  async (req, res) => {
    try {
      const classId = req.params.id;

      // Check if class exists and get related info
      const checkQuery = `
        SELECT c.id, c.class_name, COUNT(e.id) as enrollment_count
        FROM classes c
        LEFT JOIN enrollments e ON c.id = e.class_id
        WHERE c.id = ?
        GROUP BY c.id, c.class_name
      `;

      const classInfo = await executeQuery(checkQuery, [classId]);

      if (!classInfo.length) {
        return res.status(404).json({
          error: "Class not found",
          code: "CLASS_NOT_FOUND",
        });
      }

      // Check for existing enrollments
      if (classInfo[0].enrollment_count > 0) {
        return res.status(400).json({
          error: "Cannot delete class with active enrollments",
          code: "HAS_ENROLLMENTS",
          details: {
            className: classInfo[0].class_name,
            enrollmentCount: classInfo[0].enrollment_count,
          },
        });
      }

      // First delete related schedules
      await executeQuery("DELETE FROM schedules WHERE class_id = ?", [classId]);

      // Then delete the class
      await executeQuery("DELETE FROM classes WHERE id = ?", [classId]);

      // Send success response
      res.redirect("/classes");
    } catch (error) {
      console.error("Class deletion error:", {
        classId: req.params.id,
        error: error.message,
        stack: error.stack,
      });

      res.status(500).json({
        error: "Failed to delete class",
        code: "DELETE_FAILED",
        message: error.message,
      });
    }
  }
);

app.post(
  "/classes",
  checkAuthenticated,
  authenticateRole(["admin", "teacher"]),
  async (req, res) => {
    try {
      const {
        class_name,
        course_id,
        teacher_id,
        start_time,
        end_time,
        weekly_days,
      } = req.body;

      // Input validation
      if (
        !class_name ||
        !course_id ||
        !teacher_id ||
        !start_time ||
        !end_time ||
        !weekly_days
      ) {
        req.flash("error", "Missing required fields");
        return res.redirect("/classes/new");
      }

      // Convert weekly_days array to comma-separated string
      const weekly_schedule = Array.isArray(weekly_days)
        ? weekly_days.join(",")
        : weekly_days;

      // Validate course dates
      const courseQuery = `
      SELECT start_date, end_date 
      FROM courses 
      WHERE id = ?
    `;
      const courseResult = await executeQuery(courseQuery, [course_id]);

      if (!courseResult.length) {
        req.flash("error", "Course not found");
        return res.redirect("/classes/new");
      }

      // Check teacher availability
      const teacherQuery = `
      SELECT id FROM classes 
      WHERE teacher_id = ? 
      AND ((start_time <= ? AND end_time >= ?) 
        OR (start_time <= ? AND end_time >= ?))
      AND weekly_schedule LIKE ?
    `;

      const teacherConflicts = await executeQuery(teacherQuery, [
        teacher_id,
        start_time,
        start_time,
        end_time,
        end_time,
        `%${weekly_schedule}%`,
      ]);

      if (teacherConflicts.length > 0) {
        req.flash(
          "error",
          "Teacher has conflicting classes during these times"
        );
        return res.redirect("/classes/new");
      }

      const query = `
      INSERT INTO classes (
        class_name, 
        course_id, 
        teacher_id, 
        start_time, 
        end_time, 
        weekly_schedule,
        created_at, 
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, GETDATE(), GETDATE())
    `;

      await executeQuery(query, [
        class_name,
        course_id,
        teacher_id,
        start_time,
        end_time,
        weekly_schedule,
      ]);

      req.flash("success", "Class created successfully");
      res.redirect("/classes");
    } catch (err) {
      console.error("Create class error:", err);
      req.flash("error", "Failed to create class");
      res.redirect("/classes/new");
    }
  }
);
app.get(
  "/enrollments",
  checkAuthenticated,
  authenticateRole("admin"),
  (req, res) => {
    const query = `
    SELECT 
      e.id, 
      s.full_name AS student_name, 
      c.class_name,
      co.tuition_fee,
      e.enrollment_date,
      e.payment_status,
      e.payment_date
    FROM enrollments e
    JOIN students s ON e.student_id = s.id
    JOIN classes c ON e.class_id = c.id
    JOIN courses co ON c.course_id = co.id
    ORDER BY e.enrollment_date DESC
  `;

    sql.query(connectionString, query, (err, rows) => {
      if (err) {
        console.error("Fetch enrollments error:", err);
        return res.status(500).send("Database error");
      }
      res.render("enrollments.ejs", {
        enrollments: rows,
        user: req.user,
      });
    });
  }
);


app.delete(
  "/enrollments/:id",
  checkAuthenticated,
  authenticateRole("admin"),
  async (req, res) => {
    try {
      const enrollmentId = req.params.id;

      // First check if enrollment exists
      const checkQuery = `
        SELECT e.id, e.student_id, s.full_name, c.class_name 
        FROM enrollments e
        JOIN students s ON e.student_id = s.id
        JOIN classes c ON e.class_id = c.id
        WHERE e.id = ?
      `;

      const enrollment = await executeQuery(checkQuery, [enrollmentId]);

      if (!enrollment.length) {
        return res.status(404).json({
          error: "Enrollment not found",
          code: "ENROLLMENT_NOT_FOUND",
        });
      }

      // Log deletion attempt for audit
      console.log("Deleting enrollment:", {
        id: enrollmentId,
        student: enrollment[0].full_name,
        class: enrollment[0].class_name,
      });

      // Delete enrollment
      const deleteQuery = "DELETE FROM enrollments WHERE id = ?";
      await executeQuery(deleteQuery, [enrollmentId]);

      // Add notification for student
      const notifyQuery = `
        INSERT INTO notifications (user_id, message, sent_at)
        VALUES ((SELECT user_id FROM students WHERE id = ?), ?, GETDATE())
      `;

      await executeQuery(notifyQuery, [
        enrollment[0].student_id,
        `Your enrollment in ${enrollment[0].class_name} has been cancelled.`,
      ]);

      res.redirect("/enrollments");
    } catch (error) {
      console.error("Enrollment deletion error:", {
        enrollmentId: req.params.id,
        error: error.message,
        stack: error.stack,
      });

      res.status(500).json({
        error: "Failed to delete enrollment",
        code: "DELETE_FAILED",
        message: "An error occurred while deleting the enrollment",
      });
    }
  }
);

// Add route to toggle payment status
app.post(
  "/enrollments/:id/toggle-payment",
  checkAuthenticated,
  authenticateRole("admin"),
  (req, res) => {
    const query = `
    UPDATE enrollments 
    SET 
      payment_status = ~payment_status,
      payment_date = CASE 
        WHEN payment_status = 0 THEN GETDATE()
        ELSE NULL 
      END,
      updated_at = GETDATE()
    WHERE id = ?
  `;

    sql.query(connectionString, query, [req.params.id], (err) => {
      try {
        if (err) {
          console.error("Update payment status error:", err);
          if (!res.headersSent) {
            return res.status(500).json({ error: "Update failed" });
          }
        }
        if (!res.headersSent) {
          res.json({ success: true });
        }
      } catch (error) {
        // Only log non-headers-sent errors
        if (error.code !== "ERR_HTTP_HEADERS_SENT") {
          console.error("Error in payment toggle:", error);
        }
      }
    });
  }
);

app.get(
  "/enrollments/:id/edit",
  checkAuthenticated,
  authenticateRole("admin"),
  async (req, res) => {
    try {
      const id = req.params.id;

      // Get enrollment details with related info
      const enrollmentQuery = `
        SELECT 
          e.*,
          s.full_name AS student_name,
          c.class_name,
          co.course_name,
          co.tuition_fee
        FROM enrollments e
        JOIN students s ON e.student_id = s.id
        JOIN classes c ON e.class_id = c.id
        JOIN courses co ON c.course_id = co.id
        WHERE e.id = ?
      `;

      // Get available students and classes for dropdown
      const studentQuery = `
        SELECT s.id, s.full_name, s.email 
        FROM students s
        LEFT JOIN enrollments e ON s.id = e.student_id
        GROUP BY s.id, s.full_name, s.email
      `;

      const classQuery = `
        SELECT 
          c.id, 
          c.class_name,
          co.course_name,
          t.full_name AS teacher_name,
          co.start_date,
          co.end_date
        FROM classes c
        JOIN courses co ON c.course_id = co.id
        JOIN teachers t ON c.teacher_id = t.id
        WHERE co.end_date >= GETDATE()
      `;

      const [enrollment, students, classes] = await Promise.all([
        executeQuery(enrollmentQuery, [id]),
        executeQuery(studentQuery),
        executeQuery(classQuery),
      ]);

      if (!enrollment.length) {
        return res.status(404).send("Enrollment not found");
      }

      res.render("editEnrollment.ejs", {
        enrollment: enrollment[0],
        students,
        classes,
        user: req.user,
      });
    } catch (err) {
      console.error("Error loading enrollment edit form:", err);
      res.status(500).send("Error loading enrollment edit form");
    }
  }
);

app.get(
  "/enrollments/new",
  checkAuthenticated,
  authenticateRole("admin"),
  async (req, res) => {
    try {
      // Get students with enrollment counts and payment status
      const studentQuery = `
        SELECT 
          s.id, 
          s.full_name, 
          s.email,
          s.phone_number,
          COUNT(e.id) as enrolled_count,
          SUM(CASE WHEN e.payment_status = 0 THEN 1 ELSE 0 END) as unpaid_enrollments
        FROM students s
        LEFT JOIN enrollments e ON s.id = e.student_id
        GROUP BY 
          s.id, 
          s.full_name, 
          s.email,
          s.phone_number
        ORDER BY s.full_name
      `;

      // Get active classes with detailed info and capacity
      const classQuery = `
        SELECT 
          c.id,
          c.class_name,
          co.course_name,
          co.tuition_fee,
          t.full_name AS teacher_name,
          co.start_date,
          co.end_date,
          c.weekly_schedule,
          CONVERT(VARCHAR(5), c.start_time, 108) as start_time,
          CONVERT(VARCHAR(5), c.end_time, 108) as end_time,
          (SELECT COUNT(*) FROM enrollments WHERE class_id = c.id) as enrolled_count,
          CASE 
            WHEN co.end_date < GETDATE() THEN 'Ended'
            WHEN co.start_date > GETDATE() THEN 'Upcoming'
            ELSE 'Active'
          END as status
        FROM classes c
        JOIN courses co ON c.course_id = co.id
        JOIN teachers t ON c.teacher_id = t.id
        WHERE co.end_date >= GETDATE()
        ORDER BY co.start_date ASC, c.class_name
      `;

      const [students, classes] = await Promise.all([
        executeQuery(studentQuery),
        executeQuery(classQuery),
      ]);

      // Process class data to include availability info
      const enhancedClasses = classes.map((cls) => ({
        ...cls,
        isAvailable: cls.status !== "Ended",
        schedule: cls.weekly_schedule
          .split(",")
          .map((day) => {
            const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
            return days[parseInt(day) - 1];
          })
          .join(", "),
        timeSlot: `${cls.start_time} - ${cls.end_time}`,
      }));

      res.render("Addenrollments.ejs", {
        students: students.map((s) => ({
          ...s,
          hasUnpaidFees: s.unpaid_enrollments > 0,
        })),
        classes: enhancedClasses,
        user: req.user,
        currentDate: new Date().toISOString().split("T")[0],
        errors: req.flash("error"),
        success: req.flash("success"),
      });
    } catch (err) {
      console.error("Error loading enrollment form:", {
        error: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString(),
      });

      req.flash("error", "Failed to load enrollment form");
      res.status(500).send("Error loading enrollment form");
    }
  }
);

app.post(
  "/enrollments",
  checkAuthenticated,
  authenticateRole("admin"),
  async (req, res) => {
    const { student_id, class_id } = req.body;

    try {
      // 1. Validate input
      if (!student_id || !class_id) {
        return res.status(400).json({
          error: "Missing required fields",
          code: "INVALID_INPUT",
        });
      }

      // 2. Check if student exists
      const studentQuery = "SELECT id FROM students WHERE id = ?";
      const student = await executeQuery(studentQuery, [student_id]);

      if (!student.length) {
        return res.status(404).json({
          error: "Student not found",
          code: "STUDENT_NOT_FOUND",
        });
      }

      // 3. Check if class exists and is active
      const classQuery = `
      SELECT c.id, c.class_name, co.start_date, co.end_date 
      FROM classes c
      JOIN courses co ON c.course_id = co.id
      WHERE c.id = ?`;
      const classInfo = await executeQuery(classQuery, [class_id]);

      if (!classInfo.length) {
        return res.status(404).json({
          error: "Class not found",
          code: "CLASS_NOT_FOUND",
        });
      }

      // 4. Check if enrollment already exists
      const duplicateQuery = `
      SELECT id FROM enrollments 
      WHERE student_id = ? AND class_id = ?`;
      const existing = await executeQuery(duplicateQuery, [
        student_id,
        class_id,
      ]);

      if (existing.length) {
        return res.status(409).json({
          error: "Student already enrolled in this class",
          code: "DUPLICATE_ENROLLMENT",
        });
      }

      // 5. Create enrollment
      const insertQuery = `
      INSERT INTO enrollments (
        student_id, 
        class_id, 
        enrollment_date,
        payment_status,
        updated_at
      )
      VALUES (?, ?, GETDATE(), 0, GETDATE())
    `;
    
      await executeQuery(insertQuery, [student_id, class_id]);

      // 6. Add notification for student
      const notifyQuery = `
      INSERT INTO notifications (
        user_id,
        message,
        sent_at,
        created_at,
        updated_at
      )
      VALUES (?, ?, GETDATE(), GETDATE(), GETDATE())
    `;
    
      await executeQuery(notifyQuery, [
        student_id,
        `You have been enrolled in ${classInfo[0].class_name}`,
      ]);

      req.flash("success", "Enrollment created successfully");
      res.redirect("/enrollments");
    } catch (error) {
      console.error("Enrollment creation error:", {
        error: error.message,
        stack: error.stack,
        student_id,
        class_id,
      });

      req.flash("error", "Failed to create enrollment");
      res.status(500).json({
        error: "Failed to create enrollment",
        code: "CREATE_FAILED",
        message: error.message,
      });
    }
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
  upload.single("material"),
  async (req, res) => {
    try {
      const materialId = req.params.id;
      const { course_id } = req.body;
      const file = req.file;

      // Get current material info
      const currentMaterial = await executeQuery(
        "SELECT * FROM materials WHERE id = ?",
        [materialId]
      );

      if (!currentMaterial.length) {
        return res.status(404).send("Material not found");
      }

      let updateQuery = "UPDATE materials SET course_id = ?";
      let queryParams = [course_id];

      // If new file uploaded, update file info
      if (file) {
        // Delete old file
        const oldFilePath = path.join(__dirname, currentMaterial[0].file_path);
        fs.unlink(oldFilePath, (err) => {
          if (err) console.error("Error deleting old file:", err);
        });

        // Update with new file info
        updateQuery += ", file_name = ?, file_path = ?";
        queryParams.push(
          file.originalname,
          path.join("uploads", file.filename)
        );
      }

      updateQuery += ", updated_at = GETDATE() WHERE id = ?";
      queryParams.push(materialId);

      await executeQuery(updateQuery, queryParams);
      res.redirect("/materials");
    } catch (error) {
      console.error("Error updating material:", error);

      // Delete uploaded file if there was an error
      if (req.file) {
        const filePath = path.join(__dirname, "uploads", req.file.filename);
        fs.unlink(filePath, (err) => {
          if (err) console.error("Error deleting file:", err);
        });
      }

      res.status(500).send("Failed to update material");
    }
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
  async (req, res) => {
    try {
     

      const { username, role, full_name, email, phone_number } = req.body;
      const userId = req.params.id;

      const updateQuery = `
        BEGIN TRY
          BEGIN TRANSACTION;
          
          UPDATE users 
          SET username = ?, 
              role = ?, 
              updated_at = GETDATE()
          WHERE id = ?;

          IF ? = 'student'
          BEGIN
            DELETE FROM teachers WHERE user_id = ?;
            DELETE FROM admins WHERE user_id = ?;
            
            IF EXISTS (SELECT 1 FROM students WHERE user_id = ?)
              UPDATE students 
              SET full_name = ?, email = ?, phone_number = ?, updated_at = GETDATE()
              WHERE user_id = ?
            ELSE
              INSERT INTO students (user_id, full_name, email, phone_number, created_at, updated_at)
              VALUES (@NewUserId, ?, ?, ?, GETDATE(), GETDATE());
          END
          ELSE IF ? = 'teacher'
          BEGIN
            DELETE FROM students WHERE user_id = ?;
            DELETE FROM admins WHERE user_id = ?;
            
            IF EXISTS (SELECT 1 FROM teachers WHERE user_id = ?)
              UPDATE teachers 
              SET full_name = ?, email = ?, phone_number = ?, updated_at = GETDATE()
              WHERE user_id = ?
            ELSE
              INSERT INTO teachers (user_id, full_name, email, phone_number, created_at, updated_at)
              VALUES (?, ?, ?, ?, GETDATE(), GETDATE());
          END
          ELSE IF ? = 'admin'
          BEGIN
            DELETE FROM students WHERE user_id = ?;
            DELETE FROM teachers WHERE user_id = ?;
            
            IF EXISTS (SELECT 1 FROM admins WHERE user_id = ?)
              UPDATE admins 
              SET full_name = ?, email = ?, phone_number = ?, updated_at = GETDATE()
              WHERE user_id = ?
            ELSE
              INSERT INTO admins (user_id, full_name, email, phone_number, created_at, updated_at)
              VALUES (?, ?, ?, ?, GETDATE(), GETDATE());
          END

          COMMIT TRANSACTION;
        END TRY
        BEGIN CATCH
          IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
          THROW;
        END CATCH
      `;

      const values = [
        // Update users values
        username, role, userId,
        // Student check
        role, userId, userId, userId,
        // Student update/insert values
        full_name, email, phone_number, userId,
        userId, full_name, email, phone_number,
        // Teacher check
        role, userId, userId, userId,
        // Teacher update/insert values
        full_name, email, phone_number, userId,
        userId, full_name, email, phone_number,
        // Admin check
        role, userId, userId, userId,
        // Admin update/insert values
        full_name, email, phone_number, userId,
        userId, full_name, email, phone_number
      ];

      await new Promise((resolve, reject) => {
        sql.query(connectionString, updateQuery, values, (err, result) => {
          if (err) {
            console.error("SQL Error:", err);
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
      if (req.user.role !== "admin") {
        return res.redirect("/profile");
      }else {
      res.redirect("/users");}
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).send("Failed to update user. Error: " + error.message);
    }
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
        tuition_fee = ?,
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
  async (req, res) => {
    try {
      const scheduleId = req.params.id;
      const { class_id, schedule_date, start_time, end_time, day_of_week } =
        req.body;

      // Debug log
      console.log("Received data:", {
        scheduleId,
        class_id,
        schedule_date,
        start_time,
        end_time,
        day_of_week,
      });

      // Input validation with specific error messages
      const missingFields = [];
      if (!class_id) missingFields.push("Class");
      if (!schedule_date) missingFields.push("Schedule date");
      if (!start_time) missingFields.push("Start time");
      if (!end_time) missingFields.push("End time");
      if (!day_of_week) missingFields.push("Day of week");

      if (missingFields.length > 0) {
        req.flash(
          "error",
          `Missing required fields: ${missingFields.join(", ")}`
        );
        return res.redirect(`/schedules/${scheduleId}/edit`);
      }

      // Get course_id for the class
      const courseQuery = "SELECT course_id FROM classes WHERE id = ?";
      const courseResult = await executeQuery(courseQuery, [class_id]);

      if (!courseResult.length) {
        req.flash("error", "Class not found");
        return res.redirect(`/schedules/${scheduleId}/edit`);
      }

      const course_id = courseResult[0].course_id;

      // Update schedule
      const updateQuery = `
      UPDATE schedules 
      SET class_id = ?,
          course_id = ?,
          day_of_week = ?,
          schedule_date = ?,
          start_time = ?,
          end_time = ?,
          updated_at = GETDATE()
      WHERE id = ?
    `;

      await executeQuery(updateQuery, [
        class_id,
        course_id,
        day_of_week,
        schedule_date,
        start_time,
        end_time,
        scheduleId,
      ]);

      req.flash("success", "Schedule updated successfully");
      res.redirect("/schedules");
    } catch (err) {
      console.error("Update schedule error:", err);
      req.flash("error", "Failed to update schedule");
      res.redirect(`/schedules/${req.params.id}/edit`);
    }
  }
);


app.get(
  "/schedules/new",
  checkAuthenticated,
  authenticateRole("admin"),
  async (req, res) => {
    try {
      // Get active classes with course and teacher info
      const query = `
      SELECT 
        c.id,
        c.class_name,
        co.id as course_id, 
        co.course_name,
        t.full_name as teacher_name,
        co.start_date,
        co.end_date
      FROM classes c
      JOIN courses co ON c.course_id = co.id
      JOIN teachers t ON c.teacher_id = t.id
      WHERE co.end_date >= GETDATE()
      ORDER BY co.start_date ASC, c.class_name
    `;

      const classes = await executeQuery(query);

      res.render("newSchedule.ejs", {
        user: req.user,
        classes: classes,
        currentDate: new Date().toISOString().split("T")[0],
      });
    } catch (err) {
      console.error("Error loading schedule form:", err);
      res.status(500).send("Error loading schedule form");
    }
  }
);

app.delete(
  "/schedules/:id",
  checkAuthenticated,
  authenticateRole("admin"),
  async (req, res) => {
    try {
      const scheduleId = req.params.id;

      // Check if schedule exists
      const checkQuery = "SELECT id FROM schedules WHERE id = ?";
      const schedule = await executeQuery(checkQuery, [scheduleId]);

      if (!schedule.length) {
        return res.status(404).send("Schedule not found");
      }

      // Delete schedule
      await executeQuery("DELETE FROM schedules WHERE id = ?", [scheduleId]);

      res.redirect("/schedules");
    } catch (err) {
      console.error("Delete schedule error:", err);
      res.status(500).send("Failed to delete schedule");
    }
  }
);


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
app.get(
  "/available-courses",
  checkAuthenticated,
  authenticateRole("student"),
  async (req, res) => {
    try {
      const query = `
        SELECT DISTINCT
          c.id as course_id,
          c.course_name,
          c.description,
          c.start_date,
          c.end_date,
          c.tuition_fee,
          cls.id as class_id,
          cls.class_name,
          cls.start_time,
          cls.end_time,
          cls.weekly_schedule,
          t.full_name as teacher_name,
          (SELECT COUNT(*) FROM enrollments WHERE class_id = cls.id) as enrolled_count
        FROM courses c
        JOIN classes cls ON c.id = cls.course_id
        JOIN teachers t ON cls.teacher_id = t.id
        WHERE c.start_date > GETDATE()
        AND NOT EXISTS (
          SELECT 1 
          FROM enrollments e
          JOIN students s ON e.student_id = s.id
          WHERE s.user_id = ?
          AND e.class_id = cls.id
        )
        ORDER BY c.start_date ASC
      `;

      const courses = await executeQuery(query, [req.user.id]);

      // Get student information
      const studentQuery = `
        SELECT id, full_name, email 
        FROM students 
        WHERE user_id = ?
      `;
      const studentInfo = await executeQuery(studentQuery, [req.user.id]);

      res.render("availableCourses.ejs", {
        courses: courses,
        student: studentInfo[0],
        user: req.user
      });
    } catch (err) {
      console.error("Error fetching available courses:", err);
      res.status(500).send("Error loading available courses");
    }
  }
);




app.post("/enroll-course", checkAuthenticated, authenticateRole("student"), async (req, res) => {
  try {
    const { class_id } = req.body;
    
    // Get student ID
    const studentQuery = "SELECT id FROM students WHERE user_id = ?";
    const student = await executeQuery(studentQuery, [req.user.id]);
    
    if (!student.length) {
      return res.status(404).send("Student not found");
    }

    // Check if class exists and if student is already enrolled
    const checkEnrollmentQuery = `
      SELECT 
        c.id as class_id,
        c.course_id,
        co.tuition_fee,
        (SELECT COUNT(*) FROM enrollments WHERE class_id = c.id) as enrolled_count,
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM enrollments e 
            WHERE e.class_id = c.id 
            AND e.student_id = ?
          ) THEN 1 
          ELSE 0 
        END as is_enrolled
      FROM classes c
      JOIN courses co ON c.course_id = co.id
      WHERE c.id = ?
    `;
    
    const classInfo = await executeQuery(checkEnrollmentQuery, [student[0].id, class_id]);
    
    if (!classInfo.length) {
      return res.status(404).send("Class not found");
    }

    if (classInfo[0].is_enrolled) {
      return res.status(400).send("You are already enrolled in this class");
    }

    // Create enrollment
    const insertQuery = `
      INSERT INTO enrollments (
        student_id, 
        class_id, 
        enrollment_date,
        payment_status,
        updated_at
      )
      VALUES (?, ?, GETDATE(), 0, GETDATE())
    `;
    
    await executeQuery(insertQuery, [student[0].id, class_id]);

    // Create notification
    const notifyQuery = `
      INSERT INTO notifications (
        user_id,
        message,
        sent_at,
        created_at,
        updated_at
      )
      VALUES (?, ?, GETDATE(), GETDATE(), GETDATE())
    `;
    
    await executeQuery(notifyQuery, [
      req.user.id,
      'You have successfully enrolled in a new course. Please complete the payment.'
    ]);

    res.redirect("/my-courses");
  } catch (err) {
    console.error("Enrollment error:", err);
    res.status(500).send("Failed to enroll in course");
  }
});


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
