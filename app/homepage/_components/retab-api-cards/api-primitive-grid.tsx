import ClassifySVG from "@/components/icons/classify";
import EditSVG from "@/components/icons/edit";
import ExtractSVG from "@/components/icons/extract";
import ParseSVG from "@/components/icons/parse";
import PartitionSVG from "@/components/icons/partition";
import SplitSVG from "@/components/icons/split";

const primitiveIcons = [
  { id: "extract", Icon: ExtractSVG },
  { id: "parse", Icon: ParseSVG },
  { id: "edit", Icon: EditSVG },
  { id: "split", Icon: SplitSVG },
  { id: "partition", Icon: PartitionSVG },
  { id: "classify", Icon: ClassifySVG },
] as const;

export function RetabApiPrimitiveGrid() {
  return (
    <div
      aria-hidden="true"
      className="grid w-full grid-cols-2 gap-15 md:grid-cols-3 md:gap-x-18 md:gap-y-21 lg:gap-x-24 lg:gap-y-24"
    >
      {primitiveIcons.map(({ id, Icon }) => (
        <Icon key={id} className="h-auto w-full min-w-0 overflow-visible" />
      ))}
    </div>
  );
}
