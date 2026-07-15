export default function TestSticky() {
  return (
    <div className="flex gap-4">
      <div className="flex-1 h-[2000px] bg-red-100">Tall content</div>
      <div className="w-64">
        <div className="sticky top-6 h-32 bg-blue-500">Sticky Box</div>
      </div>
    </div>
  )
}
