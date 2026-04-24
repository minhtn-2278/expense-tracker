# Expense Tracker

Ứng dụng theo dõi thu chi cá nhân, giao diện tiếng Việt, tiền tệ VND.

Stack: **Next.js 16 (App Router) · React 19 · TypeScript · Supabase (Postgres + Auth + RLS) · Zod · Tailwind · date-fns-tz**.

## Chạy cục bộ (local)

Xem hướng dẫn đầy đủ ở [specs/001-expense-tracker/quickstart.md](specs/001-expense-tracker/quickstart.md). Tóm tắt:

```bash
npm install
supabase start          # cần Docker Desktop
supabase db reset       # chạy migrations + seed
cp .env.example .env.local   # điền key từ output của supabase start
npm run db:types
npm run dev             # http://localhost:3000
```

## Các lệnh thường dùng

```bash
npm run dev           # dev server
npm run build         # production build
npm run start         # serve production build

npm run lint          # eslint – phải xanh trước khi PR
npm run typecheck     # tsc --noEmit
npm test              # vitest (unit + integration)
npm run test:e2e      # playwright
npm run test:all      # all of the above

npm run db:reset      # wipe + re-migrate + re-seed
npm run db:types      # generate types/database.ts
```

## Tài liệu đặc tả

Toàn bộ đặc tả, plan, task breakdown, contracts, và hướng dẫn kiểm thử RLS thủ công nằm trong [specs/001-expense-tracker/](specs/001-expense-tracker/). Đọc theo thứ tự: `plan.md` → `spec.md` → `data-model.md` → `contracts/` → `quickstart.md`.

Các nguyên tắc không thể thỏa hiệp (RLS, Server Components, Zod ở biên, TS strict, TDD) được mã hóa ở [.specify/memory/constitution.md](.specify/memory/constitution.md).

## Triển khai

Hướng dẫn deploy lên Vercel + Supabase managed ở cuối [quickstart.md](specs/001-expense-tracker/quickstart.md#deploying-to-vercel). Lưu ý: `SUPABASE_SERVICE_ROLE_KEY` chỉ đặt ở env `Production`, không bao giờ ở `Preview`.
