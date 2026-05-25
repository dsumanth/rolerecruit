import { cn } from "@/lib/utils";

interface AvatarProps {
  name: string;
  src?: string;
  size?: 20 | 24 | 28 | 32 | 40;
  className?: string;
}

function initial(name: string): string {
  const t = name.trim();
  if (!t) return "?";
  return t[0].toUpperCase();
}

export function Avatar({ name, src, size = 28, className }: AvatarProps) {
  const fontSize = size <= 24 ? 10 : size <= 32 ? 12 : 14;

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{ width: size, height: size }}
        className={cn("rounded-full object-cover", className)}
      />
    );
  }

  return (
    <div
      style={{ width: size, height: size, fontSize }}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full text-white font-semibold tracking-tight bg-accent-grad",
        className,
      )}
    >
      {initial(name)}
    </div>
  );
}
