export default function StoreLoading() {
  return (
    <main className="min-h-screen bg-[#F8F3E8] px-4 py-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="h-10 w-36 animate-pulse rounded-full bg-white/80" />
        <div className="h-56 animate-pulse rounded-3xl bg-white/80" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-11 min-w-28 animate-pulse rounded-full bg-white/80"
            />
          ))}
        </div>
        <div className="grid gap-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="grid grid-cols-[72px_1fr_112px] gap-3 rounded-2xl bg-white/80 p-2.5">
              <div className="h-[72px] w-[72px] animate-pulse rounded-2xl bg-[#EFE6D6]" />
              <div className="space-y-2 py-1">
                <div className="h-4 w-3/4 animate-pulse rounded-full bg-[#EFE6D6]" />
                <div className="h-3 w-full animate-pulse rounded-full bg-[#EFE6D6]" />
                <div className="h-8 w-28 animate-pulse rounded-xl bg-[#EFE6D6]" />
              </div>
              <div className="flex flex-col items-end justify-between">
                <div className="h-4 w-16 animate-pulse rounded-full bg-[#EFE6D6]" />
                <div className="h-9 w-24 animate-pulse rounded-full bg-[#EFE6D6]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
