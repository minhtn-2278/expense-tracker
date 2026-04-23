# Feature Specification: Simple Expense Tracker

**Feature Branch**: `001-expense-tracker`
**Created**: 2026-04-23
**Status**: Draft
**Input**: User description: "Tạo cho tôi spec cho 1 trang web quản lý thu chi đơn giản bao gồm các chức năng: Đăng nhập/đăng ký; người dùng tạo transaction (thu/chi); gắn Category cho giao dịch; xem Dashboard theo ngày/tuần/tháng; hỗ trợ tìm kiếm, lọc, export csv đơn giản."

## Clarifications

### Session 2026-04-23

- Q: Is email verification required before a newly-registered account can log in and record transactions? → A: Not required; accounts are immediately usable after submitting the registration form.
- Q: Is a password-reset flow in scope for v1? → A: No. v1 ships with no "forgot password" flow and no authenticated "change password" screen.
- Q: What idle duration ends an authenticated session? → A: 30 days of rolling inactivity (session refreshes on each use; expires after 30 consecutive days with no activity).
- Q: What language(s) does the v1 UI support? → A: Vietnamese only. All user-facing labels, messages, and default category names are in Vietnamese; no language switcher in v1.
- Q: Which weekday starts the week on the Dashboard? → A: Monday. Weeks run Monday through Sunday (ISO 8601 / Vietnamese calendar convention).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Record personal income and expenses (Priority: P1)

As an individual user, I want to create an account, log in, and record every income and expense I have — tagging each with a category — so that I maintain an accurate personal ledger I can come back to at any time.

**Why this priority**: Without this capability the product has no reason to exist. It is the minimum usable slice that already delivers standalone value: a user can sign up, log day-to-day transactions, and see their running history.

**Independent Test**: A fresh visitor can register, log in, create at least one income and one expense transaction (each with a category), view them in the transaction list, edit or delete one of them, then log out and log back in to verify the data is still there and is only visible to that user.

**Acceptance Scenarios**:

1. **Given** a visitor on the landing page, **When** they submit the registration form with a valid, unused email and a password that meets the strength rules, **Then** the account is created and they land in the authenticated area with an empty transaction list plus a default category set.
2. **Given** a registered user on the login screen, **When** they enter correct credentials, **Then** they are taken to their own transaction list; if credentials are wrong, they see a generic "invalid email or password" message and remain logged out.
3. **Given** an authenticated user, **When** they submit a new transaction with amount, type (income or expense), date, category, and optional note, **Then** the transaction appears immediately in their list with the correct sign and category label.
4. **Given** an existing transaction owned by the user, **When** the user edits its amount, category, date, or note — or deletes it — **Then** the change is reflected in the list and the previous state is no longer shown.
5. **Given** two different users A and B, **When** user A is logged in, **Then** user A never sees any of user B's transactions or custom categories.

---

### User Story 2 - Understand spending at a glance via the Dashboard (Priority: P2)

As a user who already records transactions, I want a Dashboard that summarises my income, expenses, and net balance for a selected day, week, or month — broken down by category — so I can immediately see where my money goes without scrolling through the raw list.

**Why this priority**: Once the raw data exists (US1), a dashboard is the second-most-valuable slice because it converts logged transactions into insight. It is not required for basic logging, so it comes after the core ledger.

**Independent Test**: With a populated transaction list, the user switches between Day, Week, and Month views and navigates backward/forward in time; the displayed totals, net balance, and per-category breakdown update to match only the transactions in that period for that user.

**Acceptance Scenarios**:

1. **Given** a user with transactions spread across multiple weeks, **When** they open the Dashboard and select "This month", **Then** they see total income, total expense, net balance, and a per-category breakdown computed only from transactions dated in the current month.
2. **Given** the Dashboard is showing the current week, **When** the user clicks "previous period", **Then** the view refreshes to show the prior week's totals and breakdown, and the displayed period label updates accordingly.
3. **Given** a user with no transactions in the selected period, **When** they view the Dashboard for that period, **Then** they see zero totals and an empty-state message ("no transactions in this period") rather than an error.

---

### User Story 3 - Find and export transactions (Priority: P3)

As a user preparing a report, filing taxes, or reviewing a specific category, I want to search by note text and filter transactions by date range, type, category, and amount range, then export the filtered result as a CSV file, so I can work with my data outside the app.

**Why this priority**: Search, filter, and export are power-user tools. They are not needed to begin using the product but significantly increase its usefulness once a meaningful history has been accumulated.

**Independent Test**: A user applies a combination of filters (e.g. "expenses in category Food between 2026-03-01 and 2026-03-31 with amount ≥ 100,000") plus a keyword in the note, confirms the list shows only matching transactions, clicks Export, and receives a CSV file whose rows exactly match the filtered list.

**Acceptance Scenarios**:

1. **Given** a user viewing their transaction list, **When** they type a keyword in the search box, **Then** only transactions whose note contains that keyword (case-insensitive) remain visible.
2. **Given** the user has set a date range, a type (income/expense), a category, and a min/max amount, **When** they apply the filters, **Then** the list shows only transactions matching all filters combined (logical AND).
3. **Given** a filtered transaction list, **When** the user clicks "Export CSV", **Then** a CSV file downloads containing exactly the filtered rows with columns: date, type, category, amount, note.
4. **Given** the filtered list is empty, **When** the user clicks "Export CSV", **Then** the user receives a clear message that there is nothing to export and no empty file is produced.

---

### Edge Cases

- Registration attempted with an email already in use → reject with a clear message.
- Transaction amount of zero or negative → rejected with validation error; amounts must be strictly positive.
- Transaction dated in the future → allowed (users may schedule/plan entries) but clearly marked as "future" in the list and excluded from "today/this week/this month" totals until that date is reached.
- Deleting a category that has transactions attached → block deletion and prompt the user to reassign those transactions first, or offer a "soft archive" that hides the category from the picker but keeps it readable on existing transactions.
- Very large transaction count for a user (e.g. 10,000+) → list must paginate and Dashboard aggregation must still return within the performance targets in Success Criteria.
- User session expires while the user is filling in a transaction form → the app must redirect them to login and must not silently post the form to another user's account after re-login.
- CSV export with notes containing commas, quotes, or newlines → the file must remain valid CSV (proper quoting/escaping) and open correctly in common spreadsheet tools.
- Time zone: a transaction dated "today" in the user's local time zone must be counted in "today" on the Dashboard for that user — not in UTC.

## Requirements *(mandatory)*

### Functional Requirements

**Accounts and access**

- **FR-001**: System MUST allow a visitor to register an account using an email address and a password, and log that new account in immediately on successful submission (no separate email-verification step is required before first use).
- **FR-002**: System MUST reject registration if the email is already associated with an existing account.
- **FR-003**: System MUST enforce a minimum password strength (at least 8 characters, containing at least one letter and one digit).
- **FR-004**: System MUST allow a registered user to log in with their email and password, and log out from any authenticated page.
- **FR-005**: System MUST keep each user's transactions and custom categories private — no user can read, modify, or export another user's data.
- **FR-006**: System MUST end the user's authenticated session on logout and after 30 consecutive days of inactivity. The 30-day window resets on each authenticated request, so an actively-used account stays signed in indefinitely while a truly idle session expires after 30 days.

**Transactions**

- **FR-007**: Users MUST be able to create a transaction with the following fields: amount (positive number), type (income or expense), date, category, and optional free-text note.
- **FR-008**: System MUST reject any transaction whose amount is not strictly greater than zero.
- **FR-009**: System MUST require every transaction to be assigned to exactly one category whose type matches the transaction type (income categories for income, expense categories for expense).
- **FR-010**: Users MUST be able to view a paginated list of their own transactions sorted by date (newest first by default).
- **FR-011**: Users MUST be able to edit any field of a transaction they own, and delete any transaction they own, with a confirmation step before deletion.

**Categories**

- **FR-012**: System MUST seed each new account with a default set of common income and expense categories in Vietnamese (e.g. income: "Lương", "Thu nhập khác"; expense: "Ăn uống", "Đi lại", "Nhà ở", "Giải trí", "Chi phí khác") so a user can begin logging immediately.
- **FR-013**: Users MUST be able to create, rename, and archive their own categories; archived categories MUST remain visible on historical transactions but MUST NOT appear in the category picker for new transactions.
- **FR-014**: System MUST prevent permanent deletion of a category that is referenced by any existing transaction; the user must reassign or archive it instead.

**Dashboard**

- **FR-015**: Users MUST be able to view a Dashboard that aggregates their transactions over a selected period of Day, Week, or Month.
- **FR-016**: Dashboard MUST display, for the selected period: total income, total expense, net balance (income − expense), and a per-category breakdown of expenses and of income.
- **FR-017**: Users MUST be able to navigate to the previous and next period (e.g. previous week, next month) and back to the current period in one click.
- **FR-018**: Dashboard aggregations MUST use the user's local time zone to determine which transaction falls in which day/week/month. Weeks MUST start on Monday and end on Sunday (ISO 8601 convention); months follow calendar months.

**Search, filter, export**

- **FR-019**: Users MUST be able to search their transaction list by a case-insensitive substring match against the note field.
- **FR-020**: Users MUST be able to filter their transaction list by any combination of: date range (from/to), type (income/expense/both), one or more categories, and an amount range (min/max).
- **FR-021**: Search and filters MUST be combinable (logical AND) and MUST operate only on the current user's transactions.
- **FR-022**: Users MUST be able to export the currently filtered transaction list to a CSV file containing the columns: date, type, category, amount, note.
- **FR-023**: CSV export MUST correctly escape values that contain commas, double quotes, or newlines so that the file opens without data corruption in common spreadsheet tools.
- **FR-024**: System MUST show a clear message and not produce an empty-content download when the user triggers Export with zero matching transactions.

**Data handling**

- **FR-025**: System MUST persist all user data durably so that logging out and back in shows the same data unchanged.
- **FR-026**: System MUST record creation and last-modification timestamps for each transaction for the user's later reference.

### Key Entities

- **User**: A person who owns an account. Key attributes: unique email, credential (stored as a one-way hash, never in clear form), account creation time, preferred time zone. A user owns zero or more Categories and zero or more Transactions and cannot see any other user's data.
- **Category**: A user-scoped label used to classify transactions. Key attributes: name, type (income or expense), archived flag, owner (the user). System-seeded defaults are owned by the user too (not global) so they can be renamed or archived freely.
- **Transaction**: A single monetary event recorded by a user. Key attributes: owner (the user), type (income or expense), amount (positive), date (the user-meaningful date it occurred), category (reference to a Category of the same type owned by the same user), optional note, created-at and updated-at timestamps.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can complete registration and log in for the first time in under 90 seconds, without consulting external help.
- **SC-002**: From the transaction list, a user can record a new transaction (choose type, amount, category, date, note, save) in under 20 seconds.
- **SC-003**: 95% of first-time users successfully record at least one transaction on their first session without abandoning.
- **SC-004**: The Dashboard for the current day/week/month displays its totals and category breakdown within 2 seconds for an account with up to 10,000 transactions.
- **SC-005**: Applying any combination of search and filters on a list of up to 10,000 transactions returns results within 1 second.
- **SC-006**: CSV export of up to 10,000 filtered transactions completes and starts downloading within 5 seconds.
- **SC-007**: Zero incidents in which one user's data is visible to, retrievable by, or exportable by another user.
- **SC-008**: Zero data-loss incidents: every saved transaction is still present and unchanged after the user logs out and back in.

## Assumptions

- **Single user, single ledger**: Each account keeps a private ledger. Shared ledgers, households, or team/family accounts are out of scope for this version.
- **Single currency**: All amounts are recorded in one currency (Vietnamese đồng — VND — as the product default). Multi-currency entry, FX conversion, and per-transaction currency are out of scope for this version.
- **Web only**: The product is delivered as a web application usable on a modern desktop or mobile browser; native mobile apps and offline mode are out of scope for this version.
- **Vietnamese UI only**: All user-facing copy (navigation, forms, validation messages, empty states, CSV header labels shown in the UI, default category names) is in Vietnamese. A language switcher and internationalisation (i18n) plumbing are out of scope for this version; adding other languages is deferred to a later release.
- **Simple email/password authentication**: Social login, single sign-on, multi-factor authentication, a separate email-verification step, self-service password reset ("forgot password"), and an authenticated "change password" screen are all out of scope for this version. Users sign in with the email and password they registered with; lost-password recovery is not available in v1.
- **No budgeting or goals**: Setting monthly budgets, savings goals, alerts when overspending, or recurring transactions are out of scope for this version. This product is a ledger + summary, not a financial planner.
- **No attachments**: Users record transactions by amount/category/note only; attaching receipt images or files is out of scope for this version.
- **Scale**: Typical account holds on the order of 10,000 transactions or fewer; performance targets are stated against that size.
- **Time zone**: The user's time zone is either detected from the browser or set in profile; all Dashboard period boundaries are computed in that time zone.
