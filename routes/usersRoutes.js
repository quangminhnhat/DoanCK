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




router.get("/users", checkAuthenticated, authenticateRole("admin"), (req, res) => {
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


router.get("/users/:id/edit", checkAuthenticated, async (req, res) => {
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
      editUser: result[0],
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).send("Error loading user data");
  }
});

router.post("/users/:id", checkAuthenticated, async (req, res) => {
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
      username,
      role,
      userId,
      // Student check
      role,
      userId,
      userId,
      userId,
      // Student update/insert values
      full_name,
      email,
      phone_number,
      userId,
      userId,
      full_name,
      email,
      phone_number,
      // Teacher check
      role,
      userId,
      userId,
      userId,
      // Teacher update/insert values
      full_name,
      email,
      phone_number,
      userId,
      userId,
      full_name,
      email,
      phone_number,
      // Admin check
      role,
      userId,
      userId,
      userId,
      // Admin update/insert values
      full_name,
      email,
      phone_number,
      userId,
      userId,
      full_name,
      email,
      phone_number,
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
    } else {
      res.redirect("/users");
    }
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).send("Failed to update user. Error: " + error.message);
  }
});


router.delete(
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

module.exports = router;
