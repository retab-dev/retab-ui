import React from "react";

type IconProps = {
  width?: string | number;
  height?: string | number;
  className?: string;
};

const EditSVG = ({ width = "100%", height = "100%", className = "" }: IconProps) => {
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
        {/* --- Patterns --- */}
        {/* Pixelated placeholder text pattern */}
        <pattern
          id="pixel-text"
          x="0"
          y="0"
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
        >
          <rect width="2" height="2" fill="#D1D5DB" />
          <rect x="2" y="2" width="2" height="2" fill="#D1D5DB" />
        </pattern>

        {/* --- Reusable Elements --- */}
        {/* Handwriting Scribble Path (Long) */}
        <path
          id="scribble-long"
          d="M0,12 C20,2 40,22 60,12 C80,2 100,22 120,12 C140,2 160,22 180,12 C200,2 220,22 240,12"
          stroke="#ec4899"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />

        {/* Handwriting Scribble Path (Short) */}
        <path
          id="scribble-short"
          d="M0,12 C20,2 40,22 60,12 C80,2 100,22 120,12"
          stroke="#ec4899"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />

        {/* Checkmark Tick Icon */}
        <path
          id="tick-icon"
          d="M5 12 L10 17 L20 5"
          stroke="#ec4899"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </defs>

      {/* --- Paper Stack Effect --- */}
      <g transform="translate(30, 20)">
        {/* Bottom Paper */}
        <rect
          x="10"
          y="5"
          width="540"
          height="800"
          rx="8"
          fill="white"
          stroke="#E5E7EB"
          strokeWidth="2"
          transform="rotate(1.5, 280, 400)"
        />
        {/* Middle Paper */}
        <rect
          x="5"
          y="2"
          width="540"
          height="800"
          rx="8"
          fill="white"
          stroke="#E5E7EB"
          strokeWidth="2"
          transform="rotate(0.5, 280, 400)"
        />

        {/* --- Main Top Paper --- */}
        <rect
          width="540"
          height="800"
          rx="8"
          fill="white"
          stroke="#D1D5DB"
          strokeWidth="2"
        />

        {/* Content Container */}
        <g transform="translate(40, 40)">
          {/* Header Placeholder */}
          <rect width="100" height="20" fill="url(#pixel-text)" opacity="0.6" />

          {/* ================= SECTION 1: Insurance Application Form ================= */}
          <g transform="translate(0, 60)">
            <text y="20" fontSize="18" fontWeight="700" fill="#374151">
              Insurance Application Form
            </text>
            <line
              x1="0"
              y1="35"
              x2="460"
              y2="35"
              stroke="#E5E7EB"
              strokeWidth="2"
            />

            {/* Row 1 */}
            <g transform="translate(0, 55)">
              <rect
                y="5"
                width="80"
                height="15"
                fill="url(#pixel-text)"
                opacity="0.5"
              />
              <rect
                x="110"
                width="350"
                height="35"
                stroke="#ec4899"
                strokeWidth="2"
                fill="none"
              />
              <g transform="translate(120, 5)">
                <use href="#scribble-long" />
                <use href="#scribble-short" transform="translate(200, 0)" />
              </g>
            </g>
            <line
              x1="0"
              y1="105"
              x2="460"
              y2="105"
              stroke="#E5E7EB"
              strokeWidth="1"
            />

            {/* Row 2 */}
            <g transform="translate(0, 120)">
              <rect
                y="5"
                width="50"
                height="15"
                fill="url(#pixel-text)"
                opacity="0.5"
              />
              <rect
                x="110"
                width="350"
                height="35"
                stroke="#ec4899"
                strokeWidth="2"
                fill="none"
              />
              <g transform="translate(120, 5)">
                <use href="#scribble-long" />
              </g>
            </g>
            <line
              x1="0"
              y1="170"
              x2="460"
              y2="170"
              stroke="#E5E7EB"
              strokeWidth="2"
            />
          </g>

          {/* ================= SECTION 2: Obligator's Information ================= */}
          <g transform="translate(0, 250)">
            <text y="20" fontSize="18" fontWeight="700" fill="#374151">
              Obligator’s Information
            </text>
            <line
              x1="0"
              y1="35"
              x2="460"
              y2="35"
              stroke="#E5E7EB"
              strokeWidth="2"
            />

            {/* Row 1 */}
            <g transform="translate(0, 55)">
              <rect
                y="5"
                width="70"
                height="15"
                fill="url(#pixel-text)"
                opacity="0.5"
              />
              <rect
                x="130"
                width="330"
                height="35"
                stroke="#ec4899"
                strokeWidth="2"
                fill="none"
              />
              <g transform="translate(140, 5)">
                <use href="#scribble-short" />
              </g>
            </g>
            <line
              x1="0"
              y1="105"
              x2="460"
              y2="105"
              stroke="#E5E7EB"
              strokeWidth="1"
            />

            {/* Row 2 */}
            <g transform="translate(0, 120)">
              <rect
                y="5"
                width="100"
                height="15"
                fill="url(#pixel-text)"
                opacity="0.5"
              />
              <rect
                x="130"
                width="330"
                height="35"
                stroke="#ec4899"
                strokeWidth="2"
                fill="none"
              />
              <g transform="translate(140, 5)">
                <use href="#scribble-long" />
                <use href="#scribble-short" transform="translate(180, 0)" />
              </g>
            </g>
            <line
              x1="0"
              y1="170"
              x2="460"
              y2="170"
              stroke="#E5E7EB"
              strokeWidth="2"
            />
          </g>

          {/* ================= SECTION 3: Relationship ================= */}
          <g transform="translate(0, 440)">
            <text y="20" fontSize="18" fontWeight="700" fill="#374151">
              Relationship between Insured & Obligor
            </text>
            <line
              x1="0"
              y1="35"
              x2="460"
              y2="35"
              stroke="#E5E7EB"
              strokeWidth="2"
            />

            <g transform="translate(0, 55)">
              {/* Checkbox 1 (Checked) */}
              <g transform="translate(50, 0)">
                <rect
                  width="24"
                  height="24"
                  stroke="#ec4899"
                  strokeWidth="2"
                  fill="none"
                  rx="4"
                />
                <use href="#tick-icon" />
                <rect
                  x="35"
                  y="5"
                  width="40"
                  height="14"
                  fill="url(#pixel-text)"
                  opacity="0.5"
                />
              </g>
              <line
                x1="150"
                y1="-20"
                x2="150"
                y2="45"
                stroke="#E5E7EB"
                strokeWidth="1"
              />

              {/* Checkbox 2 (Checked) */}
              <g transform="translate(200, 0)">
                <rect
                  width="24"
                  height="24"
                  stroke="#ec4899"
                  strokeWidth="2"
                  fill="none"
                  rx="4"
                />
                <use href="#tick-icon" />
                <rect
                  x="35"
                  y="5"
                  width="40"
                  height="14"
                  fill="url(#pixel-text)"
                  opacity="0.5"
                />
              </g>
              <line
                x1="300"
                y1="-20"
                x2="300"
                y2="45"
                stroke="#E5E7EB"
                strokeWidth="1"
              />

              {/* Checkbox 3 (Checked) */}
              <g transform="translate(350, 0)">
                <rect
                  width="24"
                  height="24"
                  stroke="#ec4899"
                  strokeWidth="2"
                  fill="none"
                  rx="4"
                />
                <use href="#tick-icon" />
                <rect
                  x="35"
                  y="5"
                  width="40"
                  height="14"
                  fill="url(#pixel-text)"
                  opacity="0.5"
                />
              </g>
            </g>
            <line
              x1="0"
              y1="100"
              x2="460"
              y2="100"
              stroke="#E5E7EB"
              strokeWidth="2"
            />
          </g>

          {/* ================= SECTION 4: Past Experience ================= */}
          <g transform="translate(0, 560)">
            <text y="20" fontSize="18" fontWeight="700" fill="#374151">
              Past Experience with the Obligor
            </text>
            <line
              x1="0"
              y1="35"
              x2="460"
              y2="35"
              stroke="#E5E7EB"
              strokeWidth="2"
            />

            {/* Checkbox Row (Unchecked) */}
            <g transform="translate(0, 55)">
              <g transform="translate(30, 0)">
                <rect
                  width="24"
                  height="24"
                  stroke="#D1D5DB"
                  strokeWidth="2"
                  fill="none"
                  rx="4"
                />
                <rect
                  x="35"
                  y="5"
                  width="60"
                  height="14"
                  fill="url(#pixel-text)"
                  opacity="0.5"
                />
              </g>
              <line
                x1="150"
                y1="-20"
                x2="150"
                y2="45"
                stroke="#E5E7EB"
                strokeWidth="1"
              />

              <g transform="translate(190, 0)">
                <rect
                  width="24"
                  height="24"
                  stroke="#D1D5DB"
                  strokeWidth="2"
                  fill="none"
                  rx="4"
                />
                <rect
                  x="35"
                  y="5"
                  width="60"
                  height="14"
                  fill="url(#pixel-text)"
                  opacity="0.5"
                />
              </g>
              <line
                x1="300"
                y1="-20"
                x2="300"
                y2="45"
                stroke="#E5E7EB"
                strokeWidth="1"
              />

              <g transform="translate(350, 0)">
                <rect
                  width="24"
                  height="24"
                  stroke="#D1D5DB"
                  strokeWidth="2"
                  fill="none"
                  rx="4"
                />
                <rect
                  x="35"
                  y="5"
                  width="40"
                  height="14"
                  fill="url(#pixel-text)"
                  opacity="0.5"
                />
              </g>
            </g>
            <line
              x1="0"
              y1="100"
              x2="460"
              y2="100"
              stroke="#E5E7EB"
              strokeWidth="1"
            />

            {/* Large Multi-line Text Area */}
            <g transform="translate(0, 120)">
              {/* Labels on the left */}
              <rect
                y="5"
                width="100"
                height="15"
                fill="url(#pixel-text)"
                opacity="0.5"
              />
              <rect
                y="45"
                width="80"
                height="15"
                fill="url(#pixel-text)"
                opacity="0.5"
              />

              {/* Text box and handwriting */}
              <rect
                x="130"
                width="330"
                height="80"
                stroke="#ec4899"
                strokeWidth="2"
                fill="none"
              />
              <g transform="translate(140, 10)">
                <use href="#scribble-long" />
                <use href="#scribble-short" transform="translate(200, 0)" />

                <g transform="translate(0, 40)">
                  <use href="#scribble-short" />
                  <use href="#scribble-long" transform="translate(80, 0)" />
                </g>
              </g>
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
};

export default EditSVG;
