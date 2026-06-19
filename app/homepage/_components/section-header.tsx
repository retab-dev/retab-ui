import { cn } from "@/lib/utils";

import styles from "./homepage.module.css";

export function SectionHeader({
  id,
  title,
  description,
  placement = "default",
}: {
  id?: string;
  title: string;
  description: string;
  placement?: "default" | "reversed";
}) {
  const isReversed = placement === "reversed";

  return (
    <div className={styles.sectionHeader}>
      <h2
        id={id}
        className={cn(
          styles.sectionTitle,
          isReversed && styles.sectionTitleReversed,
        )}
      >
        {title}
      </h2>
      <p
        className={cn(
          styles.sectionDescription,
          isReversed && styles.sectionDescriptionReversed,
        )}
      >
        {description}
      </p>
    </div>
  );
}
