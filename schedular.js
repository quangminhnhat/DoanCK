const cron = require("node-cron");
const sql = require("msnodesqlv8");

const connectionString =
  "Driver={ODBC Driver 17 for SQL Server};Server=LAPTOP-ND7KAD0J;Database=DOANCS;Trusted_Connection=Yes;";

  

const archiveSchedule = () => {
  console.log("Running archiving schedule task time: ", new Date());
  const scheduleQuery = `
    SELECT
        s.id AS schedule_id,
        c.id AS class_id,
        c.class_name,
        co.id AS course_id,
        co.course_name,
        t.id AS teacher_id,
        t.full_name AS teacher_name,
        s.day_of_week,
        s.start_time,
        s.end_time,
        MAX(p.id) AS payment_id,
        MAX(p.amount) AS amount,
        MAX(p.payment_date) AS payment_date,
        st.id AS student_id,
        st.full_name AS student_name,
        s.is_paid
    FROM schedules AS s
    JOIN classes AS c ON s.class_id = c.id
    JOIN courses AS co ON c.course_id = co.id
    JOIN teachers AS t ON c.teacher_id = t.id
    LEFT JOIN enrollments AS e ON c.id = e.class_id
    LEFT JOIN students AS st ON e.student_id = st.id
    LEFT JOIN payments AS p ON st.id = p.student_id
    GROUP BY s.id, c.id, c.class_name, co.id, co.course_name, t.id, t.full_name, s.day_of_week, s.start_time, s.end_time, st.id, st.full_name, s.is_paid
    FOR JSON PATH;`;

  sql.query(connectionString, scheduleQuery, (err, result) => {
    if (err) {
      console.error("Insert error:", err);
      return;
    }
    const schedule = result && result.recordset ? result.recordset : []; //ADDED A CHECK HERE
    console.log("Schedule data:", schedule);

    // Filter out schedules that are NOT paid (is_paid === 0)
    const unpaidClasses = schedule.filter((item) => item.is_paid === 0);

    console.log("Unpaid classes to delete:", unpaidClasses);

    // Delete unpaid schedules from the database
    unpaidClasses.forEach((unpaidClass) => {
      const deleteQuery = `
        DELETE FROM schedules
        WHERE id = ${unpaidClass.schedule_id};
      `;
      sql.query(connectionString, deleteQuery, (deleteErr, deleteResult) => {
        if (deleteErr) {
          console.error(`Error deleting schedule ${unpaidClass.schedule_id}:`, deleteErr);
        } else {
          console.log(`Deleted schedule ${unpaidClass.schedule_id} from database.`);
        }
      });
    });
    console.log("finished archiving schedule task time: ", new Date());
  });
};

cron.schedule("*/30 * * * * *", archiveSchedule); // Run every 30 seconds
