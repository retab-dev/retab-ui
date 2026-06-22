import React from "react";

type IconProps = {
  width?: string | number;
  height?: string | number;
  className?: string;
};

const ClassifySVG = ({ width = "100%", height = "100%", className = "" }: IconProps) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 600 850"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ maxWidth: "600px", fontFamily: "monospace" }}
    >
      <defs>
        {/* --- Patterns --- */}
        <pattern
          id="classify-text-grey"
          x="0"
          y="0"
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
        >
          <rect width="2" height="2" fill="#9CA3AF" />
          <rect x="2" y="2" width="2" height="2" fill="#9CA3AF" />
        </pattern>

        <pattern
          id="classify-rose"
          x="0"
          y="0"
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
        >
          <rect width="2" height="2" fill="#F43F5E" />
          <rect x="2" y="2" width="2" height="2" fill="#F43F5E" />
        </pattern>

        <pattern
          id="classify-amber"
          x="0"
          y="0"
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
        >
          <rect width="2" height="2" fill="#F59E0B" />
          <rect x="2" y="2" width="2" height="2" fill="#F59E0B" />
        </pattern>

        <pattern
          id="classify-emerald"
          x="0"
          y="0"
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
        >
          <rect width="2" height="2" fill="#10B981" />
          <rect x="2" y="2" width="2" height="2" fill="#10B981" />
        </pattern>

        <pattern
          id="classify-violet"
          x="0"
          y="0"
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
        >
          <rect width="2" height="2" fill="#8B5CF6" />
          <rect x="2" y="2" width="2" height="2" fill="#8B5CF6" />
        </pattern>

        {/* Fade Gradient */}
        <linearGradient id="classify-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="70%" stopColor="white" stopOpacity="0.9" />
          <stop offset="100%" stopColor="white" stopOpacity="1" />
        </linearGradient>
      </defs>

      {/* --- Main Document --- */}
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

        {/* Header */}
        <rect
          x="40"
          y="40"
          width="100"
          height="20"
          fill="url(#classify-text-grey)"
          opacity="0.6"
        />
        <line
          x1="40"
          y1="80"
          x2="500"
          y2="80"
          stroke="#E5E7EB"
          strokeWidth="2"
        />

        {/* Document content lines */}
        <g transform="translate(40, 100)">
          {[...Array(16)].map((_, row) => (
            <g key={row} transform={`translate(0, ${row * 40})`}>
              <rect
                width={row % 3 === 0 ? 420 : row % 3 === 1 ? 380 : 350}
                height="12"
                fill="url(#classify-text-grey)"
                opacity="0.5"
              />
            </g>
          ))}
        </g>

        {/* Fade out bottom */}
        <rect
          x="1"
          y="580"
          width="538"
          height="219"
          fill="url(#classify-fade)"
        />
      </g>

      {/* --- Classification Labels floating around document --- */}

      {/* Invoice label - Top Right */}
      <g transform="translate(480, 120)">
        <rect width="90" height="32" rx="4" fill="#F43F5E" />
        <text
          x="45"
          y="21"
          fill="white"
          fontSize="13"
          fontWeight="bold"
          textAnchor="middle"
          fontFamily="monospace"
        >
          Invoice
        </text>
        {/* Connecting line */}
        <line
          x1="-10"
          y1="16"
          x2="-60"
          y2="16"
          stroke="#F43F5E"
          strokeWidth="2"
          strokeDasharray="4 2"
        />
      </g>

      {/* Contract label - Left */}
      <g transform="translate(-10, 250)">
        <rect width="100" height="32" rx="4" fill="#8B5CF6" />
        <text
          x="50"
          y="21"
          fill="white"
          fontSize="13"
          fontWeight="bold"
          textAnchor="middle"
          fontFamily="monospace"
        >
          Contract
        </text>
        {/* Connecting line */}
        <line
          x1="105"
          y1="16"
          x2="155"
          y2="16"
          stroke="#8B5CF6"
          strokeWidth="2"
          strokeDasharray="4 2"
        />
      </g>

      {/* Receipt label - Right */}
      <g transform="translate(500, 320)">
        <rect width="85" height="32" rx="4" fill="#10B981" />
        <text
          x="42"
          y="21"
          fill="white"
          fontSize="13"
          fontWeight="bold"
          textAnchor="middle"
          fontFamily="monospace"
        >
          Receipt
        </text>
        {/* Connecting line */}
        <line
          x1="-10"
          y1="16"
          x2="-60"
          y2="16"
          stroke="#10B981"
          strokeWidth="2"
          strokeDasharray="4 2"
        />
      </g>

      {/* Report label - Bottom Left */}
      <g transform="translate(10, 440)">
        <rect width="80" height="32" rx="4" fill="#F59E0B" />
        <text
          x="40"
          y="21"
          fill="white"
          fontSize="13"
          fontWeight="bold"
          textAnchor="middle"
          fontFamily="monospace"
        >
          Report
        </text>
        {/* Connecting line */}
        <line
          x1="85"
          y1="16"
          x2="135"
          y2="16"
          stroke="#F59E0B"
          strokeWidth="2"
          strokeDasharray="4 2"
        />
      </g>

      {/* --- Active Classification Indicator --- */}
      {/* Highlighted "Invoice" classification with checkmark */}
      <g transform="translate(180, 560)">
        {/* Shadow/glow effect */}
        <rect
          x="-4"
          y="-4"
          width="248"
          height="58"
          rx="8"
          fill="#F43F5E"
          opacity="0.1"
        />

        {/* Main badge */}
        <rect
          width="240"
          height="50"
          rx="6"
          fill="white"
          stroke="#F43F5E"
          strokeWidth="3"
        />

        {/* Icon circle */}
        <circle cx="30" cy="25" r="15" fill="#F43F5E" opacity="0.15" />
        <g transform="translate(20, 15)">
          <path
            d="M5 10 L9 14 L17 6"
            stroke="#F43F5E"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>

        {/* Label text */}
        <text x="55" y="22" fill="#374151" fontSize="11" fontFamily="monospace">
          Classified as:
        </text>
        <text
          x="55"
          y="40"
          fill="#F43F5E"
          fontSize="16"
          fontWeight="bold"
          fontFamily="monospace"
        >
          INVOICE
        </text>

        {/* Confidence score */}
        <g transform="translate(175, 18)">
          <rect width="50" height="20" rx="10" fill="#F43F5E" opacity="0.1" />
          <text
            x="25"
            y="14"
            fill="#F43F5E"
            fontSize="11"
            fontWeight="bold"
            textAnchor="middle"
            fontFamily="monospace"
          >
            98%
          </text>
        </g>
      </g>

      {/* Decorative pattern squares */}
      <rect
        x="520"
        y="500"
        width="20"
        height="20"
        fill="url(#classify-rose)"
        opacity="0.6"
      />
      <rect
        x="545"
        y="520"
        width="15"
        height="15"
        fill="url(#classify-amber)"
        opacity="0.5"
      />
      <rect
        x="60"
        y="520"
        width="18"
        height="18"
        fill="url(#classify-violet)"
        opacity="0.5"
      />
      <rect
        x="35"
        y="545"
        width="22"
        height="22"
        fill="url(#classify-emerald)"
        opacity="0.6"
      />
    </svg>
  );
};

export default ClassifySVG;
