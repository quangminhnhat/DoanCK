
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

CREATE TABLE admins (
    id INT PRIMARY KEY IDENTITY,
    user_id INT NOT NULL,
    full_name NVARCHAR(100),
    email NVARCHAR(100),
    phone_number NVARCHAR(20),
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
    course_id INT NOT NULL,
    file_name NVARCHAR(255) NOT NULL,
    file_path NVARCHAR(500) NOT NULL,
    uploaded_at DATETIME DEFAULT GETDATE(),
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
    schedule_date DATE,        
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

-- Indexes for better performance
CREATE INDEX idx_students_user_id ON students(user_id);
CREATE INDEX idx_teachers_user_id ON teachers(user_id);
CREATE INDEX idx_admins_user_id ON admins(user_id);
CREATE INDEX idx_materials_course_id ON materials(course_id);
CREATE INDEX idx_classes_course_id ON classes(course_id);
CREATE INDEX idx_classes_teacher_id ON classes(teacher_id);
CREATE INDEX idx_schedules_class_id ON schedules(class_id);
CREATE INDEX idx_enrollments_student_id ON enrollments(student_id);
CREATE INDEX idx_enrollments_class_id ON enrollments(class_id);
CREATE INDEX idx_payments_student_id ON payments(student_id);





--do above first Triggers for updated_at
CREATE TRIGGER trg_students_update ON students
AFTER UPDATE AS
BEGIN
    UPDATE students SET updated_at = GETDATE()
    WHERE id IN (SELECT id FROM inserted);
END;
go
CREATE TRIGGER trg_teachers_update ON teachers
AFTER UPDATE AS
BEGIN
    UPDATE teachers SET updated_at = GETDATE()
    WHERE id IN (SELECT id FROM inserted);
END;
go
CREATE TRIGGER trg_users_update ON users
AFTER UPDATE AS
BEGIN
    UPDATE users SET updated_at = GETDATE()
    WHERE id IN (SELECT id FROM inserted);
END;
go
CREATE TRIGGER trg_courses_update ON courses
AFTER UPDATE AS
BEGIN
    UPDATE courses SET updated_at = GETDATE()
    WHERE id IN (SELECT id FROM inserted);
END;
go
CREATE TRIGGER trg_classes_update ON classes
AFTER UPDATE AS
BEGIN
    UPDATE classes SET updated_at = GETDATE()
    WHERE id IN (SELECT id FROM inserted);
END;
go








-- Insert users
INSERT INTO users (username, password, role, created_at, updated_at)
VALUES 
('aaaaaaaaa', '$2b$10$lWy/3Ogl73Z9eMBxuG3HyuAUbEVCCgCUix6m941PoJEYSKtEfQWdK', 'student', '2025-05-11 17:23:17.473', '2025-05-11 17:23:17.473'),
('bbbbbbbbbb', '$2b$10$TPE79JXdRYc3c9EnKLLTPe4iSkP.SB3D79RMIIhxmh/tQkS7ezQ.C', 'teacher', '2025-05-11 17:23:32.367', '2025-05-11 17:23:32.367'),
('cccccccccc', '$2b$10$yppnS1aDECiNoIOp76Z4B.2FnkvgAS96liJXsYfemQTpGoISHFVey', 'admin', '2025-05-12 09:37:00.560', '2025-05-12 09:50:10.277');

-- Insert student (assumes user_id = 1)
INSERT INTO students (user_id, full_name, email, phone_number, address, date_of_birth)
VALUES 
(1, 'aaaaaaaaa', 'test@gmail.com', '5646456363', 'djtkjtrfnrt', '2025-05-16');

-- Insert teacher (assumes user_id = 2)
INSERT INTO teachers (user_id, full_name, email, phone_number, address, date_of_birth, salary)
VALUES 
(2, 'bbbbbbbbbb', 'test2@gmail.com', '5646456363', 'djtkjtrfnrt', '2025-05-16', 10000000000000.00);

-- Insert admin info (if you have a table for admins; otherwise skip or create table)
-- Example for a generic profile table if you store additional info:
 INSERT INTO admins (user_id, full_name, email, phone_number, created_at)
 VALUES 
 (3, 'vvvvvvvvvv', 'test3@gmail.com', '5646456363', '2025-05-12 09:37:00.567');

-- Insert courses
INSERT INTO courses (course_name, description, start_date, end_date)
VALUES 
('Lập trình C#', 'Lập trình ứng dụng với C# và WinForms', '2025-05-01', '2025-08-01');

-- Insert materials
INSERT INTO materials (course_id, file_name, file_path)
VALUES 
(1, 'Slide bài giảng 1', '/materials/csharp_slide1.pdf');

-- Insert classes
INSERT INTO classes (class_name, course_id, teacher_id, start_time, end_time)
VALUES 
('LTC001', 1, 1, '08:00', '10:00');

-- Insert schedules with specific dates
INSERT INTO schedules (class_id, day_of_week, schedule_date, start_time, end_time)
VALUES 
(1, 'Monday', '2025-05-05', '08:00', '10:00'),
(1, 'Wednesday', '2025-05-07', '08:00', '10:00'),
(1, 'Friday', '2025-05-09', '08:00', '10:00');

-- Insert enrollments (link student to class)
INSERT INTO enrollments (student_id, class_id, enrollment_date)
VALUES 
(1, 1, '2025-05-01');

-- Insert payments
INSERT INTO payments (student_id, amount, payment_date)
VALUES 
(1, 1500000, '2025-05-02');

-- Insert notifications
INSERT INTO notifications (user_id, message)
VALUES 
(1, N'Bạn đã được đăng ký vào lớp LTC001.'),
(2, N'Bạn có lớp mới: LTC001.');







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





 SELECT s.schedule_date, s.start_time,
             c.class_name, t.full_name AS teacher
      FROM students st
      JOIN enrollments e   ON st.id = e.student_id
      JOIN classes c       ON e.class_id = c.id
      JOIN schedules s     ON c.id = s.class_id
      JOIN teachers t      ON c.teacher_id = t.id






	  SELECT * FROM materials ORDER BY uploaded_at DESC




	SELECT u.id, u.username, u.role, u.created_at, u.updated_at,
       COALESCE(s.full_name, t.full_name, a.full_name) AS full_name,
       COALESCE(s.email, t.email, a.email) AS email,
       COALESCE(s.phone_number, t.phone_number, a.phone_number) AS phone
FROM users u
LEFT JOIN students s ON u.id = s.user_id
LEFT JOIN teachers t ON u.id = t.user_id
LEFT JOIN admins a   ON u.id = a.user_id
ORDER BY u.created_at DESC;




SELECT 
 c.course_name,
    c.description AS course_description,
    t.full_name AS teacher_name,
    t.email AS teacher_email,
    t.phone_number AS teacher_phone,   
    c.start_date AS course_start,
    c.end_date AS course_end,
    cls.class_name,
    cls.start_time AS class_start_time,
    cls.end_time AS class_end_time,
    s.day_of_week,
    s.schedule_date,
    s.start_time AS schedule_start,
    s.end_time AS schedule_end
FROM classes cls
JOIN teachers t ON cls.teacher_id = t.id
JOIN courses c ON cls.course_id = c.id
LEFT JOIN schedules s ON cls.id = s.class_id
ORDER BY t.full_name, c.course_name, s.schedule_date;
