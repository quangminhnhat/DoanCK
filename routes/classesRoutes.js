const express = require("express");
const sql = require("msnodesqlv8");
const { authenticateRole } = require("../middleware/roleAuth");
const connectionString = process.env.CONNECTION_STRING; 
const executeQuery = require("../middleware/executeQuery");
const {
  checkAuthenticated,
} = require("../middleware/auth");
const router = express.Router();


router.get(
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

router.get("/classes", checkAuthenticated, authenticateRole(["admin", "teacher"]), async (req, res) => {
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


router.post(
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


router.get(
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

router.delete(
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


router.post(
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

router.get(
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

module.exports = router;