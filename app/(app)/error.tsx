'use client';

export default function AppError({ reset }: { reset: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <h2 className="text-lg font-semibold">Đã có lỗi xảy ra</h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Vui lòng thử lại hoặc tải lại trang. Nếu lỗi tiếp diễn, hãy đăng xuất rồi đăng nhập lại.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-2 rounded-full border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        Thử lại
      </button>
    </div>
  );
}
