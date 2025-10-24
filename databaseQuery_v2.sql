create database DOANCN
go
use DOANCN
go

CREATE TABLE users (
id INT IDENTITY PRIMARY KEY,
username NVARCHAR(50) NOT NULL,
password VARCHAR(128) NOT NULL,
role NVARCHAR(20) NOT NULL,
full_name NVARCHAR(100) NULL,
email NVARCHAR(100) NULL,
phone_number VARCHAR(20) NULL,
address NVARCHAR(255) NULL,
date_of_birth DATE NULL,
created_at DATETIME DEFAULT GETDATE() NOT NULL,
updated_at DATETIME DEFAULT GETDATE() NOT NULL,
CONSTRAINT UQ_users_username UNIQUE (username),
CONSTRAINT UQ_users_email UNIQUE (email)
);

CREATE TABLE students (
id INT IDENTITY PRIMARY KEY,
user_id INT NOT NULL,
created_at DATETIME DEFAULT GETDATE() NOT NULL,
updated_at DATETIME DEFAULT GETDATE() NOT NULL,
CONSTRAINT FK_students_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE teachers (
id INT IDENTITY PRIMARY KEY,
user_id INT NOT NULL,
salary DECIMAL(18,2) NULL,
created_at DATETIME DEFAULT GETDATE() NOT NULL,
updated_at DATETIME DEFAULT GETDATE() NOT NULL,
CONSTRAINT FK_teachers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
CONSTRAINT CK_teachers_salary_nonneg CHECK (salary >= 0)
);

CREATE TABLE admins (
id INT IDENTITY PRIMARY KEY,
user_id INT NOT NULL,
created_at DATETIME DEFAULT GETDATE() NOT NULL,
updated_at DATETIME DEFAULT GETDATE() NOT NULL,
CONSTRAINT FK_admins_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE notifications (
id INT IDENTITY PRIMARY KEY,
user_id INT NOT NULL,
message NVARCHAR(255) NOT NULL,
sent_at DATETIME DEFAULT GETDATE() NOT NULL,
sender_id INT NULL,
[read] BIT DEFAULT 0 NOT NULL,
created_at DATETIME DEFAULT GETDATE() NOT NULL,
updated_at DATETIME DEFAULT GETDATE() NOT NULL,
CONSTRAINT FK_notifications_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL

);



CREATE TABLE courses (
id INT IDENTITY PRIMARY KEY,
course_name NVARCHAR(100) NOT NULL,
description NVARCHAR(MAX) NULL,
start_date DATE NULL,
end_date DATE NULL,
tuition_fee DECIMAL(18,2) NULL,
created_at DATETIME DEFAULT GETDATE() NOT NULL,
updated_at DATETIME DEFAULT GETDATE() NOT NULL,
image_path NVARCHAR(500) NULL,
link NVARCHAR(255) NULL
);

CREATE TABLE materials (
id INT IDENTITY PRIMARY KEY,
course_id INT NOT NULL,
file_name NVARCHAR(255) NOT NULL,
file_path NVARCHAR(500) NOT NULL,
uploaded_at DATETIME DEFAULT GETDATE() NOT NULL,
CONSTRAINT FK_materials_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE TABLE classes (
id INT IDENTITY PRIMARY KEY,
class_name NVARCHAR(100) NOT NULL,
course_id INT NOT NULL,
teacher_id INT NOT NULL,
start_time TIME NULL,
end_time TIME NULL,
created_at DATETIME DEFAULT GETDATE() NOT NULL,
updated_at DATETIME DEFAULT GETDATE() NOT NULL,
weekly_schedule VARCHAR(100) NULL,
CONSTRAINT FK_classes_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
CONSTRAINT FK_classes_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
);

CREATE TABLE schedules (
id INT IDENTITY PRIMARY KEY,
class_id INT NOT NULL,
day_of_week NVARCHAR(20) NULL,
schedule_date DATE NULL,
start_time TIME NOT NULL,
end_time TIME NOT NULL,
created_at DATETIME DEFAULT GETDATE() NOT NULL,
updated_at DATETIME DEFAULT GETDATE() NOT NULL,
CONSTRAINT FK_schedules_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
CONSTRAINT CHK_schedule_times CHECK (end_time > start_time)
);

CREATE TABLE enrollments (
id INT IDENTITY PRIMARY KEY,
student_id INT NOT NULL,
class_id INT NOT NULL,
enrollment_date DATE NOT NULL,
payment_status BIT DEFAULT 0 NOT NULL,
payment_date DATETIME NULL,
updated_at DATETIME DEFAULT GETDATE() NOT NULL,
created_at DATETIME DEFAULT GETDATE() NOT NULL,
CONSTRAINT FK_enrollments_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
CONSTRAINT FK_enrollments_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

CREATE TABLE QuestionTypes (
type_id INT IDENTITY(1,1) PRIMARY KEY,
type_code VARCHAR(20) NOT NULL UNIQUE, -- 'MCQ', 'ESSAY'
type_name NVARCHAR(50) NOT NULL
);

INSERT INTO QuestionTypes(type_code, type_name) VALUES
('MCQ', N'Câu hỏi trắc nghiệm'),
('ESSAY', N'Câu hỏi tự luận');
GO

-- Bài kiểm tra
CREATE TABLE Exams (
exam_id INT IDENTITY(1,1) PRIMARY KEY,
teachers_id INT NOT NULL,
exam_code VARCHAR(50) NOT NULL UNIQUE,
exam_title NVARCHAR(255) NOT NULL,
description NVARCHAR(MAX) NULL,
duration_min INT NOT NULL, -- thời lượng phút
total_points DECIMAL(10,2) NOT NULL DEFAULT 0,
allow_multi_attempt BIT NOT NULL DEFAULT 0,
shuffle_questions BIT NOT NULL DEFAULT 1,
shuffle_options BIT NOT NULL DEFAULT 1,
created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
CONSTRAINT FK_exams_teacher FOREIGN KEY (teachers_id) REFERENCES teachers(id) ON DELETE CASCADE
);
GO

-- Ngân hàng câu hỏi, gắn với exam hoặc dùng chung
CREATE TABLE Questions (
question_id INT IDENTITY(1,1) PRIMARY KEY,
exam_id INT NULL, -- null nếu dùng như ngân hàng chung
type_id INT NOT NULL REFERENCES QuestionTypes(type_id),
points DECIMAL(10,2) NOT NULL DEFAULT 1,
body_text NVARCHAR(MAX) NOT NULL, -- nội dung câu hỏi
difficulty TINYINT NULL, -- 1..5 tùy chọn
created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
CONSTRAINT FK_Questions_Exam FOREIGN KEY (exam_id) REFERENCES Exams(exam_id) ON DELETE CASCADE
);
GO

-- Ảnh hoặc file đính kèm của câu hỏi
CREATE TABLE QuestionMedia (
media_id INT IDENTITY(1,1) PRIMARY KEY,
question_id INT NOT NULL REFERENCES Questions(question_id) ON DELETE CASCADE,
caption NVARCHAR(255) NULL,
file_name NVARCHAR(255) NULL,
file_url NVARCHAR(1000) NULL, -- nếu lưu trên storage ngoài
file_data VARBINARY(MAX) NULL, -- nếu lưu trực tiếp trong DB
created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

--Phương án trắc nghiệm gốc
CREATE TABLE MCQOptions (
option_id INT IDENTITY(1,1) PRIMARY KEY,
question_id INT NOT NULL REFERENCES Questions(question_id) ON DELETE CASCADE,
option_text NVARCHAR(MAX) NOT NULL,
is_correct BIT NOT NULL DEFAULT 0,
explanation NVARCHAR(MAX) NULL, -- giải thích đáp án
created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

--  Phân phối bài kiểm tra cho người làm
CREATE TABLE ExamAssignments (
assignment_id INT IDENTITY(1,1) PRIMARY KEY,
exam_id INT NOT NULL REFERENCES Exams(exam_id) ON DELETE CASCADE,
classes_id INT NOT NULL, -- FK tới classes.id hệ thống của bạn
open_at DATETIME2 NOT NULL,
close_at DATETIME2 NOT NULL,
max_attempts INT NOT NULL DEFAULT 1,
created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
CONSTRAINT UQ_ExamAssignments UNIQUE (exam_id, classes_id)
);
GO

--  Lần làm bài của mỗi người
CREATE TABLE Attempts (
attempt_id BIGINT IDENTITY(1,1) PRIMARY KEY,
assignment_id INT NOT NULL REFERENCES ExamAssignments(assignment_id) ON DELETE CASCADE,
attempt_no INT NOT NULL, -- 1,2,3...
started_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
submitted_at DATETIME2 NULL,
auto_score DECIMAL(10,2) NOT NULL DEFAULT 0, -- điểm trắc nghiệm
manual_score DECIMAL(10,2) NOT NULL DEFAULT 0, -- điểm tự luận chấm tay
total_score AS (auto_score + manual_score) PERSISTED,
status VARCHAR(20) NOT NULL DEFAULT 'in_progress', -- in_progress, submitted, graded
CONSTRAINT UQ_Attempt UNIQUE (assignment_id, attempt_no)
);
GO

-- Ảnh hiển thị đáp án trắc nghiệm khác nhau với mỗi người
-- Bảng "OptionInstances" chụp ảnh phương án tại thời điểm làm
-- Mỗi attempt có thứ tự và nhãn hiển thị riêng cho từng phương án
CREATE TABLE OptionInstances (
option_instance_id BIGINT IDENTITY(1,1) PRIMARY KEY,
attempt_id BIGINT NOT NULL REFERENCES Attempts(attempt_id) ,
question_id INT NOT NULL REFERENCES Questions(question_id) ON DELETE CASCADE,
option_id INT NOT NULL REFERENCES MCQOptions(option_id) ,
display_order INT NOT NULL, -- vị trí sau khi xáo trộn
display_label VARCHAR(5) NOT NULL, -- A, B, C, D tùy mỗi attempt
option_text_snapshot NVARCHAR(MAX) NOT NULL, -- chụp nội dung để bảo toàn nếu gốc đổi
is_correct_snapshot BIT NOT NULL, -- chụp trạng thái đúng sai
CONSTRAINT UQ_OptionInstances UNIQUE (attempt_id, question_id, option_id)
);
GO



--  Bài làm chi tiết
CREATE TABLE Responses (
response_id BIGINT IDENTITY(1,1) PRIMARY KEY,
attempt_id BIGINT NOT NULL REFERENCES Attempts(attempt_id) ,
question_id INT NOT NULL REFERENCES Questions(question_id) ,
-- Với MCQ: lưu option_instance đã chọn
chosen_option_instance_id BIGINT NULL REFERENCES OptionInstances(option_instance_id) ON DELETE SET NULL,
-- Với MCQ nhiều đáp án, dùng bảng phụ dưới
-- Với ESSAY: lưu nội dung tự luận
essay_text NVARCHAR(MAX) NULL,
grader_comment NVARCHAR(MAX) NULL,
score_awarded DECIMAL(10,2) NULL,
answered_at DATETIME2 NULL,
CONSTRAINT UQ_Response UNIQUE (attempt_id, question_id)
);
GO

--  MCQ nhiều đáp án chọn cùng lúc
CREATE TABLE ResponseMultiSelect (
response_ms_id BIGINT IDENTITY(1,1) PRIMARY KEY,
response_id BIGINT NOT NULL REFERENCES Responses(response_id) ,
option_instance_id BIGINT NOT NULL REFERENCES OptionInstances(option_instance_id) ,
CONSTRAINT UQ_ResponseMultiSelect UNIQUE (response_id, option_instance_id)
);
GO

-- Ảnh đính kèm câu trả lời tự luận
CREATE TABLE ResponseMedia (
response_media_id BIGINT IDENTITY(1,1) PRIMARY KEY,
response_id BIGINT NOT NULL REFERENCES Responses(response_id) ON DELETE CASCADE,
file_name NVARCHAR(255) NULL,
file_url NVARCHAR(1000) NULL,
file_data VARBINARY(MAX) NULL,
uploaded_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- Chỉ số hỗ trợ tìm kiếm
CREATE INDEX IX_Questions_ExamId ON Questions(exam_id);
CREATE INDEX IX_MCQOptions_Q ON MCQOptions(question_id);
CREATE INDEX IX_Assignments_ExamUser ON ExamAssignments(exam_id, classes_id);
CREATE INDEX IX_Attempts_Assignment ON Attempts(assignment_id);
CREATE INDEX IX_OptionInstances_AttemptQ ON OptionInstances(attempt_id, question_id);
CREATE INDEX IX_Responses_AttemptQ ON Responses(attempt_id, question_id);
GO

-- Hàm chấm tự động MCQ cho một attempt
-- fn_AutoScoreAttempt removed: auto-grading can be implemented in application code or re-added later with a correct implementation.
CREATE TABLE RequestTypes (
    type_id INT IDENTITY PRIMARY KEY,
    type_name NVARCHAR(100) NOT NULL, -- Ví dụ: Hủy tiết, Đổi tiết, Tạm hoãn học, Gia hạn học phí
    applicable_to NVARCHAR(20) NOT NULL CHECK (applicable_to IN ('teacher','student'))
);

CREATE TABLE Requests (
    request_id INT IDENTITY PRIMARY KEY,
    user_id INT NOT NULL, -- ai gửi đơn
    type_id INT NOT NULL, -- loại đơn
    class_id INT NULL, -- liên quan lớp nào (nếu có)
    description NVARCHAR(MAX) NULL,
    status NVARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, approved, rejected
    created_at DATETIME DEFAULT GETDATE() NOT NULL,
    updated_at DATETIME DEFAULT GETDATE() NOT NULL,
    CONSTRAINT FK_requests_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT FK_requests_type FOREIGN KEY (type_id) REFERENCES RequestTypes(type_id)
);

CREATE TABLE RequestVotes (
    vote_id INT IDENTITY PRIMARY KEY,
    request_id INT NOT NULL,
    student_id INT NOT NULL,
    is_accepted BIT NOT NULL,
    voted_at DATETIME DEFAULT GETDATE(),
    CONSTRAINT FK_votes_request FOREIGN KEY (request_id) REFERENCES Requests(request_id) ON DELETE CASCADE,
    CONSTRAINT FK_votes_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE NO ACTION,
    CONSTRAINT UQ_votes UNIQUE (request_id, student_id)
);

INSERT INTO RequestTypes (type_name, applicable_to)
VALUES 
(N'Hủy tiết', 'teacher'),
(N'Đổi tiết', 'teacher'),
(N'Tạm hoãn học', 'student'),
(N'Gia hạn học phí', 'student');








-- Insert users (use correct column name password and provide unique emails)
INSERT INTO users (username, password, role, full_name, email, phone_number, address, date_of_birth, created_at, updated_at)
VALUES 
('aaaaaaaaa', '$2b$10$lWy/3Ogl73Z9eMBxuG3HyuAUbEVCCgCUix6m941PoJEYSKtEfQWdK', 'student', N'Nguyen Anh', 'test@gmail.com', '0123456789', N'123 Example St, Hanoi', '2005-01-10', '2025-05-11 17:23:17.473', '2025-05-11 17:23:17.473'),
('bbbbbbbbbb', '$2b$10$TPE79JXdRYc3c9EnKLLTPe4iSkP.SB3D79RMIIhxmh/tQkS7ezQ.C', 'teacher', N'Le Binh', 'test2@gmail.com', '0987654321', N'456 Sample Rd, Ho Chi Minh City', '1980-03-15', '2025-05-11 17:23:32.367', '2025-05-11 17:23:32.367'),
('cccccccccc', '$2b$10$yppnS1aDECiNoIOp76Z4B.2FnkvgAS96liJXsYfemQTpGoISHFVey', 'admin', N'Tran Cuong', 'test3@gmail.com', '0912345678', N'789 Demo Ave, Da Nang', '1990-07-20', '2025-05-12 09:37:00.560', '2025-05-12 09:50:10.277');

-- Insert student (user_id = 1)
INSERT INTO students (user_id) VALUES (1);

-- Insert teacher (user_id = 2)
INSERT INTO teachers (user_id, salary) VALUES (2, 10000000000000.00);

-- Insert admin (user_id = 3)
INSERT INTO admins (user_id) VALUES (3);

-- Insert courses (with image_path)
INSERT INTO courses (course_name, description, start_date, end_date, tuition_fee, image_path, link)
VALUES 
(N'Khoá học Toán, Lý, Hoá, Anh', 
 N'Các khoá học Toán, Lý, Hoá, Anh được thiết kế phù hợp với từng trình độ, giúp học sinh củng cố kiến thức nền tảng, phát triển tư duy logic và nâng cao kỹ năng ngoại ngữ. Đội ngũ giáo viên chuyên môn, phương pháp giảng dạy hiện đại, hỗ trợ học sinh đạt kết quả cao trong học tập.', 
 '2025-08-01', '2025-08-31', 3000000, 'slide1.jpg', '/Toan,Ly,Hoaclass'),
(N'Khoá học Anh Văn', 
 N'Chương trình Anh văn giúp học sinh phát triển toàn diện các kỹ năng nghe, nói, đọc, viết với giáo viên giàu kinh nghiệm và phương pháp hiện đại.', 
 '2025-09-01', '2025-09-30', 1500000, 'slide2.jpg', '/AnhVanClass'),
(N'Khoá học Văn', 
 N'Khoá học Văn giúp học sinh nâng cao khả năng cảm thụ, phân tích tác phẩm và phát triển kỹ năng viết, trình bày ý tưởng một cách logic, sáng tạo.', 
 '2025-10-01', '2025-10-31', 1800000, 'slide3.jpg', '/VanClass'),
(N'Khoá học Toán', 
 N'Khoá học Toán xây dựng nền tảng vững chắc, phát triển tư duy logic và khả năng giải quyết vấn đề cho học sinh ở mọi cấp độ.', 
 '2025-08-15', '2025-09-15', 2000000, 'slide4.jpg', '/ToanClass'),
(N'Khoá học Lý', 
 N'Khoá học Vật lý giúp học sinh hiểu sâu các khái niệm, vận dụng kiến thức vào thực tiễn và đạt kết quả cao trong các kỳ thi.', 
 '2025-09-05', '2025-10-05', 2000000, 'slide5.png', '/LyClass'),
(N'Khoá học Hoá', 
 N'Chương trình Hoá học chú trọng thực hành, giúp học sinh nắm vững lý thuyết và ứng dụng vào các bài tập, thí nghiệm thực tế.', 
 '2025-10-10', '2025-11-10', 2000000, 'slide6.png', '/HoaClass'),
(N'Khoá học Sử', 
 N'Khoá học Lịch sử giúp học sinh hiểu rõ các sự kiện, nhân vật lịch sử và phát triển tư duy phản biện, phân tích.', 
 '2025-11-01', '2025-11-30', 1700000, 'slide7.jpg', '/SuClass');

-- Insert materials
INSERT INTO materials (course_id, file_name, file_path)
VALUES 
(1, 'Slide bài giảng 1', '/materials/csharp_slide1.pdf');

-- Insert classes
INSERT INTO classes (class_name, course_id, teacher_id, start_time, end_time, weekly_schedule)
VALUES (N'Math A1', 1, 1, '08:00', '10:00', '2,4,6');  -- Tue, Thu, Sat

-- Schedules table does NOT have course_id; insert only the columns that exist
INSERT INTO schedules (class_id, day_of_week, schedule_date, start_time, end_time)
VALUES
(1, N'Monday', '2025-08-02', '08:00', '10:00'),
(1, N'Wednesday', '2025-08-04', '08:00', '10:00'),
(1, N'Friday', '2025-08-06', '08:00', '10:00');

-- Insert sample enrollment (comment said unpaid -> set payment_status = 0 and payment_date NULL)
INSERT INTO enrollments (student_id, class_id, enrollment_date, payment_status, payment_date)
VALUES (1, 1, GETDATE(), 0, NULL);

-- Insert notifications
INSERT INTO notifications (user_id, message)
VALUES 
(1, N'Bạn đã được đăng ký vào lớp LTC001.'),
(2, N'Bạn có lớp mới: LTC001.');


