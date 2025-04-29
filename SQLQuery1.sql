CREATE DATABASE DOANCS;
GO
USE DOANCS;
GO

CREATE TABLE users (
    id INT PRIMARY KEY IDENTITY,
    username NVARCHAR(50),
    password NVARCHAR(255),
    role NVARCHAR(20),
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    CONSTRAINT UQ_username UNIQUE (username)
);

CREATE TABLE students (
    id INT PRIMARY KEY IDENTITY,
    user_id INT,
    full_name NVARCHAR(100),
    email NVARCHAR(100),
    phone_number NVARCHAR(20),
    address NVARCHAR(255),
    date_of_birth DATE,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE teachers (
    id INT PRIMARY KEY IDENTITY,
    user_id INT,
    full_name NVARCHAR(100),
    email NVARCHAR(100),
    phone_number NVARCHAR(20),
    address NVARCHAR(255),
    date_of_birth DATE,
    salary DECIMAL(18, 2),
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE notifications (
    id INT PRIMARY KEY IDENTITY,
    user_id INT,
    message NVARCHAR(255),
    sent_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE courses (
    id INT PRIMARY KEY IDENTITY,
    course_name NVARCHAR(100),
    description NVARCHAR(MAX),
    start_date DATE,
    end_date DATE,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE()
);

CREATE TABLE materials (
    id INT PRIMARY KEY IDENTITY,
    course_id INT,
    file_name NVARCHAR(255),
    file_path NVARCHAR(500),
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE TABLE classes (
    id INT PRIMARY KEY IDENTITY,
    class_name NVARCHAR(100),
    course_id INT,
    teacher_id INT,
    start_time TIME,
    end_time TIME,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
);

CREATE TABLE schedules (
    id INT PRIMARY KEY IDENTITY,
    class_id INT,
    day_of_week NVARCHAR(20),
    start_time TIME,
    end_time TIME,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

CREATE TABLE enrollments (
    id INT PRIMARY KEY IDENTITY,
    student_id INT,
    class_id INT,
    enrollment_date DATE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE TABLE payments (
    id INT PRIMARY KEY IDENTITY,
    student_id INT,
    amount DECIMAL(18, 2),
    payment_date DATE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- Query to alter all schedules that have a non-null payment_id
ALTER TABLE schedules
--  Add a new column to indicate it has been paid.
ADD is_paid BIT DEFAULT 0;




-- Insert users
INSERT INTO users (username, password, role, created_at, updated_at)
VALUES 
('student1', 'hashed_password_1', 'student', GETDATE(), GETDATE()),
('student2', 'hashed_password_2', 'student', GETDATE(), GETDATE()),
('teacher1', 'hashed_password_3', 'teacher', GETDATE(), GETDATE()),
('teacher2', 'hashed_password_4', 'teacher', GETDATE(), GETDATE());

-- Insert students
INSERT INTO students (user_id, full_name, email, phone_number, address, date_of_birth, created_at, updated_at)
VALUES 
(1, 'Alice Johnson', 'alice@example.com', '1234567890', '123 Maple Street', '2003-05-21', GETDATE(), GETDATE()),
(2, 'Bob Smith', 'bob@example.com', '0987654321', '456 Oak Avenue', '2002-08-14', GETDATE(), GETDATE());

-- Insert teachers
INSERT INTO teachers (user_id, full_name, email, phone_number, address, date_of_birth, salary, created_at, updated_at)
VALUES 
(3, 'Mr. Anderson', 'anderson@example.com', '1122334455', '789 Pine Road', '1985-11-30', 5000.00, GETDATE(), GETDATE()),
(4, 'Ms. Clarke', 'clarke@example.com', '6677889900', '321 Birch Lane', '1990-03-18', 5200.00, GETDATE(), GETDATE());

-- Insert courses
INSERT INTO courses (course_name, description, start_date, end_date, created_at, updated_at)
VALUES 
('Mathematics 101', 'Basic Mathematics Course', '2025-06-01', '2025-09-30', GETDATE(), GETDATE()),
('Physics 101', 'Introduction to Physics', '2025-06-01', '2025-09-30', GETDATE(), GETDATE());

-- Insert classes
INSERT INTO classes (class_name, course_id, teacher_id, start_time, end_time, created_at, updated_at)
VALUES 
('Math Morning Class', 1, 1, '08:00:00', '10:00:00', GETDATE(), GETDATE()),
('Physics Afternoon Class', 2, 2, '13:00:00', '15:00:00', GETDATE(), GETDATE());

-- Insert schedules
INSERT INTO schedules (class_id, day_of_week, start_time, end_time)
VALUES 
(1, 'Monday', '08:00:00', '10:00:00'),
(1, 'Wednesday', '08:00:00', '10:00:00'),
(2, 'Tuesday', '13:00:00', '15:00:00'),
(2, 'Thursday', '13:00:00', '15:00:00');

-- Insert enrollments
INSERT INTO enrollments (student_id, class_id, enrollment_date)
VALUES 
(1, 1, '2025-05-20'),
(2, 2, '2025-05-21');

-- Insert payments
INSERT INTO payments (student_id, amount, payment_date)
VALUES 
(1, 1000.00, '2025-05-22'),
(2, 1000.00, '2025-05-23');

--do this after running all the above update the column
UPDATE schedules
SET is_paid = 1
WHERE id IN (SELECT s.id FROM schedules AS s
JOIN classes AS c ON s.class_id = c.id
LEFT JOIN enrollments AS e ON c.id = e.class_id
LEFT JOIN students AS st ON e.student_id = st.id
LEFT JOIN payments AS p ON st.id = p.student_id
WHERE p.id IS NOT NULL);


SELECT 
    u.id AS user_id,
    u.username,
    CASE 
        WHEN s.id IS NOT NULL THEN 'Student'
        WHEN t.id IS NOT NULL THEN 'Teacher'
        ELSE 'employee'
    END AS "Role"
FROM users u
LEFT JOIN students s ON u.id = s.user_id
LEFT JOIN teachers t ON u.id = t.user_id;

-- Delete from tables that depend on others first
DELETE FROM schedules;
DELETE FROM enrollments;
DELETE FROM payments;
DELETE FROM classes;
DELETE FROM materials;
DELETE FROM notifications;
DELETE FROM students;
DELETE FROM teachers;
DELETE FROM courses;
DELETE FROM users;



SELECT username
from users





-- Query to generate JSON-like output, incorporating tables from DOANCS
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
    p.id AS payment_id,
    p.amount,
    p.payment_date,
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
FOR JSON PATH;


-- SQL code to copy the last user to the first user and delete the last user

-- Step 1: Create a temporary table to store the data of the last user.  This is crucial in case anything goes wrong.
SELECT *
INTO temp_last_user
FROM users
WHERE id = (SELECT MAX(id) FROM users);

-- Step 2: Update the first user's record with the data from the last user.
UPDATE users
SET
    username = (SELECT username FROM temp_last_user),
    password = (SELECT password FROM temp_last_user),
    role = (SELECT role FROM temp_last_user),
    email = (SELECT email FROM temp_last_user),
    full_name = (SELECT full_name FROM temp_last_user),
    gender = (SELECT gender FROM temp_last_user),
    birthday = (SELECT birthday FROM temp_last_user),
    created_at = (SELECT created_at FROM temp_last_user),
    updated_at = GETDATE() -- update the updated_at
WHERE id = (SELECT MIN(id) FROM users);

-- Step 3: Delete the last user's record.
DELETE FROM users
WHERE id = (SELECT MAX(id) FROM users);

-- Step 4: (Optional) Drop the temporary table.  Useful to keep the database clean.
DROP TABLE temp_last_user;