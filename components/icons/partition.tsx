import React from "react";

type IconProps = {
  width?: string | number;
  height?: string | number;
  className?: string;
};

const PartitionSVG = ({ width = "100%", height = "100%", className = "" }: IconProps) => {
  const groups = [
    {
      y: 250,
      color: "#6366F1",
      pattern: "pixel-partition-indigo",
      label: "GROUP_A",
      keyValue: "category=invoice",
      count: "3",
    },
    {
      y: 400,
      color: "#06B6D4",
      pattern: "pixel-partition-cyan",
      label: "GROUP_B",
      keyValue: "category=receipt",
      count: "3",
    },
    {
      y: 550,
      color: "#F97316",
      pattern: "pixel-partition-orange",
      label: "GROUP_C",
      keyValue: "category=report",
      count: "2",
    },
  ];

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
        {/* Standard Grey Pixel Text */}
        <pattern
          id="pixel-partition-grey"
          x="0"
          y="0"
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
        >
          <rect width="2" height="2" fill="#9CA3AF" />
          <rect x="2" y="2" width="2" height="2" fill="#9CA3AF" />
        </pattern>

        {/* Indigo Pattern */}
        <pattern
          id="pixel-partition-indigo"
          x="0"
          y="0"
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
        >
          <rect width="2" height="2" fill="#6366F1" />
          <rect x="2" y="2" width="2" height="2" fill="#6366F1" />
        </pattern>

        {/* Cyan Pattern */}
        <pattern
          id="pixel-partition-cyan"
          x="0"
          y="0"
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
        >
          <rect width="2" height="2" fill="#06B6D4" />
          <rect x="2" y="2" width="2" height="2" fill="#06B6D4" />
        </pattern>

        {/* Orange Pattern */}
        <pattern
          id="pixel-partition-orange"
          x="0"
          y="0"
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
        >
          <rect width="2" height="2" fill="#F97316" />
          <rect x="2" y="2" width="2" height="2" fill="#F97316" />
        </pattern>
      </defs>

      {/* --- Paper Stack Background Effect --- */}
      <g transform="translate(50, 30)">
        <rect
          x="10"
          y="8"
          width="500"
          height="780"
          rx="8"
          fill="white"
          stroke="#E5E7EB"
          strokeWidth="2"
          transform="rotate(1.5, 250, 390)"
        />
        <rect
          x="5"
          y="4"
          width="500"
          height="780"
          rx="8"
          fill="white"
          stroke="#E5E7EB"
          strokeWidth="2"
          transform="rotate(0.8, 250, 390)"
        />

        {/* --- Main Top Document --- */}
        <rect
          width="500"
          height="780"
          rx="8"
          fill="white"
          stroke="#D1D5DB"
          strokeWidth="2"
        />

        {/* --- Document Content --- */}
        <g transform="translate(40, 50)">
          {/* Header Section */}
          <rect
            width="150"
            height="24"
            fill="url(#pixel-partition-grey)"
            opacity="0.7"
          />
          <text
            x="0"
            y="52"
            fill="#6B7280"
            fontSize="12"
            fontFamily="monospace"
          >
            partition by:
          </text>
          <text
            x="100"
            y="52"
            fill="#374151"
            fontSize="12"
            fontWeight="bold"
            fontFamily="monospace"
          >
            category
          </text>
          <line
            x1="0"
            y1="70"
            x2="420"
            y2="70"
            stroke="#E5E7EB"
            strokeWidth="2"
          />

          {/* --- Source rows (mixed / unsorted) --- */}
          <g transform="translate(0, 90)">
            <text fill="#9CA3AF" fontSize="11" fontFamily="monospace">
              SOURCE_RECORDS
            </text>
            {[
              "#6366F1",
              "#06B6D4",
              "#F97316",
              "#6366F1",
              "#06B6D4",
              "#6366F1",
              "#F97316",
              "#06B6D4",
            ].map((c, i) => (
              <g
                key={i}
                transform={`translate(${(i % 4) * 108}, ${
                  16 + Math.floor(i / 4) * 26
                })`}
              >
                <rect width="10" height="16" rx="2" fill={c} />
                <rect
                  x="16"
                  y="3"
                  width="78"
                  height="9"
                  fill="url(#pixel-partition-grey)"
                  opacity="0.45"
                />
              </g>
            ))}
          </g>
        </g>
      </g>

      {/* --- Partition Group Boxes --- */}
      {groups.map((g, i) => (
        <g key={i} transform={`translate(80, ${g.y})`}>
          <rect
            width="440"
            height="135"
            fill="none"
            stroke={g.color}
            strokeWidth="2"
            rx="4"
          />
          <g transform="translate(10, 20)">
            {/* Group header */}
            <text
              x="0"
              y="0"
              fill={g.color}
              fontSize="12"
              fontWeight="bold"
              fontFamily="monospace"
            >
              {g.label}
            </text>
            {/* key value */}
            <text x="80" y="0" fill="#9CA3AF" fontSize="11" fontFamily="monospace">
              {g.keyValue}
            </text>
            {/* count pill */}
            <g transform="translate(380, -13)">
              <rect width="40" height="20" rx="10" fill={g.color} opacity="0.12" />
              <text
                x="20"
                y="14"
                fill={g.color}
                fontSize="11"
                fontWeight="bold"
                textAnchor="middle"
                fontFamily="monospace"
              >
                {g.count}
              </text>
            </g>

            {/* grouped rows */}
            {[...Array(Number(g.count))].map((_, row) => (
              <g key={row} transform={`translate(0, ${28 + row * 30})`}>
                <rect width="10" height="20" rx="2" fill={g.color} />
                <rect
                  x="24"
                  y="2"
                  width="80"
                  height="10"
                  fill="url(#pixel-partition-grey)"
                  opacity="0.5"
                />
                <rect
                  x="120"
                  y="2"
                  width="280"
                  height="12"
                  fill={`url(#${g.pattern})`}
                  opacity="0.65"
                />
              </g>
            ))}
          </g>
        </g>
      ))}
    </svg>
  );
};

export default PartitionSVG;
