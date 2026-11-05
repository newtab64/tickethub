export default function EventBookingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col bg-white text-[#141d23] overflow-hidden">
      <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
    </div>
  );
}
