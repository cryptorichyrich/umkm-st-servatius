/**
 * Reusable skeleton loader components.
 * Use while fetching data to prevent layout shift.
 */

export function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-3 h-5 w-2/3 rounded bg-gray-200" />
      <div className="space-y-2">
        <div className="h-4 w-full rounded bg-gray-100" />
        <div className="h-4 w-1/2 rounded bg-gray-100" />
      </div>
      <div className="mt-4 flex gap-2">
        <div className="h-8 w-24 rounded-lg bg-gray-100" />
        <div className="h-8 w-24 rounded-lg bg-gray-100" />
      </div>
    </div>
  );
}

export function BazarCardSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="border-b border-gray-100 bg-gray-50 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gray-200" />
            <div className="space-y-1.5">
              <div className="h-5 w-48 rounded bg-gray-200" />
              <div className="h-3 w-32 rounded bg-gray-100" />
            </div>
          </div>
          <div className="h-6 w-24 rounded-full bg-gray-200" />
        </div>
      </div>
      {/* Body */}
      <div className="px-5 py-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="h-4 w-full rounded bg-gray-100" />
          <div className="h-4 w-full rounded bg-gray-100" />
          <div className="h-4 w-full rounded bg-gray-100" />
          <div className="h-4 w-full rounded bg-gray-100" />
        </div>
        <div className="space-y-2 pt-2">
          <div className="h-12 w-full rounded-lg bg-gray-50" />
          <div className="h-12 w-full rounded-lg bg-gray-50" />
        </div>
      </div>
    </div>
  );
}

export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
        >
          <div className="aspect-[4/3] bg-gray-200" />
          <div className="space-y-2 p-4">
            <div className="h-5 w-3/4 rounded bg-gray-200" />
            <div className="h-4 w-1/2 rounded bg-gray-100" />
            <div className="flex items-center justify-between pt-2">
              <div className="h-4 w-20 rounded bg-gray-100" />
              <div className="h-4 w-16 rounded bg-gray-100" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-4xl animate-pulse px-4 py-8">
      <div className="mb-4 h-4 w-32 rounded bg-gray-100" />
      <div className="mb-6 flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-gray-200" />
        <div className="space-y-2">
          <div className="h-7 w-64 rounded bg-gray-200" />
          <div className="h-4 w-48 rounded bg-gray-100" />
        </div>
      </div>
      <div className="mb-6 aspect-[16/9] rounded-xl bg-gray-200" />
      <div className="space-y-3">
        <div className="h-4 w-full rounded bg-gray-100" />
        <div className="h-4 w-3/4 rounded bg-gray-100" />
        <div className="h-4 w-5/6 rounded bg-gray-100" />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="aspect-square rounded-lg bg-gray-100" />
            <div className="mt-2 h-4 w-3/4 rounded bg-gray-200" />
            <div className="mt-1 h-3 w-1/2 rounded bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
