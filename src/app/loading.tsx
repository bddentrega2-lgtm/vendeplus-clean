export default function Loading() {
  return (
    <main className="min-h-screen bg-[#F8F3E8] px-4 py-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="h-12 w-40 animate-pulse rounded-full bg-white/80" />
        <div className="h-32 animate-pulse rounded-3xl bg-white/80" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-48 animate-pulse rounded-3xl bg-white/80"
            />
          ))}
        </div>
      </div>
    </main>
  );
}
