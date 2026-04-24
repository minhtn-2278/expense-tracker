import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-3xl font-semibold">Không tìm thấy trang</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Liên kết có thể đã hết hạn hoặc không tồn tại.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-full border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        Về trang chủ
      </Link>
    </main>
  );
}
