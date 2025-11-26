export function TaskListSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto p-6 animate-pulse">
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 space-y-2">
                <div className="h-5 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-100 rounded w-1/2"></div>
              </div>
              <div className="h-8 w-8 bg-gray-200 rounded"></div>
            </div>
            <div className="flex gap-2">
              <div className="h-6 bg-gray-100 rounded w-20"></div>
              <div className="h-6 bg-gray-100 rounded w-24"></div>
              <div className="h-6 bg-gray-100 rounded w-16"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RequestListSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto p-6 animate-pulse">
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 space-y-2">
                <div className="h-6 bg-gray-200 rounded w-2/3"></div>
                <div className="h-4 bg-gray-100 rounded w-1/3"></div>
              </div>
            </div>
            <div className="space-y-2 mb-3">
              <div className="h-4 bg-gray-100 rounded w-full"></div>
              <div className="h-4 bg-gray-100 rounded w-5/6"></div>
            </div>
            <div className="flex gap-2">
              <div className="h-6 bg-gray-100 rounded w-24"></div>
              <div className="h-6 bg-gray-100 rounded w-20"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FolderSidebarSkeleton() {
  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col animate-pulse">
      <div className="p-4 border-b border-gray-200">
        <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
        <div className="h-10 bg-gray-100 rounded w-full"></div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="p-2 rounded">
            <div className="h-5 bg-gray-100 rounded w-full"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProjectListSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto p-6 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="space-y-3">
              <div className="h-6 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-100 rounded w-full"></div>
              <div className="h-4 bg-gray-100 rounded w-5/6"></div>
              <div className="flex gap-2">
                <div className="h-6 bg-gray-100 rounded w-20"></div>
                <div className="h-6 bg-gray-100 rounded w-24"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
