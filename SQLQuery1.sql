Create database DOANCS
GO
USE DOANCS
GO
CREATE TABLE users (
    id INT PRIMARY KEY IDENTITY,
    username NVARCHAR(50),
    password NVARCHAR(255),
    role NVARCHAR(20),
    created_at DATETIME,
    updated_at DATETIME
);

CREATE TABLE students (
    id INT PRIMARY KEY IDENTITY,
    user_id INT,
    full_name NVARCHAR(100),
    email NVARCHAR(100),
    phone_number NVARCHAR(20),
    address NVARCHAR(255),
    date_of_birth DATE,
    created_at DATETIME,
    updated_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
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
    created_at DATETIME,
    updated_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

ALTER TABLE users
ADD CONSTRAINT UQ_username UNIQUE (username);


CREATE TABLE notifications (
    id INT PRIMARY KEY IDENTITY,
    user_id INT,
    message NVARCHAR(255),
    sent_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE courses (
    id INT PRIMARY KEY IDENTITY,
    course_name NVARCHAR(100),
    description NVARCHAR(MAX),
    start_date DATE,
    end_date DATE,
    created_at DATETIME,
    updated_at DATETIME
);

CREATE TABLE materials (
    id INT PRIMARY KEY IDENTITY,
    course_id INT,
    file_name NVARCHAR(255),
    file_path NVARCHAR(500),
    FOREIGN KEY (course_id) REFERENCES courses(id)
);

CREATE TABLE classes (
    id INT PRIMARY KEY IDENTITY,
    class_name NVARCHAR(100),
    course_id INT,
    teacher_id INT,
    start_time TIME,
    end_time TIME,
    created_at DATETIME,
    updated_at DATETIME,
    FOREIGN KEY (course_id) REFERENCES courses(id),
    FOREIGN KEY (teacher_id) REFERENCES teachers(id)
);

CREATE TABLE schedules (
    id INT PRIMARY KEY IDENTITY,
    class_id INT,
    day_of_week NVARCHAR(20),
    start_time TIME,
    end_time TIME,
    FOREIGN KEY (class_id) REFERENCES classes(id)
);

CREATE TABLE enrollments (
    id INT PRIMARY KEY IDENTITY,
    student_id INT,
    class_id INT,
    enrollment_date DATE,
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (class_id) REFERENCES classes(id)
);

CREATE TABLE payments (
    id INT PRIMARY KEY IDENTITY,
    student_id INT,
    amount DECIMAL(18, 2),
    payment_date DATE,
    FOREIGN KEY (student_id) REFERENCES students(id)
);

-- Insert Users
INSERT INTO users (username, password, role, created_at, updated_at) VALUES
('alice123', 'hashed_pw_1', 'student', GETDATE(), GETDATE()),
('bob_teacher', 'hashed_pw_2', 'teacher', GETDATE(), GETDATE()),
('carol_student', 'hashed_pw_3', 'student', GETDATE(), GETDATE()),
('dan_admin', 'hashed_pw_4', '', GETDATE(), GETDATE());

-- Get inserted user IDs (in same order)
DECLARE @AliceId INT = (SELECT id FROM users WHERE username = 'alice123');
DECLARE @BobId   INT = (SELECT id FROM users WHERE username = 'bob_teacher');
DECLARE @CarolId INT = (SELECT id FROM users WHERE username = 'carol_student');

-- Insert Students (linked to user IDs)
INSERT INTO students (user_id, full_name, email, phone_number, address, date_of_birth, created_at, updated_at) VALUES
(@AliceId, 'Alice Johnson', 'alice@example.com', '123-456-7890', '123 Maple St', '2002-05-10', GETDATE(), GETDATE()),
(@CarolId, 'Carol Smith', 'carol@example.com', '321-654-0987', '456 Oak Ave', '2003-09-15', GETDATE(), GETDATE());

-- Insert Teacher (linked to user ID)
INSERT INTO teachers (user_id, full_name, email, phone_number, address, date_of_birth, salary, created_at, updated_at) VALUES
(@BobId, 'Bob Anderson', 'bob@example.com', '555-123-9999', '789 Pine Rd', '1980-03-22', 50000, GETDATE(), GETDATE());


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

DELETE FROM users;DELETE FROM students;DELETE FROM teachers;


SELECT username
from users



