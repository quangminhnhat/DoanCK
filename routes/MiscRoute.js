const express = require("express");
const app = express();
const path = require("path");
const bcrypt = require("bcrypt");
const sql = require("msnodesqlv8");
const passport = require("passport");
const flash = require("express-flash");
const session = require("express-session");
const methodOverride = require("method-override");
const { authenticateRole } = require("../middleware/roleAuth");
const multer = require("multer");
const fs = require("fs");
const connectionString = process.env.CONNECTION_STRING;
const upload = require("../middleware/upload");
const courseImageUpload = require("../middleware/courseImageUpload");
const executeQuery = require("../middleware/executeQuery");
const {
  checkAuthenticated,
  checkNotAuthenticated,
} = require("../middleware/auth");
const router = express.Router();


const mapRole = {
  subject1: "student",
  subject2: "teacher",
  subject3: "admin",
};

router.get("/download/:id", checkAuthenticated, async (req, res) => {
  try {
    const materialId = req.params.id;
    const query = "SELECT file_name, file_path FROM materials WHERE id = ?";
    const result = await executeQuery(query, [materialId]);
    if (!result.length) {
      return res.status(404).send("File not found");
    }
    const filePath = path.join(__dirname, "..", result[0].file_path);
    res.download(filePath, result[0].file_name);
  } catch (error) {
    console.error("Download error:", error);
    res.status(500).send("Download failed");
  }
});


router.get("/", async (req, res) => {
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

router.get("/school", (req, res) => {
  res.render("school.ejs", { user: req.user });
});

router.get("/news", (req, res) => {
  res.render("news.ejs", { user: req.user });
});

router.get(
  "/upload",
  authenticateRole(["admin", "teacher"]),
  checkAuthenticated,
  (req, res) => {
    res.render("uploadMaterial.ejs", { user: req.user });
  }
);

router.get("/profile", checkAuthenticated, (req, res) => {
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

router.get(
  "/register",
  checkAuthenticated,
  authenticateRole("admin"),
  (req, res) => {
    res.render("register.ejs", {
      user: req.user,
    });
  }
);

router.post(
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



module.exports = router;
