import Image from "next/image";

type BrandLogoVariant = "default" | "white" | "black";
type BrandLogoSize = "sm" | "md" | "lg";

const logoAssets: Record<BrandLogoVariant, { logo: string; mark: string }> = {
  default: {
    logo: "/brand/new-somos-preview/somos-logo-preview.png",
    mark: "/brand/new-somos-preview/somos-isotipo-preview.png",
  },
  white: {
    logo: "/brand/new-somos-preview/somos-logo-white-preview.png",
    mark: "/brand/new-somos-preview/somos-isotipo-white-preview.png",
  },
  black: {
    logo: "/brand/new-somos-preview/somos-logo-black-preview.png",
    mark: "/brand/new-somos-preview/somos-isotipo-black-preview.png",
  },
};

const logoSizes: Record<BrandLogoSize, string> = {
  sm: "h-auto w-[116px] sm:w-[128px]",
  md: "h-auto w-[144px] sm:w-[164px]",
  lg: "h-auto w-[184px] sm:w-[220px]",
};

const markSizes: Record<BrandLogoSize, string> = {
  sm: "h-8 w-9",
  md: "h-10 w-11",
  lg: "h-12 w-14",
};

export function BrandLogo({
  compact = false,
  markOnly = false,
  variant = "default",
  size = "md",
  priority = false,
}: {
  compact?: boolean;
  markOnly?: boolean;
  variant?: BrandLogoVariant;
  size?: BrandLogoSize;
  priority?: boolean;
}) {
  const showMark = compact || markOnly;
  const asset = logoAssets[variant];

  return (
    <Image
      src={showMark ? asset.mark : asset.logo}
      alt="Somos"
      width={showMark ? 512 : 1117}
      height={showMark ? 452 : 172}
      className={showMark ? markSizes[size] : logoSizes[size]}
      priority={priority}
      sizes={showMark ? "56px" : "(max-width: 640px) 144px, 220px"}
    />
  );
}
