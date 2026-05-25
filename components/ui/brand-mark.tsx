import { cn } from "@/lib/utils";

interface BrandMarkProps {
  className?: string;
}

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <div className={cn(
      "h-[26px] w-[26px] rounded-[7px] bg-accent-grad text-white text-[14px] font-bold flex items-center justify-center tracking-tight",
      className,
    )}>
      R
    </div>
  );
}
