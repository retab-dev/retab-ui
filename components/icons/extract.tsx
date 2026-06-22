import React from "react";

type IconProps = {
  width?: string | number;
  height?: string | number;
  className?: string;
};

const ExtractSVG = ({ width = "100%", height = "100%", className = "" }: IconProps) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 600 850"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{
        maxWidth: "600px",
        fontFamily: "monospace",
        overflow: "visible",
      }}
    >
      <defs>
        {/* --- Patterns for the "Pixel" textures --- */}

        {/* Base Grey Text Pattern */}
        <pattern
          id="dots-gray"
          x="0"
          y="0"
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
        >
          <rect width="2" height="2" fill="#9CA3AF" />
          <rect x="2" y="2" width="2" height="2" fill="#9CA3AF" />
        </pattern>

        {/* Colored Patterns for the Label Icons */}
        <pattern
          id="dots-green"
          x="0"
          y="0"
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
        >
          <rect width="2" height="2" fill="#849b5c" />
          <rect x="2" y="2" width="2" height="2" fill="#849b5c" />
        </pattern>
        <pattern
          id="dots-blue"
          x="0"
          y="0"
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
        >
          <rect width="2" height="2" fill="#8fb3d1" />
          <rect x="2" y="2" width="2" height="2" fill="#8fb3d1" />
        </pattern>
        <pattern
          id="dots-purple"
          x="0"
          y="0"
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
        >
          <rect width="2" height="2" fill="#b06eb8" />
          <rect x="2" y="2" width="2" height="2" fill="#b06eb8" />
        </pattern>
        <pattern
          id="dots-beige"
          x="0"
          y="0"
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
        >
          <rect width="2" height="2" fill="#dcc6ba" />
          <rect x="2" y="2" width="2" height="2" fill="#dcc6ba" />
        </pattern>

        {/* Fade Gradient for the bottom of the paper */}
        <linearGradient id="fade-white" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="80%" stopColor="white" stopOpacity="0.9" />
          <stop offset="100%" stopColor="white" stopOpacity="1" />
        </linearGradient>
      </defs>

      {/* --- Main Document Sheet --- */}
      <g transform="translate(30, 20)">
        {/* Paper Background */}
        <rect
          width="540"
          height="800"
          rx="8"
          fill="white"
          stroke="#D1D5DB"
          strokeWidth="2"
        />

        {/* Header Logo/Box */}
        <rect
          x="40"
          y="40"
          width="80"
          height="25"
          fill="url(#dots-gray)"
          opacity="0.6"
        />
        <rect
          x="470"
          y="40"
          width="30"
          height="25"
          stroke="#E5E7EB"
          fill="none"
          rx="2"
        />
        <line
          x1="40"
          y1="90"
          x2="500"
          y2="90"
          stroke="#E5E7EB"
          strokeWidth="2"
        />

        {/* --- The Data Grid --- */}
        <g transform="translate(40, 115)">
          {/* Row Generation Loop */}
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((row) => {
            const y = row * 65;
            return (
              <g key={row} transform={`translate(0, ${y})`} opacity="0.6">
                {/* Column 1: Small Item (Avatar/ID) */}
                <rect
                  x="0"
                  y="0"
                  width="50"
                  height="40"
                  stroke="#D1D5DB"
                  fill="none"
                />
                <rect
                  x="5"
                  y="10"
                  width="40"
                  height="18"
                  fill="url(#dots-gray)"
                  opacity="0.5"
                />
                {/* Column 2: Wide Data Block */}
                <g transform="translate(80, 0)">
                  {/* Executing 4 columns of text data inside the main block */}
                  {[0, 1, 2, 3].map((c) => (
                    <rect
                      key={c}
                      x={c * 85}
                      y="8"
                      width="60"
                      height="10"
                      fill="url(#dots-gray)"
                      opacity="0.5"
                    />
                  ))}
                  {[0, 1, 2, 3].map((c) => (
                    <rect
                      key={c}
                      x={c * 85}
                      y="24"
                      width="60"
                      height="10"
                      fill="url(#dots-gray)"
                      opacity="0.5"
                    />
                  ))}
                </g>
                {/* Column 3: Amount/Right Data */}
                <rect
                  x="410"
                  y="0"
                  width="50"
                  height="100"
                  fill="url(#dots-gray)"
                  opacity="0.2"
                />{" "}
                {/* faint bg col */}
                <rect
                  x="415"
                  y="8"
                  width="40"
                  height="10"
                  fill="url(#dots-gray)"
                />
                <rect
                  x="415"
                  y="24"
                  width="40"
                  height="10"
                  fill="url(#dots-gray)"
                />
              </g>
            );
          })}

          {/* --- Highlight Boxes (Overlays) --- */}

          {/* Green Highlights (Left Column - Rows 2, 3, 4) */}
          <rect
            x="-5"
            y="60"
            width="60"
            height="50"
            stroke="#6b7c3d"
            strokeWidth="2"
            fill="none"
          />
          <rect
            x="-5"
            y="125"
            width="60"
            height="50"
            stroke="#6b7c3d"
            strokeWidth="2"
            fill="none"
          />
          <rect
            x="-5"
            y="190"
            width="60"
            height="50"
            stroke="#6b7c3d"
            strokeWidth="2"
            fill="none"
          />

          {/* Blue Highlight (Middle Block - Rows 2-6) */}
          <rect
            x="75"
            y="60"
            width="320"
            height="310"
            stroke="#60a5fa"
            strokeWidth="2"
            fill="none"
          />

          {/* Purple Highlights (Right Column - Rows 2-6) */}
          <rect
            x="405"
            y="60"
            width="60"
            height="310"
            stroke="#ec4899"
            strokeWidth="2"
            fill="none"
          />
        </g>

        {/* Fade Out Effect at Bottom */}
        <rect
          x="1"
          y="580"
          width="538"
          height="219"
          fill="url(#fade-white)"
          rx="0"
        />
      </g>

      {/* --- Labels & Callouts --- */}

      {/* 1. EMAIL Label (Left, Upper) */}
      <g transform="translate(-50, 195)">
        {/* Label Box */}
        <rect x="0" y="0" width="55" height="24" fill="#424128" rx="2" />
        <text
          x="27"
          y="17"
          fill="#e8e895"
          fontSize="12"
          textAnchor="middle"
          fontWeight="bold"
        >
          email
        </text>

        {/* Pattern Icon */}
        <rect
          x="60"
          y="-2"
          width="28"
          height="28"
          stroke="#9CA3AF"
          strokeWidth="1"
          fill="white"
        />
        <rect x="63" y="1" width="22" height="22" fill="url(#dots-green)" />
      </g>

      {/* 2. ADDRESS Label (Left, Lower) */}
      <g transform="translate(-65, 390)">
        {/* Label Box */}
        <rect x="0" y="0" width="70" height="24" fill="#7ba0bd" rx="2" />
        <text
          x="35"
          y="17"
          fill="white"
          fontSize="12"
          textAnchor="middle"
          fontWeight="bold"
        >
          address
        </text>

        {/* Pattern Icon */}
        <rect
          x="75"
          y="-2"
          width="28"
          height="28"
          stroke="#9CA3AF"
          strokeWidth="1"
          fill="white"
        />
        <rect x="78" y="1" width="22" height="22" fill="url(#dots-blue)" />
      </g>

      {/* 3. AMOUNT Label (Right, Middle) */}
      <g transform="translate(560, 350)">
        {/* Pattern Icon */}
        <rect
          x="0"
          y="-2"
          width="28"
          height="28"
          stroke="#9CA3AF"
          strokeWidth="1"
          fill="white"
        />
        <rect x="3" y="1" width="22" height="22" fill="url(#dots-purple)" />

        {/* Label Box */}
        <rect x="33" y="0" width="65" height="24" fill="#ec4899" rx="2" />
        <text
          x="65"
          y="17"
          fill="#e0b0ff"
          fontSize="12"
          textAnchor="middle"
          fontWeight="bold"
        >
          amount
        </text>
      </g>

      {/* 4. ORDERS Label (Right, Bottom) */}
      <g transform="translate(560, 500)">
        {/* Pattern Icon */}
        <rect
          x="0"
          y="-2"
          width="28"
          height="28"
          stroke="#9CA3AF"
          strokeWidth="1"
          fill="white"
        />
        <rect x="3" y="1" width="22" height="22" fill="url(#dots-beige)" />

        {/* Label Box */}
        <rect x="33" y="0" width="65" height="24" fill="#d6c0b0" rx="2" />
        <text
          x="65"
          y="17"
          fill="white"
          fontSize="12"
          textAnchor="middle"
          fontWeight="bold"
        >
          orders
        </text>
      </g>
    </svg>
  );
};

export default ExtractSVG;
