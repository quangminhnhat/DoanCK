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

module.exports = router;
