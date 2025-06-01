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
    sender_id INT,
     [read] BIT DEFAULT 0,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id)
);
CREATE TABLE courses (
    id INT PRIMARY KEY IDENTITY,
    course_name NVARCHAR(100),
    description NVARCHAR(MAX),
    start_date DATE,
    end_date DATE,
    tuition_fee int,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    image_path NVARCHAR(500) 
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
    weekly_schedule varchar(100),  -- Stores days like "1,3,5" for Mon,Wed,Fri
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
);

-- Drop existing table if it exists
DROP TABLE IF EXISTS schedules;

-- Recreate schedules table with modified constraints
CREATE TABLE schedules (
    id INT PRIMARY KEY IDENTITY,
    class_id INT,
    course_id INT,
    day_of_week NVARCHAR(20), 
    schedule_date DATE,        
    start_time TIME,
    end_time TIME,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE NO ACTION,
    CONSTRAINT CHK_schedule_times CHECK (end_time > start_time)
);

CREATE TABLE enrollments (
    id INT PRIMARY KEY IDENTITY,
    student_id INT,
    class_id INT,
    enrollment_date DATE,
    payment_status BIT DEFAULT 0,
    payment_date DATETIME,
    updated_at DATETIME DEFAULT GETDATE(),
    created_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE NO ACTION ON UPDATE NO ACTION
);





-- Indexes for better performance
CREATE INDEX idx_students_user_id ON students(user_id);
CREATE INDEX idx_teachers_user_id ON teachers(user_id);
CREATE INDEX idx_admins_user_id ON admins(user_id);
CREATE INDEX idx_materials_course_id ON materials(course_id);
CREATE INDEX idx_classes_course_id ON classes(course_id);
CREATE INDEX idx_classes_teacher_id ON classes(teacher_id);
CREATE INDEX idx_schedules_class_id ON schedules(class_id);
CREATE INDEX idx_schedules_course_id ON schedules(course_id);
CREATE INDEX idx_enrollments_student_id ON enrollments(student_id);
CREATE INDEX idx_enrollments_class_id ON enrollments(class_id);





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
CREATE TRIGGER trg_enrollments_update ON enrollments
AFTER UPDATE AS
BEGIN
    UPDATE enrollments
    SET updated_at = GETDATE()
    WHERE id IN (SELECT id FROM inserted);
END;
GO
CREATE TRIGGER trg_classes_check_dates
ON classes
AFTER INSERT, UPDATE
AS
BEGIN
    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN courses c ON i.course_id = c.id
        WHERE i.start_time IS NULL OR i.end_time IS NULL OR c.start_date > c.end_date
    )
    BEGIN
        RAISERROR ('Invalid class times or course date range.', 16, 1);
        ROLLBACK TRANSACTION;
    END
END;
GO
CREATE TRIGGER trg_schedules_check_date
ON schedules
AFTER INSERT, UPDATE
AS
BEGIN
    IF EXISTS (
        SELECT 1
        FROM inserted s
        JOIN classes cls ON s.class_id = cls.id
        JOIN courses crs ON cls.course_id = crs.id
        WHERE s.schedule_date < crs.start_date OR s.schedule_date > crs.end_date
    )
    BEGIN
        RAISERROR ('Schedule date must be within course date range.', 16, 1);
        ROLLBACK TRANSACTION;
    END
END;
GO


ALTER TRIGGER trg_students_update ON students
AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        UPDATE students 
        SET updated_at = GETDATE()
        WHERE id IN (SELECT id FROM inserted);
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO




CREATE TRIGGER trg_chk_schedule_date
ON schedules
AFTER INSERT, UPDATE
AS
BEGIN
    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN classes cls ON i.class_id = cls.id
        JOIN courses crs ON cls.course_id = crs.id
        WHERE i.schedule_date < crs.start_date OR i.schedule_date > crs.end_date
    )
    BEGIN
        RAISERROR ('schedule_date must be within the related course start and end dates.', 16, 1);
        ROLLBACK TRANSACTION;
    END
END;
GO





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

-- Insert courses (with image_path)
INSERT INTO courses (course_name, description, start_date, end_date, tuition_fee, image_path)
VALUES 
(N'Math 101', N'Basic math course', '2025-08-01', '2025-08-30', 2000000, 'uploads\image\course-1748752260981-882327646.jpg');



-- Insert materials
INSERT INTO materials (course_id, file_name, file_path)
VALUES 
(1, 'Slide bài giảng 1', '/materials/csharp_slide1.pdf');

-- Insert classes
INSERT INTO classes (class_name, course_id, teacher_id, start_time, end_time, weekly_schedule)
VALUES (N'Math A1', 1, 1, '08:00', '10:00', '2,4,6');  -- Tue, Thu, Sat


-- Corrected schedule dates
-- Insert demo class schedule for class_id = 1 and course_id = 1

INSERT INTO schedules (class_id, course_id, day_of_week, schedule_date, start_time, end_time)
VALUES
-- Monday
(1, 1, N'Monday', '2025-06-02', '08:00', '10:00'),
-- Wednesday
(1, 1, N'Wednesday', '2025-06-04', '08:00', '10:00'),
-- Friday
(1, 1, N'Friday', '2025-06-06', '08:00', '10:00');



-- Insert sample enrollment with unpaid status
INSERT INTO enrollments (student_id, class_id, enrollment_date, payment_status, payment_date)
VALUES (1, 1, GETDATE(), 1, GETDATE());



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


-- Simulate payment: update payment status and date
UPDATE enrollments
SET payment_status = 1, payment_date = '2025-05-02'
WHERE student_id = 1 AND class_id = 1;


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
       COALESCE(s.phone_number, t.phone_number, a.phone) AS phone
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



SELECT 
    st.full_name AS student_name,
    st.email AS student_email,
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
FROM enrollments e
JOIN students st ON e.student_id = st.id
JOIN classes cls ON e.class_id = cls.id
JOIN teachers t ON cls.teacher_id = t.id
JOIN courses c ON cls.course_id = c.id
LEFT JOIN schedules s ON cls.id = s.class_id
WHERE st.id = 1
ORDER BY c.course_name, s.schedule_date;



SELECT 
    c.course_name,
    c.description AS course_description,
    c.tuition_fee,
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





SELECT s.full_name, c.class_name, e.enrollment_date, 
       e.payment_status, e.payment_date
FROM enrollments e
JOIN students s ON e.student_id = s.id
JOIN classes c ON e.class_id = c.id;

SELECT 
        c.class_name,
        co.course_name,
        t.full_name AS teacher,
        cls.start_time,		
        cls.end_time,
        cls.weekly_schedule,
        s.schedule_date AS extra_date,
        s.start_time AS extra_start,
        s.end_time AS extra_end
      FROM students st
      JOIN enrollments e ON st.id = e.student_id
      JOIN classes cls ON e.class_id = cls.id
      JOIN courses co ON cls.course_id = co.id
      JOIN teachers t ON cls.teacher_id = t.id
      LEFT JOIN schedules s ON cls.id = s.class_id

-- First, clear existing schedule data
DELETE FROM schedules WHERE class_id = 1;

-- Insert corrected schedule dates based on weekly_schedule '2,4,6' (Tue, Thu, Sat)
INSERT INTO schedules (class_id, course_id, day_of_week, schedule_date, start_time, end_time)
VALUES
-- Tuesday (2)
(1, 1, N'Tuesday', '2025-06-03', '08:00', '10:00'),
-- Thursday (4)
(1, 1, N'Thursday', '2025-06-05', '08:00', '10:00'),
-- Saturday (6)
(1, 1, N'Saturday', '2025-06-07', '08:00', '10:00');