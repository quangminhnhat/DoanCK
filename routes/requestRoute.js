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
const validateSchedule = require("../middleware/validateSchedule");

const router = express.Router();

// Add these new routes before the existing POST/PUT/DELETE routes

// Render request list page
router.get(
  "/requests",
  checkAuthenticated,
  authenticateRole(["student", "teacher", "admin"]),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;
      
      let requestQuery = `
        SELECT r.request_id, r.description, r.status, r.created_at,
               rt.type_name, c.class_name, u.username
        FROM Requests r
        JOIN RequestTypes rt ON r.type_id = rt.type_id
        JOIN users u ON r.user_id = u.id
        LEFT JOIN classes c ON r.class_id = c.id
      `;

      let params = {};
      
      // Filter based on role
      if (userRole === 'student' || userRole === 'teacher') {
        requestQuery += ` WHERE r.user_id = CAST(@userId AS INT)`;
        params.userId = userId;
      }
      
      requestQuery += ` ORDER BY r.created_at DESC`;

      const requests = await executeQuery(requestQuery, params);

      res.render("requestsindex.ejs", {
        user: req.user,
        requests,
        userRole,
        title: "Request List",
      });
    } catch (error) {
      console.error("Error fetching requests:", error);
      res.status(500).render('error', { 
        message: 'Error loading requests'
      });
    }
  }
);

// Render new request form
router.get(
  "/requests/new",
  checkAuthenticated,
  authenticateRole(["student", "teacher"]),
  async (req, res) => {
    try {
      // Get available request types for user role
      const typeQuery = `
        SELECT type_id, type_name 
        FROM RequestTypes 
        WHERE applicable_to = @role
      `;
      
      const requestTypes = await executeQuery(typeQuery, {
        role: req.user.role
      });

      // Get available classes for the user
      const classQuery = req.user.role === 'student' ? 
        `SELECT c.id, c.class_name 
         FROM classes c
         JOIN enrollments e ON c.id = e.class_id
         JOIN students s ON e.student_id = s.id
         WHERE s.user_id = @userId` :
        `SELECT c.id, c.class_name 
         FROM classes c
         JOIN teachers t ON c.teacher_id = t.id
         WHERE t.user_id = @userId`;

      const classes = await executeQuery(classQuery, {
        userId: req.user.id
      });

      res.render("requestsnew.ejs", {
        user: req.user,
        requestTypes,
        classes,
        title: "New Request",
      });
    } catch (error) {
      console.error("Error loading request form:", error);
      res.status(500).render('error', {
        message: 'Error loading request form'
      });
    }
  }
);

// Render edit request form
router.get(
  "/requests/:requestId/edit",
  checkAuthenticated,
  authenticateRole(["student", "teacher"]),
  async (req, res) => {
    try {
      const { requestId } = req.params;
      const userId = req.user.id;

      // Get request details
      const requestQuery = `
        SELECT r.*, rt.type_name, c.class_name
        FROM Requests r
        JOIN RequestTypes rt ON r.type_id = rt.type_id
        LEFT JOIN classes c ON r.class_id = c.id
        WHERE r.request_id = @requestId 
        AND r.user_id = @userId
      `;

      const [request] = await executeQuery(requestQuery, {
        requestId,
        userId
      });

      if (!request) {
        return res.status(404).render('error', {
          message: 'Request not found'
        });
      }

      // Get available classes (same as new request form)
      const classQuery = req.user.role === 'student' ? 
        `SELECT c.id, c.class_name 
         FROM classes c
         JOIN enrollments e ON c.id = e.class_id
         JOIN students s ON e.student_id = s.id
         WHERE s.user_id = @userId` :
        `SELECT c.id, c.class_name 
         FROM classes c
         JOIN teachers t ON c.teacher_id = t.id
         WHERE t.user_id = @userId`;

      const classes = await executeQuery(classQuery, {
        userId
      });

      res.render("requestsedit.ejs", {
        user: req.user,
        request,
        classes,
        title: "Edit Request",
      });
    } catch (error) {
      console.error("Error loading edit form:", error);
      res.status(500).render('error', {
        message: 'Error loading edit form'
      });
    }
  }
);


// Create a new request

router.post(
  "/requestAdd",
  checkAuthenticated,
  authenticateRole(["student", "teacher"]),
  async (req, res) => {
    const { userId, requestType, details, classId } = req.body;
    const senderRole = req.user.role;

    try {
      // Get request type ID from RequestTypes table (use named params so Unicode matches)
      const typeQuery = `SELECT type_id FROM RequestTypes WHERE type_name = @typeName AND applicable_to = @role`;
      const typeResult = await executeQuery(typeQuery, {
        typeName: requestType,
        role: senderRole
      });

      if (!typeResult || typeResult.length === 0) {
        return res.status(400).json({ error: "Invalid request type for your role" });
      }

      const typeId = typeResult[0].type_id;

      // Insert the request
      const insertQuery = `
        INSERT INTO Requests (user_id, type_id, class_id, description, status)
        VALUES (@userId, @typeId, @classId, @details, 'pending')
      `;

      await executeQuery(insertQuery, {
        userId: userId,
        typeId: typeId,
        classId: classId,
        details: details
      });

      // If it's a class-related request, notify relevant users
      if (classId) {
        const notifyQuery = `
          INSERT INTO notifications (user_id, message, sender_id)
          SELECT 
            CASE 
              WHEN u.role = 'teacher' THEN (SELECT TOP 1 user_id FROM admins)
              ELSE (SELECT TOP 1 t.user_id FROM teachers t 
                    INNER JOIN classes c ON t.id = c.teacher_id 
                    WHERE c.id = @classId)
            END,
            @message,
            @senderId
          FROM users u WHERE u.id = @userId
        `;

        await executeQuery(notifyQuery, {
          classId: classId,
          message: `New ${requestType} request from ${req.user.username}`,
          senderId: userId,
          userId: userId
        });
      }

      res.status(200).json({ message: "Request submitted successfully" });

    } catch (error) {
      console.error("Error submitting request:", error);
      res.status(500).json({ error: "Failed to submit request" });
    }
  }
);

router.delete(
  "/requestDelete/:requestId",
  checkAuthenticated,
  authenticateRole(["student", "teacher", "admin"]),
  async (req, res) => {
    const requestId = req.params.requestId;
    const userId = req.user.id;

    try {
      // First check if request exists and belongs to user
      const checkQuery = `
        SELECT status 
        FROM Requests 
        WHERE request_id = @requestId 
        AND user_id = @userId
      `;

      const request = await executeQuery(checkQuery, {
        requestId: requestId,
        userId: userId
      });

      if (!request || request.length === 0) {
        return res.status(404).json({ 
          error: "Request not found or you don't have permission to delete it" 
        });
      }

      // Only allow deletion of pending requests
      if (request[0].status !== 'pending') {
        return res.status(400).json({
          error: "Only pending requests can be deleted"
        });
      }

      // Delete the request
      const deleteQuery = `
        DELETE FROM Requests 
        WHERE request_id = @requestId 
        AND user_id = @userId 
        AND status = 'pending'
      `;

      await executeQuery(deleteQuery, {
        requestId: requestId,
        userId: userId
      });

      res.status(200).json({ 
        message: "Request deleted successfully" 
      });

    } catch (error) {
      console.error("Error deleting request:", error);
      res.status(500).json({ 
        error: "Failed to delete request" 
      });
    }
  }
);

router.put(
  "/requestEdit/:requestId",
  checkAuthenticated,
  authenticateRole(["student", "teacher"]),
  async (req, res) => {
    const requestId = req.params.requestId;
    const userId = req.user.id;
    const { details, classId } = req.body;

    try {
      // Check if request exists and belongs to user
      const checkQuery = `
        SELECT r.status, r.type_id, rt.type_name, rt.applicable_to
        FROM Requests r
        JOIN RequestTypes rt ON r.type_id = rt.type_id
        WHERE r.request_id = @requestId 
        AND r.user_id = @userId
      `;

      const request = await executeQuery(checkQuery, {
        requestId: requestId,
        userId: userId
      });

      if (!request || request.length === 0) {
        return res.status(404).json({
          error: "Request not found or you don't have permission to edit it"
        });
      }

      // Only allow editing of pending requests
      if (request[0].status !== 'pending') {
        return res.status(400).json({
          error: "Only pending requests can be edited"
        });
      }

      // Update the request
      const updateQuery = `
        UPDATE Requests 
        SET description = @details,
            class_id = @classId,
            updated_at = GETDATE()
        WHERE request_id = @requestId 
        AND user_id = @userId 
        AND status = 'pending'
      `;

      await executeQuery(updateQuery, {
        requestId: requestId,
        userId: userId,
        details: details,
        classId: classId
      });

      // Update notification if class-related request
      if (classId) {
        const notifyQuery = `
          UPDATE notifications
          SET message = @message,
              updated_at = GETDATE()
          WHERE sender_id = @userId
          AND EXISTS (
            SELECT 1 FROM Requests 
            WHERE request_id = @requestId
            AND user_id = @userId
          )
        `;

        await executeQuery(notifyQuery, {
          message: `Updated ${request[0].type_name} request from ${req.user.username}`,
          userId: userId,
          requestId: requestId
        });
      }

      res.status(200).json({
        message: "Request updated successfully"
      });

    } catch (error) {
      console.error("Error updating request:", error);
      res.status(500).json({
        error: "Failed to update request"
      });
    }
  }
);





module.exports = router;
