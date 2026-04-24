# Tài liệu chức năng — Simple Expense Tracker

**Phiên bản**: v1 (feature `001-expense-tracker`)
**Ngôn ngữ UI**: Tiếng Việt duy nhất
**Tiền tệ**: VND (không hỗ trợ đa tiền tệ ở v1)
**Đối tượng**: Cá nhân, một tài khoản = một sổ thu chi riêng

Tài liệu này mô tả **những gì hệ thống làm được** (góc nhìn người dùng / stakeholder). Để xem kiến trúc kỹ thuật và task breakdown, đọc [specs/001-expense-tracker/](../specs/001-expense-tracker/).

## 1. Tổng quan

Expense Tracker là ứng dụng web giúp người dùng **ghi lại thu – chi hằng ngày**, **phân loại theo danh mục**, **xem tổng quan theo ngày / tuần / tháng**, và **xuất dữ liệu ra CSV** để làm báo cáo ngoài.

Ba luồng chính, theo độ ưu tiên giảm dần:

| Ưu tiên | User Story | Mô tả ngắn |
|---------|------------|-----------|
| P1 | **Ghi sổ** | Đăng ký → đăng nhập → tạo / sửa / xoá giao dịch, gắn danh mục. |
| P2 | **Dashboard** | Xem tổng thu, tổng chi, số dư ròng và phân bổ theo danh mục theo ngày / tuần / tháng. |
| P3 | **Tìm – lọc – xuất CSV** | Thu hẹp danh sách theo từ khoá, khoảng ngày, loại, danh mục, khoảng tiền, rồi xuất CSV. |

Mỗi slice là một "lát cắt giá trị" độc lập — có thể ship riêng.

---

## 2. Tài khoản & bảo mật

### 2.1 Đăng ký
- Nhập **email** (chưa từng dùng) và **mật khẩu** (≥ 8 ký tự, có ít nhất 1 chữ và 1 chữ số).
- **Không cần xác minh email**; đăng ký xong là dùng được ngay.
- Tài khoản mới được **seed sẵn** bộ danh mục mặc định tiếng Việt (xem §4.1) để bắt đầu ghi sổ ngay lập tức.

### 2.2 Đăng nhập / đăng xuất
- Đăng nhập bằng email + mật khẩu đã đăng ký.
- Sai thông tin → thông báo chung "email hoặc mật khẩu không đúng" (không tiết lộ email đã tồn tại).
- Đăng xuất từ bất kỳ trang nào đang đăng nhập.

### 2.3 Phiên làm việc
- Phiên **tự động gia hạn mỗi lần truy cập** (rolling session).
- Hết hạn sau **30 ngày liên tiếp không hoạt động**.
- Tài khoản đang dùng thường xuyên sẽ duy trì đăng nhập vô thời hạn.

### 2.4 Cô lập dữ liệu
- Mỗi tài khoản chỉ thấy / sửa / xoá / xuất **dữ liệu của chính mình**.
- Không có trang hoặc API nào trả về dữ liệu của user khác, kể cả khi đổi tham số URL.

### 2.5 Ngoài phạm vi v1
- ❌ Quên mật khẩu / reset password
- ❌ Đổi mật khẩu khi đã đăng nhập
- ❌ Xác minh email
- ❌ Đăng nhập mạng xã hội / SSO / MFA

---

## 3. Giao dịch (Transactions)

### 3.1 Tạo giao dịch
Mỗi giao dịch gồm 5 trường:

| Trường | Bắt buộc | Ràng buộc |
|--------|----------|----------|
| **Loại** | ✓ | `Thu` hoặc `Chi` |
| **Số tiền** | ✓ | Số nguyên dương (VND không có phần thập phân) |
| **Thời điểm** | ✓ | Ngày/giờ bất kỳ — có thể đặt tương lai để lên kế hoạch |
| **Danh mục** | ✓ | Phải **cùng loại** với giao dịch (Thu → danh mục Thu, Chi → danh mục Chi); không được dùng danh mục đã lưu trữ |
| **Ghi chú** | — | Tối đa 500 ký tự |

Giao dịch **tương lai** được phép lưu nhưng sẽ không cộng vào "Hôm nay / Tuần này / Tháng này" trên Dashboard cho đến khi tới ngày thực tế.

### 3.2 Danh sách giao dịch
- Sắp xếp **mới nhất trước** theo thời điểm.
- Phân trang tự động (50 dòng / trang).
- Hiển thị: dấu `+`/`−` theo loại, số tiền đã format VND, tên danh mục, thời điểm (giờ nội địa), ghi chú.

### 3.3 Sửa / xoá
- Sửa được **mọi trường** của giao dịch do mình sở hữu.
- Xoá có **bước xác nhận** ("Xoá giao dịch này?") để tránh xoá nhầm.
- Sau khi sửa/xoá, trang danh sách và Dashboard được làm mới (revalidate).

### 3.4 Từ chối đầu vào
- Số tiền ≤ 0 → lỗi validation tại form.
- Số tiền không phải số nguyên → lỗi.
- Ghi chú > 500 ký tự → lỗi.
- Chọn danh mục khác loại với giao dịch → lỗi `CATEGORY_KIND_MISMATCH`.
- Chọn danh mục đã lưu trữ → lỗi `CATEGORY_NOT_AVAILABLE`.

---

## 4. Danh mục (Categories)

### 4.1 Danh mục mặc định
Seed cho mỗi tài khoản mới:

- **Thu**: Lương, Thu nhập khác
- **Chi**: Ăn uống, Đi lại, Nhà ở, Giải trí, Chi phí khác

Đây là danh mục **riêng của user** (không phải global), nên user có thể đổi tên hoặc lưu trữ tuỳ ý.

### 4.2 Quản lý
- **Tạo** danh mục mới: nhập tên + chọn loại (Thu/Chi).
- **Đổi tên** danh mục.
- **Lưu trữ (archive)**: danh mục đã lưu trữ **không hiện** trong dropdown khi tạo giao dịch mới nhưng **vẫn đọc được** trên giao dịch cũ → bảo toàn lịch sử.

### 4.3 Không cho xoá cứng
Hệ thống **không cho phép xoá vĩnh viễn** danh mục đang có giao dịch. Hai lựa chọn:
1. **Reassign** giao dịch sang danh mục khác trước khi xoá.
2. **Archive** để ẩn khỏi picker mà vẫn giữ dữ liệu lịch sử.

Quyết định thiết kế: ưu tiên **tính toàn vẹn của lịch sử** hơn "dọn dẹp nhanh".

---

## 5. Dashboard

### 5.1 Các kỳ xem
Người dùng chọn một trong ba kỳ: **Ngày / Tuần / Tháng**.

- **Tuần** bắt đầu **Thứ Hai** (theo chuẩn ISO 8601 và lịch Việt Nam), kết thúc Chủ Nhật.
- **Tháng** theo lịch dương (1 – 28/29/30/31).
- **Ngày** là ngày nội địa của user (theo múi giờ profile).

### 5.2 Chỉ số hiển thị
Với kỳ đã chọn:

- **Tổng thu** trong kỳ.
- **Tổng chi** trong kỳ.
- **Số dư ròng** = Thu − Chi.
- **Phân bổ theo danh mục**:
  - Top danh mục Thu + tổng từng danh mục.
  - Top danh mục Chi + tổng từng danh mục.

### 5.3 Điều hướng thời gian
- Mũi tên ◀ / ▶ để sang kỳ **trước / sau** (tuần trước, tháng tiếp theo, …).
- Nút "về hiện tại" quay lại kỳ chứa ngày hôm nay.
- Nhãn kỳ tự thay đổi: `Hôm nay`, `Tuần này`, `Tháng này` khi user ở kỳ hiện tại; khi lùi/tiến → `Tuần 20/04 – 26/04/2026`, `Tháng 03/2026`, v.v.

### 5.4 Trạng thái rỗng
Kỳ không có giao dịch → các chỉ số hiển thị `0 ₫` và có thông báo thân thiện thay vì lỗi.

### 5.5 Múi giờ
- Ranh giới ngày/tuần/tháng tính theo **múi giờ nội địa của user** (đọc từ bảng `profiles.timezone`; mặc định `Asia/Ho_Chi_Minh`).
- Không dùng UTC để chia kỳ — giao dịch ghi lúc 23:30 ngày 20/04 giờ VN sẽ thuộc **ngày 20/04**, không phải 21/04 UTC.

---

## 6. Tìm kiếm, lọc, xuất CSV

### 6.1 Tìm theo từ khoá
- Ô **Tìm kiếm** tại trang Giao dịch.
- Khớp **substring, không phân biệt hoa/thường**, áp dụng cho trường **Ghi chú**.
- Hỗ trợ tiếng Việt có dấu.

### 6.2 Bộ lọc
User có thể kết hợp bất kỳ:

| Bộ lọc | Mô tả |
|--------|------|
| **Loại** | Tất cả / Thu / Chi |
| **Từ ngày – Đến ngày** | Khoảng ngày theo múi giờ user |
| **Danh mục** | Chọn **một hoặc nhiều** (multi-select) |
| **Tối thiểu – Tối đa (VND)** | Khoảng số tiền |

Tất cả bộ lọc + tìm kiếm kết hợp theo **logic AND** (giao dịch phải thoả **tất cả**).

Tương tác URL: filter bar dùng native GET form → URL phản ánh chính xác bộ lọc đang áp dụng; có thể bookmark / share link.

### 6.3 Xuất CSV
- Nút **Xuất CSV** ở đầu trang Giao dịch.
- Xuất **đúng tập đang lọc** (không chỉ trang hiện tại).
- Tối đa **10.000 dòng** mỗi lần xuất.
- File: `transactions-YYYYMMDD.csv`
- Encoding: **UTF-8 + BOM** (mở sạch trong Microsoft Excel bản Windows tiếng Việt, giữ nguyên dấu tiếng Việt).
- Cột cố định: `date,type,category,amount,note`
  - `date` — `YYYY-MM-DD` theo giờ user.
  - `type` — `income` / `expense` (key ổn định tiếng Anh cho downstream tools).
  - `category` — tên danh mục tại thời điểm xuất.
  - `amount` — số nguyên VND, không dấu phân cách ngàn.
  - `note` — escape theo chuẩn RFC 4180 khi chứa `,`, `"`, hoặc xuống dòng.
- Lọc ra 0 dòng → hệ thống **không** tạo file rỗng, hiển thị thông báo "Không có giao dịch nào để xuất." (HTTP 409).

---

## 7. Các quy tắc / ràng buộc xuyên suốt

### 7.1 Validation ở biên
Mọi dữ liệu vào hệ thống (Server Action + Route Handler + form client-side) đều qua schema Zod trước khi chạm DB. Thông báo lỗi bằng tiếng Việt.

### 7.2 Bảo mật dữ liệu
- Row-Level Security (RLS) bật trên mọi bảng dữ liệu người dùng.
- Policy `USING (auth.uid() = user_id)` ngăn cross-account read/write ở tầng DB.
- Mật khẩu **không bao giờ** xuất hiện trong log terminal hoặc server logs.
- Service-role key **không** đi vào client bundle.

### 7.3 Đa ngôn ngữ
- v1 chỉ tiếng Việt: tất cả label / thông báo / tên danh mục mặc định / trang lỗi đều tiếng Việt.
- Không có language switcher. Chuyển sang ngôn ngữ khác là công việc của bản sau.

### 7.4 Hiệu năng (mục tiêu)
| Chỉ số | Ngưỡng |
|--------|--------|
| Dashboard tải và hiển thị với 10.000 giao dịch | ≤ 2 giây |
| Áp filter trên 10.000 giao dịch, trả về kết quả | ≤ 1 giây |
| Bắt đầu download CSV sau khi bấm Xuất | ≤ 5 giây |

### 7.5 Nguyên tắc phát triển
Từ Phase 4 trở đi, mọi tính năng tuân thủ **TDD Red-Green-Refactor** — test được viết trước, chỉ đỏ mới được phép xanh. Xem [.specify/memory/constitution.md](../.specify/memory/constitution.md).

---

## 8. Những gì **không** có trong v1

Liệt kê tường minh để tránh kỳ vọng lệch:

- ❌ Ngân sách (budget) / mục tiêu tiết kiệm / cảnh báo khi vượt chi.
- ❌ Giao dịch định kỳ (recurring transactions).
- ❌ Đính kèm ảnh hoá đơn hoặc file bất kỳ.
- ❌ Sổ chung / chia sẻ với gia đình / đội nhóm.
- ❌ Đa tiền tệ / quy đổi FX / tiền tệ per-transaction.
- ❌ App native iOS / Android / offline mode.
- ❌ Đa ngôn ngữ / i18n.
- ❌ Quên mật khẩu / MFA / SSO / xác minh email.

Tất cả đều là candidate cho bản sau.

---

## 9. Tài liệu liên quan

- [specs/001-expense-tracker/spec.md](../specs/001-expense-tracker/spec.md) — user stories, functional requirements, success criteria.
- [specs/001-expense-tracker/plan.md](../specs/001-expense-tracker/plan.md) — tech stack + architecture decisions.
- [specs/001-expense-tracker/data-model.md](../specs/001-expense-tracker/data-model.md) — bảng, quan hệ, RLS.
- [specs/001-expense-tracker/contracts/](../specs/001-expense-tracker/contracts/) — hợp đồng API (server actions + route handlers).
- [specs/001-expense-tracker/quickstart.md](../specs/001-expense-tracker/quickstart.md) — hướng dẫn chạy local + deploy.
- [.specify/memory/constitution.md](../.specify/memory/constitution.md) — nguyên tắc không thể thoả hiệp (RLS, Server Components, Zod ở biên, TS strict, TDD).
