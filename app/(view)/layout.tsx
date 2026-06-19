export default function ViewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background h-svh min-h-0 overflow-hidden">
      {children}
    </div>
  );
}
