import React from "react";

type IconProps = {
  width?: string | number;
  height?: string | number;
  className?: string;
};

const SplitSVG = ({ width = "100%", height = "100%", className = "" }: IconProps) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 600 850"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ maxWidth: "600px", fontFamily: "monospace" }} // Removed background color
    >
      <defs>
        {/* --- Patterns --- */}
        {/* Standard Grey Pixel Text */}
        <pattern
          id="pixel-text-grey"
          x="0"
          y="0"
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
        >
          <rect width="2" height="2" fill="#9CA3AF" />
          <rect x="2" y="2" width="2" height="2" fill="#9CA3AF" />
        </pattern>

        {/* Purple Pattern */}
        <pattern
          id="pixel-text-purple"
          x="0"
          y="0"
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
        >
          <rect width="2" height="2" fill="#A855F7" />
          <rect x="2" y="2" width="2" height="2" fill="#A855F7" />
        </pattern>

        {/* Blue Pattern */}
        <pattern
          id="pixel-text-info"
          x="0"
          y="0"
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
        >
          <rect width="2" height="2" fill="#3B82F6" />
          <rect x="2" y="2" width="2" height="2" fill="#3B82F6" />
        </pattern>

        {/* Teal/Green Pattern */}
        <pattern
          id="pixel-text-teal"
          x="0"
          y="0"
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
        >
          <rect width="2" height="2" fill="#14B8A6" />
          <rect x="2" y="2" width="2" height="2" fill="#14B8A6" />
        </pattern>

        {/* --- Paths --- */}
        <path
          id="scribble-signature"
          d="M0,15 C30,5 50,25 80,15 C110,5 130,25 160,15"
          stroke="#9CA3AF"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />

        <path
          id="check-icon"
          d="M5 12 L10 17 L22 5"
          stroke="#9CA3AF"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
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
            fill="url(#pixel-text-grey)"
            opacity="0.7"
          />
          <g transform="translate(0, 40)">
            <rect
              width="80"
              height="12"
              fill="url(#pixel-text-grey)"
              opacity="0.5"
            />
            <rect
              x="380"
              width="40"
              height="12"
              fill="url(#pixel-text-grey)"
              opacity="0.5"
            />
          </g>
          <line
            x1="0"
            y1="70"
            x2="420"
            y2="70"
            stroke="#E5E7EB"
            strokeWidth="2"
          />

          {/* Intro Text (Reduced) */}
          <g transform="translate(0, 90)">
            <rect
              width="420"
              height="12"
              fill="url(#pixel-text-grey)"
              opacity="0.5"
            />
            <rect
              y="20"
              width="300"
              height="12"
              fill="url(#pixel-text-grey)"
              opacity="0.5"
            />
          </g>

          {/* --- BOX 1: VENDOR INFO (Purple) --- */}
          <g transform="translate(-10, 140)">
            <rect
              width="440"
              height="135"
              fill="none"
              stroke="#A855F7"
              strokeWidth="2"
              rx="4"
            />
            <g transform="translate(10, 20)">
              <text
                x="0"
                y="0"
                fill="#A855F7"
                fontSize="12"
                fontWeight="bold"
                fontFamily="monospace"
              >
                VENDOR_INFORMATION
              </text>
              {[0, 1, 2].map((row) => (
                <g key={row} transform={`translate(0, ${30 + row * 30})`}>
                  <rect
                    width="60"
                    height="10"
                    fill="url(#pixel-text-grey)"
                    opacity="0.5"
                  />
                  <rect
                    x="100"
                    width="200"
                    height="12"
                    fill="url(#pixel-text-purple)"
                    opacity="0.7"
                  />
                </g>
              ))}
            </g>
          </g>

          {/* --- BOX 2: INVOICE DATA (Blue) --- */}
          <g transform="translate(-10, 290)">
            <rect
              width="440"
              height="135"
              fill="none"
              stroke="#3B82F6"
              strokeWidth="2"
              rx="4"
            />
            <g transform="translate(10, 20)">
              <text
                x="0"
                y="0"
                fill="#3B82F6"
                fontSize="12"
                fontWeight="bold"
                fontFamily="monospace"
              >
                INVOICE_DETAILS
              </text>
              {[0, 1, 2].map((row) => (
                <g key={row} transform={`translate(0, ${30 + row * 30})`}>
                  <rect
                    width="80"
                    height="10"
                    fill="url(#pixel-text-grey)"
                    opacity="0.5"
                  />
                  <rect
                    x="120"
                    width="150"
                    height="12"
                    fill="url(#pixel-text-info)"
                    opacity="0.7"
                  />
                </g>
              ))}
            </g>
          </g>

          {/* --- BOX 3: LINE ITEMS (Teal) --- */}
          <g transform="translate(-10, 440)">
            <rect
              width="440"
              height="135"
              fill="none"
              stroke="#14B8A6"
              strokeWidth="2"
              rx="4"
            />
            <g transform="translate(10, 20)">
              <text
                x="0"
                y="0"
                fill="#14B8A6"
                fontSize="12"
                fontWeight="bold"
                fontFamily="monospace"
              >
                LINE_ITEM_SUMMARY
              </text>
              {[0, 1, 2].map((row) => (
                <g key={row} transform={`translate(0, ${30 + row * 30})`}>
                  <rect
                    width="40"
                    height="10"
                    fill="url(#pixel-text-grey)"
                    opacity="0.5"
                  />
                  <rect
                    x="80"
                    width="300"
                    height="12"
                    fill="url(#pixel-text-teal)"
                    opacity="0.7"
                  />
                </g>
              ))}
            </g>
          </g>

          {/* Footer / Approval Section */}
          <g transform="translate(0, 650)">
            <g transform="translate(0, 10)">
              <text fill="#9CA3AF" fontSize="12" fontFamily="monospace">
                Authorized Signature:
              </text>
              <g transform="translate(0, 30)">
                <use href="#scribble-signature" />
              </g>
            </g>

            {/* "Verified" Stamp */}
            {/* <g transform="translate(300, 0)">
                            <rect width="120" height="60" fill="white" stroke="#9CA3AF" rx="4" />
                            <g transform="translate(15, 15)">
                                <use href="#check-icon" transform="scale(0.8)" />
                                <text x="35" y="20" fill="#9CA3AF" fontSize="14" fontWeight="bold" fontFamily="monospace">VERIFIED</text>
                            </g>
                        </g> */}
          </g>
        </g>
      </g>
    </svg>
  );
};

export default SplitSVG;
