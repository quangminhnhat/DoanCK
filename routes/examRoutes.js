//lib import
const express = require("express");
const router = express.Router();
const path = require("path");
const bcrypt = require("bcrypt");
const sql = require("msnodesqlv8");
const multer = require("multer");
const fs = require("fs");
const { authenticateRole } = require("../middleware/roleAuth");
const executeQuery = require("../middleware/executeQuery");
const {
  checkAuthenticated,
  checkNotAuthenticated,
} = require("../middleware/auth");

// Configure multer for question media uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = 'uploads/exam_media';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// Get exams based on user role
router.get('/exams/all', checkAuthenticated, async (req, res) => {
  try {
    let query = '';
    const userRole = req.user.role.toLowerCase();

    if (userRole === 'admin') {
      // Admin can see all exams
      query = `
        SELECT e.*, t.full_name as teacher_name 
        FROM Exams e 
        JOIN teachers te ON e.teachers_id = te.id
        JOIN users t ON te.user_id = t.id
      `;
    } else if (userRole === 'teacher') {
      // Teachers can only see their own exams
      query = `
        SELECT e.*, t.full_name as teacher_name 
        FROM Exams e 
        JOIN teachers te ON e.teachers_id = te.id
        JOIN users t ON te.user_id = t.id
        WHERE te.user_id = ${req.user.id}
      `;
    } else if (userRole === 'student') {
      // Get both assigned and attempted exams for students, including separate assignments of the same exam in different classes
      query = `
        WITH LatestAttempts AS (
          SELECT 
            assignment_id,
            attempt_id,
            total_score,
            status as attempt_status,
            COUNT(*) OVER (PARTITION BY assignment_id, student_id) as attempt_count,
            ROW_NUMBER() OVER (PARTITION BY assignment_id, student_id ORDER BY attempt_no DESC) as rn
          FROM Attempts
          WHERE status != 'in_progress' AND student_id = (
            SELECT id FROM students WHERE user_id = ${req.user.id}
          )
        )
        SELECT DISTINCT
          e.*,
          t.full_name as teacher_name,
          CASE 
            WHEN a.attempt_status = 'completed' THEN 'Completed'
            WHEN a.attempt_status = 'in_progress' THEN 'In Progress'
            WHEN ea.open_at <= GETDATE() AND ea.close_at >= GETDATE() AND 
                 (a.attempt_count IS NULL OR 
                  (ea.max_attempts IS NULL OR a.attempt_count < ea.max_attempts)) THEN 'Available'
            WHEN ea.open_at > GETDATE() THEN 'Upcoming'
            ELSE 'Expired'
          END as exam_status,
          CASE 
            WHEN a.attempt_status = 'in_progress' THEN 0
            WHEN ea.open_at <= GETDATE() AND ea.close_at >= GETDATE() AND 
                 (a.attempt_count IS NULL OR 
                  (ea.max_attempts IS NULL OR a.attempt_count < ea.max_attempts)) THEN 1
            WHEN ea.open_at > GETDATE() THEN 2
            ELSE 3
          END as status_order,
          a.total_score,
          a.attempt_status,
          ea.open_at,
          ea.close_at,
          ea.assignment_id,
          ea.max_attempts,
          ISNULL(a.attempt_count, 0) as attempt_count,
          s.id as student_id,
          en.class_id,
          c.class_name
        FROM Exams e 
        JOIN teachers te ON e.teachers_id = te.id
        JOIN users t ON te.user_id = t.id
        JOIN ExamAssignments ea ON e.exam_id = ea.exam_id
        JOIN classes c ON ea.classes_id = c.id
        JOIN enrollments en ON c.id = en.class_id AND en.student_id = (
          SELECT id FROM students WHERE user_id = ${req.user.id}
        )
        JOIN students s ON s.id = en.student_id
        LEFT JOIN LatestAttempts a ON ea.assignment_id = a.assignment_id AND a.rn = 1
        WHERE s.user_id = ${req.user.id}
        ORDER BY status_order, ea.open_at ASC
      `;
    } else {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    const exams = await executeQuery(query);
    res.json(exams);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching exams" });
  }
});

// Create new exam
router.post('/exam/new', checkAuthenticated, authenticateRole(['teacher']), async (req, res) => {
  try {
    const { exam_title, description, duration_minutes, total_marks, passing_marks } = req.body;
    
    // Get teacher_id from the authenticated user
    const teacherQuery = `
      SELECT t.id FROM teachers t 
      JOIN users u ON t.user_id = u.id 
      WHERE u.id = ${req.user.id}
    `;
    const teacher = await executeQuery(teacherQuery);
    
    if (!teacher || teacher.length === 0) {
      return res.status(403).json({ message: "Only teachers can create exams" });
    }

    // Generate a unique exam code
    const examCode = 'EXAM' + Date.now().toString().slice(-6);
    
    const query = `
      INSERT INTO Exams (teachers_id, exam_code, exam_title, description, duration_min, total_points, created_at)
      VALUES (${teacher[0].id}, '${examCode}', '${exam_title}', '${description}', ${duration_minutes}, ${total_marks}, GETDATE())
    `;
    await executeQuery(query);
    res.status(201).json({ message: "Exam created successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error creating exam" });
  }
});

// Add question to exam or question bank
router.post('/:examId/questions/add', checkAuthenticated, authenticateRole(['teacher']), upload.array('media'), async (req, res) => {
  try {
    const { question_text, type_id, points, difficulty, body_text } = req.body;
    const { examId } = req.params;
    const files = req.files;

    // Insert question (can be part of exam or question bank)
    const questionQuery = `
      INSERT INTO Questions (exam_id, type_id, points, body_text, difficulty, created_at)
      OUTPUT INSERTED.question_id
      VALUES (${examId === 'bank' ? 'NULL' : examId}, ${type_id}, ${points}, '${body_text}', ${difficulty || 'NULL'}, GETDATE())
    `;
    const question = await executeQuery(questionQuery);
    const questionId = question[0].question_id;

    // Handle media files if any
    if (files && files.length > 0) {
      for (const file of files) {
        const mediaQuery = `
          INSERT INTO QuestionMedia (question_id, file_name, file_url, caption, file_data, created_at)
          VALUES (${questionId}, '${file.originalname}', '${file.path}', NULL, NULL, GETDATE())
        `;
        await executeQuery(mediaQuery);
      }
    }

    // If it's MCQ type, handle options
    if (type_id === 1 && req.body.options) {
      const options = JSON.parse(req.body.options);
      for (const option of options) {
        const optionQuery = `
          INSERT INTO MCQOptions (question_id, option_text, is_correct, explanation)
          VALUES (${questionId}, '${option.text}', ${option.isCorrect}, ${option.explanation ? `'${option.explanation}'` : 'NULL'})
        `;
        await executeQuery(optionQuery);
      }
    }

    res.status(201).json({ 
      message: examId === 'bank' ? "Question added to bank successfully" : "Question added to exam successfully",
      questionId: questionId 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error adding question" });
  }
});

// Get exam questions
router.get('/:examId/questions', checkAuthenticated, async (req, res) => {
  try {
    const { examId } = req.params;
    const query = `
      SELECT q.*, qt.type_name, 
             (SELECT JSON_QUERY((
               SELECT mo.* 
               FROM MCQOptions mo 
               WHERE mo.question_id = q.question_id 
               FOR JSON PATH
             ))) as options,
             (SELECT JSON_QUERY((
               SELECT qm.* 
               FROM QuestionMedia qm 
               WHERE qm.question_id = q.question_id 
               FOR JSON PATH
             ))) as media
      FROM Questions q
      JOIN QuestionTypes qt ON q.type_id = qt.type_id
      WHERE q.exam_id = ${examId}
    `;
    const questions = await executeQuery(query);
    res.json(questions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching questions" });
  }
});

// Assign exam to class
router.post('/:examId/assign', checkAuthenticated, authenticateRole(['teacher']), async (req, res) => {
  try {
    const { examId } = req.params;
    const { classId, start_time, end_time, max_attempts = 1 } = req.body;

    const query = `
      INSERT INTO ExamAssignments (exam_id, classes_id, open_at, close_at, max_attempts)
      VALUES (${examId}, ${classId}, '${start_time}', '${end_time}', ${max_attempts})
    `;
    await executeQuery(query);
    res.status(201).json({ message: "Exam assigned successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error assigning exam" });
  }
});

// Start exam attempt
router.post('/:assignmentId/start', checkAuthenticated, authenticateRole(['student']), async (req, res) => {
  try {
    const { assignmentId } = req.params;

    // Get assignment and exam details
    const assignmentQuery = `
      SELECT ea.*, e.shuffle_questions, e.shuffle_options 
      FROM ExamAssignments ea
      JOIN Exams e ON ea.exam_id = e.exam_id
      WHERE ea.assignment_id = ${assignmentId}
    `;
    const assignment = await executeQuery(assignmentQuery);
    
    if (!assignment || assignment.length === 0) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    // Get student ID
    const studentQuery = `
      SELECT id FROM students WHERE user_id = ${req.user.id}
    `;
    const student = await executeQuery(studentQuery);

    if (!student || student.length === 0) {
      return res.status(403).json({ message: "Student not found" });
    }

    // Check attempt count
    const attemptCountQuery = `
      SELECT COUNT(*) as attempt_count, ea.max_attempts
      FROM Attempts a
      JOIN ExamAssignments ea ON a.assignment_id = ea.assignment_id
      WHERE a.assignment_id = ${assignmentId} 
      AND a.student_id = ${student[0].id}
      GROUP BY ea.max_attempts`;
    
    const attemptCount = await executeQuery(attemptCountQuery);
    
    if (attemptCount.length > 0 && attemptCount[0].attempt_count >= attemptCount[0].max_attempts) {
      return res.status(403).json({ message: "Maximum attempts reached for this exam" });
    }

    // Create attempt
    const attemptQuery = `
      INSERT INTO Attempts (
        assignment_id, 
        student_id,
        attempt_no, 
        started_at,
        submitted_at,
        auto_score,
        manual_score,
        status
      )
      OUTPUT INSERTED.attempt_id
      VALUES (
        ${assignmentId},
        ${student[0].id},
        (SELECT ISNULL(MAX(attempt_no), 0) + 1 
         FROM Attempts 
         WHERE assignment_id = ${assignmentId}
         AND student_id = ${student[0].id}), 
        GETDATE(),
        NULL,
        0,
        0,
        'in_progress')
    `;
    const attempt = await executeQuery(attemptQuery);
    const attemptId = attempt[0].attempt_id;

    // Get questions
    let questionsQuery = `
      SELECT q.*, qt.type_name, qt.type_code
      FROM Questions q
      JOIN QuestionTypes qt ON q.type_id = qt.type_id
      WHERE q.exam_id = ${assignment[0].exam_id}
    `;

    const questions = await executeQuery(questionsQuery);

    // Shuffle questions if enabled
    if (assignment[0].shuffle_questions) {
      questions.sort(() => Math.random() - 0.5);
    }

    // For each MCQ question, create shuffled options
    for (const question of questions) {
      if (question.type_code === 'MCQ') {
        const optionsQuery = `
          SELECT * FROM MCQOptions WHERE question_id = ${question.question_id}
        `;
        let options = await executeQuery(optionsQuery);

        // Shuffle options if enabled
        if (assignment[0].shuffle_options) {
          options.sort(() => Math.random() - 0.5);
        }

        // Create option instances with shuffled order
        for (let i = 0; i < options.length; i++) {
          const option = options[i];
          await executeQuery(`
            INSERT INTO OptionInstances (
              attempt_id, 
              question_id, 
              option_id, 
              display_order, 
              display_label, 
              option_text_snapshot, 
              is_correct_snapshot
            )
            VALUES (
              ${attemptId},
              ${question.question_id},
              ${option.option_id},
              ${i + 1},
              '${String.fromCharCode(65 + i)}',
              '${option.option_text}',
              ${option.is_correct}
            )
          `);
        }
      }
    }

    res.json({ 
      attemptId: attemptId,
      questions: questions.map(q => ({
        question_id: q.question_id,
        body_text: q.body_text,
        type: q.type_name,
        points: q.points
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error starting exam" });
  }


});





// Submit exam attempt
// Configure storage for response media uploads
const responseMediaStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = 'uploads/response_media';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const uploadResponseMedia = multer({ storage: responseMediaStorage });

router.post('/attempts/:attemptId/submit', checkAuthenticated, authenticateRole(['student']), uploadResponseMedia.array('files'), async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { responses } = req.body;
    const files = req.files;
    
    // Save responses
    for (const response of responses) {
      let responseQuery;
      if (response.type === 'MCQ') {
        // For MCQ questions with single answer
        responseQuery = `
          INSERT INTO Responses (
            attempt_id, 
            question_id, 
            chosen_option_instance_id, 
            answered_at
          )
          OUTPUT INSERTED.response_id
          VALUES (
            ${attemptId}, 
            ${response.questionId}, 
            ${response.selectedOptions && response.selectedOptions.length > 0 ? response.selectedOptions[0] : 'NULL'},
            GETDATE()
          )
        `;
      } else {
        // For essay questions
        responseQuery = `
          INSERT INTO Responses (
            attempt_id, 
            question_id, 
            essay_text,
            answered_at
          )
          OUTPUT INSERTED.response_id
          VALUES (
            ${attemptId}, 
            ${response.questionId}, 
            '${response.text}',
            GETDATE()
          )
        `;
      }
      const responseResult = await executeQuery(responseQuery);
      const responseId = responseResult[0].response_id;

      // Handle MCQ multiple selections if more than one option is selected
      if (response.type === 'MCQ' && response.selectedOptions && response.selectedOptions.length > 1) {
        for (const optionId of response.selectedOptions) {
          await executeQuery(`
            INSERT INTO ResponseMultiSelect (response_id, option_instance_id)
            VALUES (${responseId}, ${optionId})
          `);
        }
      }

      // Handle file attachments for this response if any
      if (response.fileIds && response.fileIds.length > 0) {
        const responseFiles = files.filter(f => response.fileIds.includes(f.originalname));
        for (const file of responseFiles) {
          await executeQuery(`
            INSERT INTO ResponseMedia (
              response_id,
              file_name,
              file_url,
              uploaded_at
            )
            VALUES (
              ${responseId},
              '${file.originalname}',
              '${file.path}',
              GETDATE()
            )
          `);
        }
      }
    }

    // Update attempt status to submitted
    await executeQuery(`
      UPDATE Attempts
      SET status = 'submitted',
          submitted_at = GETDATE()
      WHERE attempt_id = ${attemptId}
    `);

    res.status(201).json({ message: "Exam submitted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error submitting exam" });
  }
});

// Auto-grade MCQ responses for an attempt
async function autoGradeMCQResponses(attemptId) {
  // Get all MCQ responses for this attempt
  const mcqResponsesQuery = `
    SELECT r.response_id, r.question_id, r.chosen_option_instance_id, q.points, oi.is_correct_snapshot,
           CASE WHEN EXISTS (
             SELECT 1 FROM ResponseMultiSelect rms 
             WHERE rms.response_id = r.response_id
           ) THEN 1 ELSE 0 END as is_multi_select
    FROM Responses r
    JOIN Questions q ON r.question_id = q.question_id
    JOIN QuestionTypes qt ON q.type_id = qt.type_id
    LEFT JOIN OptionInstances oi ON r.chosen_option_instance_id = oi.option_instance_id
    WHERE r.attempt_id = ${attemptId} 
    AND qt.type_code = 'MCQ'
  `;
  
  const mcqResponses = await executeQuery(mcqResponsesQuery);
  let totalAutoScore = 0;

  // Grade each MCQ response
  for (const response of mcqResponses) {
    let score = 0;
    if (response.is_multi_select) {
      // For multiple select questions, check if all selected options are correct
      const multiSelectQuery = `
        SELECT COUNT(*) as total_selected,
               SUM(CASE WHEN oi.is_correct_snapshot = 1 THEN 1 ELSE 0 END) as correct_selected
        FROM ResponseMultiSelect rms
        JOIN OptionInstances oi ON rms.option_instance_id = oi.option_instance_id
        WHERE rms.response_id = ${response.response_id}
      `;
      const multiSelectResult = await executeQuery(multiSelectQuery);
      if (multiSelectResult[0].total_selected === multiSelectResult[0].correct_selected) {
        score = response.points;
      }
    } else if (response.is_correct_snapshot) {
      // For single select questions, check if the chosen option is correct
      score = response.points;
    }

    // Update the response with the calculated score
    await executeQuery(`
      UPDATE Responses
      SET score_awarded = ${score}
      WHERE response_id = ${response.response_id}
    `);

    totalAutoScore += score;
  }

  return {
    mcqCount: mcqResponses.length,
    totalAutoScore
  };
}

// Grade exam attempt
router.post('/attempts/:attemptId/grade', checkAuthenticated, authenticateRole(['teacher']), async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { marks } = req.body;

    // Auto-grade MCQ questions first
    const mcqResults = await autoGradeMCQResponses(attemptId);

    // Check if there are any essay questions
    const essayCountQuery = `
      SELECT COUNT(*) as essay_count
      FROM Responses r
      JOIN Questions q ON r.question_id = q.question_id
      JOIN QuestionTypes qt ON q.type_id = qt.type_id
      WHERE r.attempt_id = ${attemptId}
      AND qt.type_code = 'ESSAY'
    `;
    const essayCount = await executeQuery(essayCountQuery);

    if (marks) {
      // Update manual grades for essay questions
      for (const questionMark of marks) {
        const query = `
          UPDATE Responses 
          SET score_awarded = ${questionMark.marks}
          WHERE attempt_id = ${attemptId} AND question_id = ${questionMark.questionId}
        `;
        await executeQuery(query);
      }
    }

    // Calculate total score
    const totalScoreQuery = `
      SELECT ISNULL(SUM(score_awarded), 0) as total_score
      FROM Responses
      WHERE attempt_id = ${attemptId}
    `;
    const totalScore = await executeQuery(totalScoreQuery);

    // Update attempt with final scores
    await executeQuery(`
      UPDATE Attempts
      SET auto_score = ${mcqResults.totalAutoScore},
          status = ${essayCount[0].essay_count === 0 || marks ? "'graded'" : "'pending_manual_grade'"},
          total_score = ${totalScore[0].total_score}
      WHERE attempt_id = ${attemptId}
    `);

    res.json({ 
      message: essayCount[0].essay_count === 0 ? 
        "Exam auto-graded successfully" : 
        (marks ? "Exam graded successfully" : "MCQ questions auto-graded, essay questions pending manual grade"),
      autoScore: mcqResults.totalAutoScore,
      totalScore: totalScore[0].total_score,
      needsManualGrading: essayCount[0].essay_count > 0 && !marks
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error grading exam" });
  }
});

module.exports = router;
