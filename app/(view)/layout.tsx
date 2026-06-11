export default function ViewLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-svh min-h-0 overflow-hidden bg-background">{children}</div>
}
