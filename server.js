if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}
require('events').EventEmitter.defaultMaxListeners = 20;

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





app.get("/", async (req, res) => {
  try {
    const query = `
      SELECT 
        course_name AS title,
        description AS course_desc,
        image_path AS img,
        link
      FROM courses
      ORDER BY created_at DESC
    `;
    const courses = await executeQuery(query);

    res.render("index.ejs", { user: req.user, courses });
  } catch (error) {
    console.error("Error loading homepage courses:", error);
    res.render("index.ejs", { user: req.user, courses: [] });
  }
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

app.get(
  "/upload",
  authenticateRole(["admin", "teacher"]),
  checkAuthenticated,
  (req, res) => {
    res.render("uploadMaterial.ejs", { user: req.user });
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
