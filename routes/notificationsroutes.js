const express = require("express");
const app = express();
const sql = require("msnodesqlv8");
const { authenticateRole } = require("../middleware/roleAuth");
const fs = require("fs");
const connectionString = process.env.CONNECTION_STRING; 
const executeQuery = require("../middleware/executeQuery");
const {
  checkAuthenticated,
} = require("../middleware/auth");

const router = express.Router();

router.post(
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


router.get("/notifications", checkAuthenticated, async (req, res) => {
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

router.post("/notifications/:id/read", checkAuthenticated, async (req, res) => {
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

router.delete("/notifications/:id", checkAuthenticated, async (req, res) => {
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

router.get("/notifications", checkAuthenticated, (req, res) => {
  res.render("notifications.ejs", { user: req.user });
});

module.exports = router;