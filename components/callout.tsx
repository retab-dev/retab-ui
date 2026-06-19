import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function Callout({
  title,
  children,
  icon,
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof Alert> & {
  icon?: React.ReactNode;
  variant?: "default" | "info" | "warning";
}) {
  return (
    <Alert
      data-variant={variant}
      className={cn(
        "border-surface bg-surface text-surface-foreground mt-6 w-auto min-w-0 grid-cols-[minmax(0,1fr)] rounded-xl md:-mx-1",
        className,
      )}
      {...props}
    >
      {icon}
      {title && <AlertTitle className="min-w-0">{title}</AlertTitle>}
      <AlertDescription className="text-card-foreground/80 min-w-0">
        {children}
      </AlertDescription>
    </Alert>
  );
}
