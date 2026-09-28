import type { CityId } from "@pitwall/world";
import type { ReactNode } from "react";

// Original flat-vector wallpapers, one per city (spec D19). Generic skylines and landscapes only:
// no trademarked buildings.
const ART: Record<CityId, ReactNode> = {
  jakarta: (
    <>
      <defs>
        <linearGradient id="wp-jakarta" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a2140" />
          <stop offset="0.55" stopColor="#b8503f" />
          <stop offset="1" stopColor="#f0a35e" />
        </linearGradient>
      </defs>
      <rect width="1600" height="1000" fill="url(#wp-jakarta)" />
      <circle cx="1210" cy="640" r="96" fill="#f7c873" opacity="0.85" />
      <g fill="#231b31">
        <rect x="60" y="560" width="150" height="440" />
        <rect x="230" y="470" width="110" height="530" />
        <rect x="360" y="610" width="170" height="390" />
        <path d="M784 300l16-44 16 44v320h-32z" />
        <rect x="740" y="620" width="120" height="30" />
        <rect x="700" y="650" width="200" height="350" />
        <rect x="940" y="520" width="140" height="480" />
        <rect x="1100" y="600" width="120" height="400" />
        <rect x="1240" y="450" width="160" height="550" />
        <rect x="1420" y="580" width="180" height="420" />
      </g>
      <rect y="880" width="1600" height="120" fill="#1a1426" />
    </>
  ),
  yogyakarta: (
    <>
      <defs>
        <linearGradient id="wp-yogyakarta" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3d3a2" />
          <stop offset="0.6" stopColor="#e7b98a" />
          <stop offset="1" stopColor="#9fbfa7" />
        </linearGradient>
      </defs>
      <rect width="1600" height="1000" fill="url(#wp-yogyakarta)" />
      <g fill="#efe7d6" opacity="0.9">
        <circle cx="905" cy="250" r="34" />
        <circle cx="950" cy="215" r="44" />
        <circle cx="1005" cy="190" r="38" />
      </g>
      <path d="M430 760L880 300h60l470 460z" fill="#6a7f6c" />
      <path d="M880 300h60l-20 40-14-18-12 22z" fill="#4e5e50" />
      <path d="M0 760h1600v240H0z" fill="#7aa183" />
      <g fill="#6a946f">
        <path d="M0 820h1600v24H0zM0 880h1600v24H0zM0 940h1600v24H0z" />
      </g>
      <path d="M180 700l120-70h180l120 70z" fill="#3b2c1e" />
      <path d="M230 700h320v70H230z" fill="#5a4330" />
    </>
  ),
  tokyo: (
    <>
      <defs>
        <linearGradient id="wp-tokyo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0f1730" />
          <stop offset="0.6" stopColor="#2c3a6b" />
          <stop offset="1" stopColor="#5d5a8a" />
        </linearGradient>
      </defs>
      <rect width="1600" height="1000" fill="url(#wp-tokyo)" />
      <circle cx="1300" cy="200" r="58" fill="#ece8d9" opacity="0.9" />
      <path d="M260 760L640 360l380 400z" fill="#3a4677" />
      <path d="M640 360l70 74-34-10-36 22-30-20-40 12z" fill="#dfe4f0" />
      <g fill="#121a33">
        <rect x="0" y="640" width="120" height="360" />
        <rect x="130" y="560" width="90" height="440" />
        <rect x="900" y="600" width="110" height="400" />
        <rect x="1020" y="520" width="80" height="480" />
        <rect x="1110" y="580" width="150" height="420" />
        <rect x="1270" y="480" width="100" height="520" />
        <rect x="1380" y="620" width="220" height="380" />
      </g>
      <g fill="#f3d27a" opacity="0.8">
        <rect x="150" y="600" width="10" height="14" />
        <rect x="1040" y="560" width="10" height="14" />
        <rect x="1300" y="530" width="10" height="14" />
        <rect x="1300" y="580" width="10" height="14" />
      </g>
    </>
  ),
  melbourne: (
    <>
      <defs>
        <linearGradient id="wp-melbourne" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bcd6e3" />
          <stop offset="1" stopColor="#f3ede2" />
        </linearGradient>
      </defs>
      <rect width="1600" height="1000" fill="url(#wp-melbourne)" />
      <g fill="#8aa3b1">
        <rect x="80" y="420" width="140" height="400" />
        <rect x="240" y="360" width="100" height="460" />
        <rect x="1160" y="380" width="120" height="440" />
        <rect x="1300" y="450" width="200" height="370" />
      </g>
      <path d="M0 610h1600" stroke="#35424a" strokeWidth="3" />
      <path d="M0 820h1600v180H0z" fill="#5b6770" />
      <g>
        <rect x="560" y="660" width="480" height="150" rx="14" fill="#2e6b4f" />
        <rect x="560" y="760" width="480" height="18" fill="#d9a441" />
        <g fill="#d8e8e4">
          <rect x="590" y="680" width="80" height="60" rx="6" />
          <rect x="690" y="680" width="80" height="60" rx="6" />
          <rect x="790" y="680" width="80" height="60" rx="6" />
          <rect x="890" y="680" width="120" height="60" rx="6" />
        </g>
        <path d="M800 660l-40-50h80z" fill="none" stroke="#35424a" strokeWidth="4" />
        <circle cx="640" cy="820" r="16" fill="#23292e" />
        <circle cx="960" cy="820" r="16" fill="#23292e" />
      </g>
    </>
  ),
};

export function Wallpaper({ city }: { city: CityId }) {
  return (
    <svg className="wallpaper" data-city={city} viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {ART[city]}
    </svg>
  );
}
