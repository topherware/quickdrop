"use client";
import { useId } from "react";
import { useLanguage } from "./language";

export function DeviceTransferIllustration() {
  const { t } = useLanguage();
  const id = useId();
  return (
    <div className="device-illustration">
      <svg
        viewBox="0 0 460 254"
        role="img"
        aria-label={t("File berpindah dari ponsel ke laptop")}
      >
        <defs>
          <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#d8c4ff" stopOpacity=".16" />
            <stop offset="1" stopColor="#6c8be3" stopOpacity=".04" />
          </linearGradient>
          <linearGradient
            id={`${id}-light`}
            gradientUnits="userSpaceOnUse"
            x1="126"
            y1="126"
            x2="282"
            y2="126"
          >
            <stop stopColor="#b798ff" />
            <stop offset="1" stopColor="#8cdde9" />
          </linearGradient>
          <linearGradient id={`${id}-packet`} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#a97aff" />
            <stop offset="1" stopColor="#686bcb" />
          </linearGradient>
        </defs>
        <ellipse
          cx="230"
          cy="136"
          rx="200"
          ry="100"
          fill="none"
          stroke="#c6b7ff"
          strokeOpacity=".10"
        />
        <path
          d="M126 126H282"
          fill="none"
          stroke={`url(#${id}-light)`}
          strokeWidth="2"
          strokeDasharray="4 6"
        />
        <path
          d="m270 118 12 8-12 8"
          fill="none"
          stroke="#8cdde9"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <g className="illustration-phone">
          <rect
            x="24"
            y="28"
            width="102"
            height="185"
            rx="22"
            fill={`url(#${id}-glass)`}
            stroke="#d8c4ff"
            strokeOpacity=".45"
          />
          <rect
            x="30"
            y="34"
            width="90"
            height="173"
            rx="18"
            fill="#161b31"
            fillOpacity=".7"
            stroke="#fff"
            strokeOpacity=".06"
          />
          <rect x="58" y="42" width="34" height="5" rx="3" fill="#b8b0d4" />
          <rect
            x="45"
            y="69"
            width="60"
            height="66"
            rx="12"
            fill="#a577ff"
            fillOpacity=".12"
          />
          <path
            d="M63 85h16l9 9v24H63z M79 85v10h9 M69 103h12 M69 110h8"
            fill="none"
            stroke="#dac5ff"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <rect
            x="45"
            y="146"
            width="60"
            height="5"
            rx="2.5"
            fill="#c6b7ff"
            fillOpacity=".55"
          />
          <rect
            x="45"
            y="158"
            width="40"
            height="4"
            rx="2"
            fill="#c6b7ff"
            fillOpacity=".2"
          />
          <rect x="57" y="195" width="36" height="3" rx="1.5" fill="#b8b0d4" />
        </g>
        <g className="illustration-laptop">
          <rect
            x="284"
            y="65"
            width="150"
            height="112"
            rx="12"
            fill={`url(#${id}-glass)`}
            stroke="#bbceff"
            strokeOpacity=".45"
          />
          <rect
            x="291"
            y="72"
            width="136"
            height="97"
            rx="7"
            fill="#151d32"
            fillOpacity=".75"
          />
          <circle cx="299" cy="80" r="2" fill="#bdadf0" />
          <circle cx="306" cy="80" r="2" fill="#bdadf0" fillOpacity=".5" />
          <circle cx="313" cy="80" r="2" fill="#bdadf0" fillOpacity=".25" />
          <rect
            x="303"
            y="100"
            width="112"
            height="45"
            rx="8"
            fill="#a577ff"
            fillOpacity=".1"
            stroke="#c6b7ff"
            strokeOpacity=".18"
          />
          <path
            d="M315 110h11l7 7v17h-18z M326 110v7h7"
            fill="none"
            stroke="#dac5ff"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="m389 123 5 5 9-11"
            fill="none"
            stroke="#9ce5cb"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <rect
            x="343"
            y="113"
            width="34"
            height="4"
            rx="2"
            fill="#c6b7ff"
            fillOpacity=".55"
          />
          <rect
            x="343"
            y="124"
            width="23"
            height="3"
            rx="1.5"
            fill="#c6b7ff"
            fillOpacity=".25"
          />
          <path
            d="M274 178h170l-6 10H280z"
            fill="#262b44"
            stroke="#bbceff"
            strokeOpacity=".3"
          />
          <path d="M340 179h39l-3 3h-33z" fill="#c6b7ff" fillOpacity=".35" />
        </g>
        <g className="transfer-packet">
          <rect
            x="176"
            y="100"
            width="42"
            height="52"
            rx="11"
            fill={`url(#${id}-packet)`}
            stroke="#e9d7ff"
            strokeOpacity=".7"
          />
          <path
            d="M188 110h11l7 7v23h-18z M199 110v8h7 M193 124h9 M193 130h7"
            fill="none"
            stroke="#f5edff"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </g>
        <text x="75" y="240" textAnchor="middle" className="illustration-label">
          {t("Ponsel")}
        </text>
        <text
          x="359"
          y="217"
          textAnchor="middle"
          className="illustration-label"
        >
          {t("Laptop")}
        </text>
      </svg>
    </div>
  );
}
