const express = require("express");
const sql = require("msnodesqlv8");
const { authenticateRole } = require("../middleware/roleAuth");
const fs = require("fs");
const connectionString = process.env.CONNECTION_STRING;
const executeQuery = require("../middleware/executeQuery");
const {
  checkAuthenticated,
} = require("../middleware/auth");
const router = express.Router();




router.get("/users", checkAuthenticated, authenticateRole("admin"), async (req, res) => {
  try {
    const query = `
      SELECT u.id, u.username, u.role, u.created_at, u.updated_at,
             u.full_name, u.email, u.phone_number AS phone
      FROM users u
      ORDER BY u.created_at DESC;
    `;
    // The original query with multiple LEFT JOINs and COALESCE is complex and
    // has been simplified since the 'users' table now contains all personal info.
    // If you still need the old structure, you can revert the query string.
    const users = await executeQuery(query);
    res.render("userList", { users: users, user: req.user });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).send("Database error while fetching users.");
  }
});



router.get("/users/:id/edit", checkAuthenticated, async (req, res) => {
  try {
    const userId = req.params.id;
    const query = `
          SELECT u.id, u.username, u.role, u.full_name, u.email, u.phone_number, t.salary
          FROM users u
          LEFT JOIN teachers t ON u.id = t.user_id
          WHERE u.id = ?
        `;

    const result = await executeQuery(query, [userId]);

    if (!result.length) {
      return res.status(404).send("User not found");
    }

    res.render("editUser.ejs", {
      user: req.user,
      editUser: result[0],
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).send("Error loading user data");
  }
});

router.post("/users/:id", checkAuthenticated, async (req, res) => {
  const { username, role, full_name, email, phone_number, salary } = req.body;
  const userId = req.params.id;
  let connection; // Define connection here to be accessible in catch/finally

  try {
    // 1. Get a dedicated connection for the transaction
    connection = await sql.promises.open(connectionString);

    // Start a transaction
    await connection.promises.beginTransaction();

    // 2. Get the current role of the user being edited
    const roleResult = await connection.promises.query("SELECT role FROM users WHERE id = ?", [userId]);
    const oldRole = roleResult.first[0]?.role;

    if (!oldRole) {
      await connection.promises.rollback();
      return res.status(404).send("User not found.");
    }

    // 3. Update the central users table
    const updateUserQuery = `
      UPDATE users 
      SET username = ?, role = ?, full_name = ?, email = ?, phone_number = ?, updated_at = GETDATE()
      WHERE id = ?`;
    await connection.promises.query(updateUserQuery, [username, role, full_name, email, phone_number, userId]);

    // 4. Handle role-specific table changes if the role was modified
    if (oldRole !== role) {
      // Delete from all old role-specific tables to be safe
      await connection.promises.query("DELETE FROM students WHERE user_id = ?", [userId]);
      await connection.promises.query("DELETE FROM teachers WHERE user_id = ?", [userId]);
      await connection.promises.query("DELETE FROM admins WHERE user_id = ?", [userId]);

      // Insert into the new role-specific table
      if (role === "student") {
        await connection.promises.query("INSERT INTO students (user_id) VALUES (?)", [userId]);
      } else if (role === "teacher") {
        await connection.promises.query("INSERT INTO teachers (user_id, salary) VALUES (?, ?)", [userId, salary || 0]);
      } else if (role === "admin") {
        await connection.promises.query("INSERT INTO admins (user_id) VALUES (?)", [userId]);
      }
    } else {
      // If role is teacher and hasn't changed, just update the salary
      if (role === 'teacher' && salary !== undefined) {
        await connection.promises.query("UPDATE teachers SET salary = ? WHERE user_id = ?", [salary, userId]);
      }
    }

    // 5. If all queries succeeded, commit the transaction
    await connection.promises.commit();

    // Redirect based on who made the change
    if (req.user.role !== "admin") {
      return res.redirect("/profile");
    } else {
      return res.redirect("/users");
    }
  } catch (error) {
    console.error("Error updating user:", error);
    if (connection) {
      console.log("Attempting to rollback transaction...");
      await connection.promises.rollback();
    }
    res.status(500).send("An unexpected error occurred. " + error.message);
  } finally {
    if (connection) {
      await connection.promises.close();
    }
  }
});

router.delete("/users/:id", checkAuthenticated, authenticateRole("admin"), async (req, res) => {
  const userIdToDelete = req.params.id;
  const adminUserId = req.user.id;

  // Prevent an admin from deleting themselves
  if (userIdToDelete == adminUserId) {
    req.flash("error", "You cannot delete your own account.");
    return res.redirect("/users");
  }

  let connection;
  try {
    connection = await sql.promises.open(connectionString);
    await connection.promises.beginTransaction();

    // Get user role to check for dependencies
    const userResult = await connection.promises.query("SELECT role FROM users WHERE id = ?", [userIdToDelete]);
    if (!userResult.first || userResult.first.length === 0) {
      req.flash("error", "User not found.");
      await connection.promises.rollback();
      return res.redirect("/users");
    }
    const userRole = userResult.first[0].role;

    // Check for dependencies based on role
    if (userRole === 'student') {
      const studentDeps = await connection.promises.query(`
        SELECT 
          (SELECT COUNT(*) FROM enrollments e JOIN students s ON e.student_id = s.id WHERE s.user_id = ?) as enrollment_count,
          (SELECT COUNT(*) FROM Attempts a JOIN students s ON a.student_id = s.id WHERE s.user_id = ?) as attempt_count
      `, [userIdToDelete, userIdToDelete]);
      
      if (studentDeps.first[0].enrollment_count > 0 || studentDeps.first[0].attempt_count > 0) {
        req.flash("error", "Cannot delete student with existing enrollments or exam attempts.");
        await connection.promises.rollback();
        return res.redirect("/users");
      }
    } else if (userRole === 'teacher') {
      const teacherDeps = await connection.promises.query("SELECT COUNT(*) as class_count FROM classes c JOIN teachers t ON c.teacher_id = t.id WHERE t.user_id = ?", [userIdToDelete]);
      if (teacherDeps.first[0].class_count > 0) {
        req.flash("error", "Cannot delete teacher assigned to active classes.");
        await connection.promises.rollback();
        return res.redirect("/users");
      }
    }

    // If no dependencies, proceed with deletion
    await connection.promises.query("DELETE FROM users WHERE id = ?", [userIdToDelete]);
    await connection.promises.commit();

    req.flash("success", "User deleted successfully.");
    res.redirect("/users");

  } catch (error) {
    console.error("Error deleting user:", error);
    if (connection) await connection.promises.rollback();
    req.flash("error", "Failed to delete user due to a server error.");
    res.redirect("/users");
  } finally {
    if (connection) await connection.promises.close();
  }
});

module.exports = router;
