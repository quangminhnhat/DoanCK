create database DOANCN
go
use DOANCN
go

CREATE TABLE users (
id INT IDENTITY PRIMARY KEY,
username NVARCHAR(50) NOT NULL,
password_hash VARCHAR(128) NOT NULL,
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
CONSTRAINT FK_enrollments_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE ON UPDATE NO ACTION,
CONSTRAINT FK_enrollments_class FOREIGN KEY (class_id) REFERENCES classes(id) 
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
updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
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
CREATE OR ALTER FUNCTION dbo.fn_AutoScoreAttempt (@attempt_id BIGINT)
RETURNS DECIMAL(10,2)
AS
BEGIN
DECLARE @score DECIMAL(10,2);
;WITH picked AS (
SELECT r.question_id,
oi.is_correct_snapshot,
aq.points
FROM Responses r
JOIN AttemptQuestions aq
ON aq.attempt_id = r.attempt_id AND aq.question_id = r.question_id
LEFT JOIN OptionInstances oi
ON oi.option_instance_id = r.chosen_option_instance_id
WHERE r.attempt_id = @attempt_id
)
SELECT @score = ISNULL(SUM(CASE WHEN is_correct_snapshot = 1 THEN points ELSE 0 END), 0)
FROM picked;
RETURN @score;
END;
GO
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
    CONSTRAINT FK_votes_student FOREIGN KEY (student_id) REFERENCES students(id),
    CONSTRAINT UQ_votes UNIQUE (request_id, student_id)
);

INSERT INTO RequestTypes (type_name, applicable_to)
VALUES 
(N'Hủy tiết', 'teacher'),
(N'Đổi tiết', 'teacher'),
(N'Tạm hoãn học', 'student'),
(N'Gia hạn học phí', 'student');
