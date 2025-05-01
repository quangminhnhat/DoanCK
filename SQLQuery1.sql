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


-- Inserting sample data into the 'users' table
INSERT INTO users (username, password, role) VALUES
('student1', 'password123', 'student'),
('teacher1', 'securepass', 'teacher'),
('admin1', 'adminpass', 'admin');

-- Inserting sample data into the 'students' table
INSERT INTO students (user_id, full_name, email, phone_number, address, date_of_birth) VALUES
(1, 'Nguyen Van A', 'a.nguyen@example.com', '0901234567', '123 Main St, HCMC', '2002-05-10');

-- Inserting sample data into the 'teachers' table
INSERT INTO teachers (user_id, full_name, email, phone_number, address, date_of_birth, salary) VALUES
(2, 'Tran Thi B', 'b.tran@example.com', '0987654321', '456 High St, Hanoi', '1990-08-15', 5000.00);

-- Inserting sample data into the 'courses' table
INSERT INTO courses (course_name, description, start_date, end_date) VALUES
('Introduction to Programming', 'A beginner-friendly programming course.', '2025-06-01', '2025-08-31'),
('Advanced Mathematics', 'A course on advanced mathematical concepts.', '2025-06-15', '2025-09-30');


-- Inserting sample data into the 'classes' table
INSERT INTO classes (class_name, course_id, teacher_id, start_time, end_time) VALUES
('PROG101', 1, 2, '09:00:00', '10:30:00'),
('MATH201', 2, 2, '14:00:00', '15:30:00');



-- Inserting sample data into the 'schedules' table
INSERT INTO schedules (class_id, day_of_week, start_time, end_time) VALUES
(1, 'Monday', '09:00:00', '10:30:00'),
(1, 'Wednesday', '09:00:00', '10:30:00'),
(2, 'Tuesday', '14:00:00', '15:30:00'),
(2, 'Thursday', '14:00:00', '15:30:00');

-- Inserting sample data into the 'enrollments' table
INSERT INTO enrollments (student_id, class_id, enrollment_date) VALUES
(1, 1, '2025-05-20'),
(1, 2, '2025-05-25');

-- Inserting sample data into the 'payments' table
INSERT INTO payments (student_id, amount, payment_date) VALUES
(1, 150.00, '2025-05-22'),
(1, 200.00, '2025-05-28');

-- Inserting sample data into the 'notifications' table
INSERT INTO notifications (user_id, message) VALUES
(1, 'Welcome to our learning platform!'),
(2, 'A new course has been assigned to you.');

-- Inserting sample data into the 'materials' table
INSERT INTO materials (course_id, file_name, file_path) VALUES
(1, 'Introduction.pdf', '/materials/course1/intro.pdf'),
(2, 'Calculus_Notes.docx', '/materials/course2/calculus.docx');
















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





SELECT 
    c.class_name,
    co.course_name,
    s.day_of_week,
    s.start_time,
    s.end_time
FROM students st
JOIN enrollments e ON st.id = e.student_id
JOIN classes c ON e.class_id = c.id
JOIN schedules s ON c.id = s.class_id
JOIN courses co ON c.course_id = co.id
WHERE st.user_id = 1

