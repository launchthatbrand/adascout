import React from "react";

type AppleIconProps = {
  size?: number | string;
  color?: string;
  strokeWidth?: number;
  background?: string;
  opacity?: number;
  rotation?: number;
  shadow?: number;
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  padding?: number;
};

const AppleIcon = ({
  size = 26,
  color = "#000000",
  strokeWidth = 2,
  background = "transparent",
  opacity = 1,
  rotation = 0,
  shadow = 0,
  flipHorizontal = false,
  flipVertical = false,
  padding = 0,
}: AppleIconProps) => {
  const transforms = [];
  if (rotation !== 0) transforms.push(`rotate(${rotation}deg)`);
  if (flipHorizontal) transforms.push('scaleX(-1)');
  if (flipVertical) transforms.push('scaleY(-1)');

  const viewBoxSize = 24 + (padding * 2);
  const viewBoxOffset = -padding;
  const viewBox = `${viewBoxOffset} ${viewBoxOffset} ${viewBoxSize} ${viewBoxSize}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        opacity,
        transform: transforms.join(" ") || undefined,
        filter:
          shadow > 0
            ? `drop-shadow(0 ${shadow}px ${shadow * 2}px rgba(0,0,0,0.3))`
            : undefined,
        backgroundColor: background !== "transparent" ? background : undefined,
      }}
    >
      <path fill="currentColor" d="M17.458 12.625A4.52 4.52 0 0 1 19.62 8.82a4.67 4.67 0 0 0-3.658-1.984c-1.558-.158-3.04.917-3.829.917s-2.009-.894-3.3-.87a4.9 4.9 0 0 0-4.14 2.508c-1.762 3.06-.449 7.593 1.268 10.076c.84 1.214 1.843 2.581 3.158 2.532c1.268-.05 1.746-.82 3.277-.82s1.962.82 3.3.795c1.364-.025 2.229-1.239 3.062-2.457a11 11 0 0 0 1.385-2.845a4.42 4.42 0 0 1-2.685-4.047m-2.517-7.432A4.4 4.4 0 0 0 15.981 2a4.48 4.48 0 0 0-2.945 1.516a4.2 4.2 0 0 0-1.061 3.093a3.71 3.71 0 0 0 2.966-1.416" />
    </svg>
  );
};

export default AppleIcon;