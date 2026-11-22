import arcticBastionAerial from '../assets/images/map_aerial_arctic_bastion_1794933952266.jpg';
import cyberColosseumAerial from '../assets/images/map_aerial_cyber_colosseum_1794933951481.jpg';
import neonReactorAerial from '../assets/images/map_aerial_neon_reactor_1794864693632.jpg';
import obsidianMazeAerial from '../assets/images/map_aerial_obsidian_maze_1794864695185.jpg';
import skyCitadelAerial from '../assets/images/map_aerial_sky_citadel_1794864694576.jpg';
import volcanicForgeAerial from '../assets/images/map_aerial_volcanic_forge_1794933952639.jpg';
import type { ArenaMapId } from '../shared/types';

function encodeSvg(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const solarTempleAerial = encodeSvg(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
  <defs>
    <radialGradient id="sun" cx="50%" cy="50%" r="65%">
      <stop offset="0%" stop-color="#fde68a" stop-opacity="0.35"/>
      <stop offset="55%" stop-color="#b45309" stop-opacity="0.65"/>
      <stop offset="100%" stop-color="#451a03"/>
    </radialGradient>
  </defs>
  <rect width="640" height="360" fill="#5c3314"/>
  <rect width="640" height="360" fill="url(#sun)"/>
  <g stroke="#d97706" stroke-opacity="0.25" stroke-width="2">
    <line x1="0" y1="90" x2="640" y2="90"/><line x1="0" y1="180" x2="640" y2="180"/><line x1="0" y1="270" x2="640" y2="270"/>
    <line x1="160" y1="0" x2="160" y2="360"/><line x1="320" y1="0" x2="320" y2="360"/><line x1="480" y1="0" x2="480" y2="360"/>
  </g>
  <rect x="85" y="42" width="76" height="76" rx="6" fill="#cfa165" stroke="#14b8a6" stroke-width="4"/>
  <rect x="479" y="42" width="76" height="76" rx="6" fill="#cfa165" stroke="#f59e0b" stroke-width="4"/>
  <rect x="85" y="242" width="76" height="76" rx="6" fill="#cfa165" stroke="#f59e0b" stroke-width="4"/>
  <rect x="479" y="242" width="76" height="76" rx="6" fill="#cfa165" stroke="#14b8a6" stroke-width="4"/>
  <rect x="242" y="102" width="156" height="156" rx="8" fill="#b8884f" stroke="#f59e0b" stroke-width="5"/>
  <rect x="266" y="126" width="108" height="108" rx="6" fill="#cfa165" stroke="#14b8a6" stroke-width="4"/>
  <rect x="290" y="150" width="60" height="60" rx="4" fill="#e6be81" stroke="#fbbf24" stroke-width="4"/>
  <circle cx="320" cy="180" r="14" fill="#fbbf24"/>
  <rect x="195" y="88" width="22" height="22" fill="#fbbf24" opacity="0.85"/>
  <rect x="423" y="88" width="22" height="22" fill="#14b8a6" opacity="0.85"/>
  <rect x="195" y="250" width="22" height="22" fill="#14b8a6" opacity="0.85"/>
  <rect x="423" y="250" width="22" height="22" fill="#fbbf24" opacity="0.85"/>
</svg>
`);

const orbitalStationAerial = encodeSvg(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
  <defs>
    <radialGradient id="nebula" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#312e81" stop-opacity="0.7"/>
      <stop offset="60%" stop-color="#0f172a" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#030512"/>
    </radialGradient>
  </defs>
  <rect width="640" height="360" fill="#030512"/>
  <rect width="640" height="360" fill="url(#nebula)"/>
  <g fill="#e0e7ff" opacity="0.75">
    <circle cx="52" cy="40" r="1.8"/><circle cx="120" cy="310" r="1.5"/><circle cx="580" cy="55" r="2"/>
    <circle cx="545" cy="315" r="1.6"/><circle cx="430" cy="35" r="1.4"/><circle cx="215" cy="42" r="1.6"/>
  </g>
  <circle cx="320" cy="180" r="142" fill="none" stroke="#818cf8" stroke-opacity="0.35" stroke-width="4" stroke-dasharray="14 8"/>
  <rect x="210" y="34" width="220" height="58" rx="8" fill="#475569" stroke="#22d3ee" stroke-width="4"/>
  <rect x="210" y="268" width="220" height="58" rx="8" fill="#475569" stroke="#818cf8" stroke-width="4"/>
  <rect x="64" y="122" width="28" height="116" rx="4" fill="#64748b" stroke="#818cf8" stroke-width="3"/>
  <rect x="548" y="122" width="28" height="116" rx="4" fill="#64748b" stroke="#22d3ee" stroke-width="3"/>
  <rect x="256" y="116" width="128" height="128" rx="12" fill="#334155" stroke="#818cf8" stroke-width="5"/>
  <circle cx="320" cy="180" r="24" fill="#0f172a" stroke="#22d3ee" stroke-width="5"/>
  <circle cx="320" cy="180" r="10" fill="#22d3ee"/>
</svg>
`);

export const MAP_AERIAL_IMAGES: Record<ArenaMapId, string> = {
  neon_reactor: neonReactorAerial,
  sky_citadel: skyCitadelAerial,
  obsidian_maze: obsidianMazeAerial,
  cyber_colosseum: cyberColosseumAerial,
  arctic_bastion: arcticBastionAerial,
  volcanic_forge: volcanicForgeAerial,
  solar_temple: solarTempleAerial,
  orbital_station: orbitalStationAerial,
};
