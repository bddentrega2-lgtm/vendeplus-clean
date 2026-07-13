"use client";

import Image, { type ImageProps } from "next/image";
import { type ReactNode, useState } from "react";

type OptimizedImageProps = Omit<ImageProps, "src" | "alt" | "onError"> & {
  src?: ImageProps["src"] | null;
  alt: string;
  fallback?: ReactNode;
  onError?: ImageProps["onError"];
};

export function OptimizedImage({
  src,
  alt,
  fallback = null,
  onError,
  ...props
}: OptimizedImageProps) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return <>{fallback}</>;
  }

  return (
    <Image
      src={src}
      alt={alt}
      onError={(event) => {
        setHasError(true);
        onError?.(event);
      }}
      {...props}
    />
  );
}
