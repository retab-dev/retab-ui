import React from "react";

type IconProps = {
  width?: string | number;
  height?: string | number;
  className?: string;
};

const ParseSVG = ({ width = "100%", height = "100%", className = "" }: IconProps) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 600 850"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ maxWidth: "600px", fontFamily: "sans-serif" }}
    >
      <defs>
        {/* Drop Shadow Filter for the central card */}
        <filter id="card-shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow
            dx="0"
            dy="4"
            stdDeviation="12"
            floodColor="#000000"
            floodOpacity="0.15"
          />
        </filter>

        {/* Pattern: Generic Halftone Dots (Used for the colored squares) */}
        <pattern
          id="pattern-yellow"
          x="0"
          y="0"
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
        >
          <rect width="2" height="2" fill="#FCD34D" />
          <rect x="2" y="2" width="2" height="2" fill="#FCD34D" />
        </pattern>
        <pattern
          id="pattern-orange"
          x="0"
          y="0"
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
        >
          <rect width="2" height="2" fill="#FB923C" />
          <rect x="2" y="2" width="2" height="2" fill="#FB923C" />
        </pattern>
        <pattern
          id="pattern-blue"
          x="0"
          y="0"
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
        >
          <rect width="2" height="2" fill="#38BDF8" />
          <rect x="2" y="2" width="2" height="2" fill="#38BDF8" />
        </pattern>
        <pattern
          id="pattern-green"
          x="0"
          y="0"
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
        >
          <rect width="2" height="2" fill="#4ADE80" />
          <rect x="2" y="2" width="2" height="2" fill="#4ADE80" />
        </pattern>
        <pattern
          id="pattern-purple"
          x="0"
          y="0"
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
        >
          <rect width="2" height="2" fill="#6B4C76" />
          <rect x="2" y="2" width="2" height="2" fill="#6B4C76" />
        </pattern>
        <pattern
          id="pattern-purple-light"
          x="0"
          y="0"
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
        >
          <rect width="2" height="2" fill="#A78BFA" />
          <rect x="2" y="2" width="2" height="2" fill="#A78BFA" />
        </pattern>

        {/* Pattern: Text Placeholder (Grey dots) */}
        <pattern
          id="text-dots"
          x="0"
          y="0"
          width="3"
          height="3"
          patternUnits="userSpaceOnUse"
        >
          <rect width="1.5" height="1.5" fill="#9CA3AF" />
          <rect x="1.5" y="1.5" width="1.5" height="1.5" fill="#9CA3AF" />
        </pattern>
      </defs>

      {/* --- Background Document --- */}
      <g transform="translate(30, 20)">
        {/* Paper Sheet */}
        <rect
          width="540"
          height="800"
          rx="8"
          fill="white"
          stroke="#D1D5DB"
          strokeWidth="2"
        />

        {/* Header Section */}
        <rect
          x="40"
          y="40"
          width="80"
          height="25"
          fill="url(#text-dots)"
          opacity="0.8"
        />
        <line
          x1="40"
          y1="90"
          x2="500"
          y2="90"
          stroke="#E5E7EB"
          strokeWidth="2"
        />

        <rect x="40" y="115" width="460" height="50" rx="4" fill="#F9FAFB" />

        {/* The Grid of "Text" */}
        <g opacity="0.7">
          {[...Array(12)].map((_, row) => (
            <g key={row} transform={`translate(0, ${200 + row * 45})`}>
              {[...Array(6)].map((_, col) => (
                <rect
                  key={col}
                  x={40 + col * 80}
                  y="0"
                  width="55"
                  height="14"
                  fill="url(#text-dots)"
                />
              ))}
            </g>
          ))}
        </g>
      </g>

      {/* --- Middle Layer Decoration --- */}

      {/* Horizontal Line */}
      <line
        x1="0"
        y1="580"
        x2="600"
        y2="580"
        stroke="#C084FC"
        strokeWidth="2"
      />

      {/* Background Scattered Squares */}
      <rect
        x="80"
        y="540"
        width="30"
        height="30"
        fill="url(#pattern-blue)"
        opacity="0.8"
      />
      <rect
        x="140"
        y="555"
        width="20"
        height="20"
        fill="url(#pattern-green)"
        opacity="0.6"
      />
      <rect
        x="150"
        y="620"
        width="20"
        height="20"
        fill="url(#pattern-green)"
        opacity="0.5"
      />
      <rect
        x="500"
        y="530"
        width="30"
        height="30"
        fill="url(#pattern-orange)"
        opacity="0.7"
      />

      {/* --- Central Card (Foreground) --- */}
      <g transform="translate(220, 490)" filter="url(#card-shadow)">
        <rect width="160" height="160" fill="white" />

        {/* Retab Logo - Stylized */}
        <g transform="translate(40, 38) scale(0.38)">
          {/* Top Left Square */}
          <rect width="58" height="54" fill="#ec4899" />
          {/* Top Horizontal Bar */}
          <rect
            x="58"
            y="54"
            width="152"
            height="54"
            opacity="0.5"
            fill="#ec4899"
          />
          {/* Bottom Left Square */}
          <rect y="108" width="58" height="54" opacity="0.5" fill="#ec4899" />
          {/* Bottom Horizontal Bar */}
          <rect x="58" y="162" width="152" height="54" fill="#ec4899" />
        </g>
      </g>

      {/* --- Foreground Scattered Squares (Overlapping the line) --- */}
      <rect
        x="390"
        y="480"
        width="20"
        height="20"
        fill="url(#pattern-yellow)"
      />
      <rect
        x="440"
        y="565"
        width="25"
        height="25"
        fill="url(#pattern-yellow)"
      />
      <rect
        x="475"
        y="575"
        width="20"
        height="20"
        fill="url(#pattern-orange)"
        opacity="0.8"
      />
      <rect
        x="500"
        y="585"
        width="25"
        height="25"
        fill="url(#pattern-orange)"
      />
      <rect
        x="540"
        y="550"
        width="20"
        height="20"
        fill="url(#pattern-orange)"
      />
      <rect
        x="560"
        y="600"
        width="20"
        height="20"
        fill="url(#pattern-orange)"
        opacity="0.6"
      />
    </svg>
  );
};

export default ParseSVG;
