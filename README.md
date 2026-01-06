Dưới đây là danh sách tất cả file SQL trong workspace (các folder migrations và migrations) đã được kiểm tra, cùng thứ tự nhập vào SQL editor và tiêu đề mô tả chức năng từng file. Chạy theo thứ tự này (1 → N). Trước khi chạy: sao lưu database, chạy ở môi trường dev hoặc staging trước, và đảm bảo bucket storage message-attachments đã được tạo nếu bạn áp dụng migration attachments.

20250101000000_enhance_hrm_system.sql

Tên phần: Core HRM enhancements (leave types, attendance settings, room booking constraints, profile approval, team leader)
Mô tả: Tạo bảng leave_types, attendance_settings, thêm cột/constraint cho leave_requests, room_bookings, profiles, thêm các index và RLS policies liên quan.
20250101000001_create_task_columns.sql

Tên phần: Tasks / Boards / Columns
Mô tả: Tạo task_boards, task_columns, chèn board/columns mặc định, chuyển tasks.status sang text, RLS policies.
20250101000001_fix_null_user_names_in_triggers.sql

Tên phần: Trigger fixes (null-safe notifications)
Mô tả: Sửa hàm trigger để xử lý tên NULL trong các trigger thông báo (leave request, task assignment, room booking).
20250101000002_add_booking_visibility_policies.sql

Tên phần: Room booking RLS policies
Mô tả: Thay thế/điều chỉnh các RLS policies cho room_bookings (ai được xem/tạo/cập nhật).
20251106014315_dbec92f9-c3c1-4764-8f6f-820774dbdf1e.sql

Tên phần: Base schema & types (users/profiles/teams/tasks/rooms/leave/audit)
Mô tả: Tạo extension UUID, enum types, bảng teams, shifts, user_roles, profiles, attendance, tasks, task_comments, meeting_rooms, room_bookings, leave_requests, audit_logs, RLS helpers & policies, helper functions.
20251110021336_6a5c5b02-28a8-4818-a43f-003ed3a4a252.sql

Tên phần: Salaries table
Mô tả: Tạo bảng salaries, RLS policies cho admin, trigger updated_at.
20251111023514_7e7bebc2-151d-4e74-9ff4-29cc68c13a3b.sql

Tên phần: Notifications & avatar storage policies
Mô tả: Tạo notifications table, functions create_notification, triggers for leave/task/booking notifications, create avatars storage bucket and related storage policies.
20251115_add_approval_status_to_profiles.sql

Tên phần: Profiles approval status (backfill)
Mô tả: Thêm các cột approval (is_approved, approval_date, approval_rejected, rejection_reason) và index; backfill existing users as approved.
20251115_add_attendees_to_room_bookings.sql

Tên phần: Room bookings - attendees
Mô tả: Thêm cột attendees (array) cho room_bookings và liên quan (mở rộng chức năng đặt phòng).
20251203143646_28e61aef-6616-4018-9bea-3303bd9747c3.sql

Tên phần: (misc) schema changes December 03
Mô tả: (file chứa các thay đổi/patches tháng 12; mở file để xem chi tiết trước khi chạy)
20251225030838_87721473-71f8-4e09-b109-9c776e760c71.sql

Tên phần: (misc) schema changes Dec 25
Mô tả: (file chứa các thay đổi; xem nội dung)
20251226032038_b4af8fb8-a528-4e26-b79c-0d8b3e206df1.sql

Tên phần: (misc) schema changes Dec 26
Mô tả: (xem file)
20251227134921_e5a637e3-afc4-42cf-b6af-db2baecdc2a2.sql

Tên phần: (misc) schema changes Dec 27
Mô tả: (xem file)
20260101064952_bd9d8460-42b2-4102-a26b-e5d98ae8495e.sql

Tên phần: (misc) Jan 01 updates
Mô tả: (xem file)
20260102023857_42a8da23-331b-4f29-a4c2-aee57e2a32d6.sql

Tên phần: (misc) Jan 02 updates
Mô tả: (xem file)
20260104002122_2866e737-d9c4-46b7-a539-db8d8d34928e.sql

Tên phần: (misc) Jan 04 updates
Mô tả: (xem file)
20260106000000_create_messages.sql

Tên phần: Messaging — create conversations/participants/messages
Mô tả: Tạo bảng conversations, conversation_participants, messages và trigger cập nhật conversations.last_message_at. (Phải chạy sau khi profiles table tồn tại — OK vì profiles được tạo ở bước 5.)
20260106000100_enhance_messages.sql

Tên phần: Messaging — enhancements (group flag, participant roles, edit/delete)
Mô tả: Thêm created_by, is_group cho conversations; thêm role và uniq constraint cho conversation_participants; thêm flags edited, deleted cho messages; tạo table message_reactions.
20260106000200_attachments_and_mute_notifications.sql

Tên phần: Messaging — attachments & per-conversation mute
Mô tả: Tạo message_attachments metadata, thêm attachment_id vào messages, thêm muted flag vào conversation_participants. Lưu ý: phải tạo Supabase Storage bucket message-attachments sau/một phần trước khi upload files.
Ghi chú quan trọng: