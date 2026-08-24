import React, { useState } from 'react';
import { TURKEY_PROVINCES_SVG, TURKEY_VIEWBOX } from '../data/turkeyMapSvgData';
import { Flame, Sparkles, Shield, Eye, Coins } from 'lucide-react';

export default function TurkeyMap({ provinces = {}, teams = [], onSelectProvince, lastUpdatedProvinceId }) {
  const [hoveredData, setHoveredData] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [showBadges, setShowBadges] = useState(true);
  const [showPrices, setShowPrices] = useState(true);

  const getTeam = (teamId) => {
    return teams.find(t => t.id === teamId) || {
      id: teamId,
      name: 'Belirsiz',
      shortName: '---',
      primaryColor: '#374151',
      secondaryColor: '#1f2937',
      textColor: '#FFFFFF',
      badge: '⚽'
    };
  };

  const getDbProvince = (svgItem) => {
    let lookupId = svgItem.id;
    if (lookupId.startsWith('istanbul')) lookupId = 'istanbul';
    return provinces[lookupId] || {
      id: lookupId,
      name: svgItem.name,
      plate: svgItem.plate,
      currentTeamId: 'galatasaray',
      currentBid: 5,
      lastBidder: 'Anonim'
    };
  };

  const handleMouseMove = (e) => {
    const bounds = e.currentTarget.getBoundingClientRect();
    setTooltipPos({
      x: e.clientX - bounds.left,
      y: e.clientY - bounds.top
    });
  };

  return (
    <div className="relative w-full bg-[#0b0f19] rounded-3xl border border-gray-800 p-4 lg:p-6 shadow-2xl overflow-hidden">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px] opacity-25 pointer-events-none"></div>
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Map Header Instructions & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 relative z-10">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <span>🗺️</span> TÜRKİYE TARAFTAR HARİTASI
          </h2>
          <p className="text-xs text-gray-400">
            Her il şu an o ili ele geçiren takımın <b>arması</b> ve <b>renkleriyle</b> parıldıyor!
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Toggle Badges Button */}
          <button
            onClick={() => setShowBadges(!showBadges)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
              showBadges 
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' 
                : 'bg-gray-900 border-gray-800 text-gray-400'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Armalar {showBadges ? 'Açık' : 'Kapalı'}</span>
          </button>

          {/* Toggle Prices Button */}
          <button
            onClick={() => setShowPrices(!showPrices)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
              showPrices 
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' 
                : 'bg-gray-900 border-gray-800 text-gray-400'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>Fiyatlar {showPrices ? 'Açık' : 'Kapalı'}</span>
          </button>
        </div>
      </div>

      {/* SVG Canvas Container */}
      <div 
        className="relative w-full select-none cursor-pointer"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredData(null)}
      >
        <svg
          viewBox={TURKEY_VIEWBOX || "0 0 1007.478 527.323"}
          className="w-full h-auto filter drop-shadow-2xl"
          style={{ maxHeight: '74vh' }}
        >
          <defs>
            {/* Dynamic Team Gradients */}
            {teams.map((team) => (
              <linearGradient key={`grad-${team.id}`} id={`grad-${team.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={team.primaryColor || '#374151'} />
                <stop offset="100%" stopColor={team.secondaryColor || team.primaryColor || '#111'} />
              </linearGradient>
            ))}

            {/* Pattern Stripes for Teams */}
            {teams.map((team) => (
              <pattern key={`pattern-${team.id}`} id={`pattern-${team.id}`} width="16" height="16" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                <rect x="0" y="0" width="8" height="16" fill={team.primaryColor || '#333'} />
                <rect x="8" y="0" width="8" height="16" fill={team.secondaryColor || team.primaryColor || '#111'} />
              </pattern>
            ))}

            {/* Glow Filter for Updated Province */}
            <filter id="glow-gold" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* 1. Render Province Polygons */}
          {TURKEY_PROVINCES_SVG.map((prov) => {
            const dbProv = getDbProvince(prov);
            const team = getTeam(dbProv.currentTeamId);
            const isHovered = hoveredData?.dbProv?.id === dbProv.id;
            const isJustUpdated = lastUpdatedProvinceId === dbProv.id;

            return (
              <g
                key={`poly-${prov.id}`}
                onClick={() => onSelectProvince(dbProv.id)}
                onMouseEnter={() => setHoveredData({ dbProv, svgItem: prov, team })}
                className="transition-all duration-150 cursor-pointer"
              >
                {prov.paths.map((pathStr, pIdx) => (
                  <path
                    key={pIdx}
                    d={pathStr}
                    fill={`url(#grad-${team.id})` || team.primaryColor || '#374151'}
                    stroke={isJustUpdated ? '#f59e0b' : isHovered ? '#ffffff' : '#070a12'}
                    strokeWidth={isJustUpdated ? 3.0 : isHovered ? 2.2 : 0.85}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    filter={isJustUpdated ? 'url(#glow-gold)' : undefined}
                    className={`transition-all duration-150 ${
                      isHovered ? 'filter brightness-125 drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]' : 'opacity-95 hover:opacity-100'
                    } ${isJustUpdated ? 'animate-pulse' : ''}`}
                  />
                ))}
              </g>
            );
          })}

          {/* 2. Render Team Crests & Badges Directly on Top of Cities */}
          {showBadges && TURKEY_PROVINCES_SVG.map((prov) => {
            // Avoid duplicate badges for istanbul parts
            if (prov.id === 'istanbul-asya') return null;
            
            const dbProv = getDbProvince(prov);
            const team = getTeam(dbProv.currentTeamId);
            const isHovered = hoveredData?.dbProv?.id === dbProv.id;
            const cx = prov.centerX || 500;
            const cy = prov.centerY || 250;

            return (
              <g
                key={`badge-${prov.id}`}
                onClick={() => onSelectProvince(dbProv.id)}
                onMouseEnter={() => setHoveredData({ dbProv, svgItem: prov, team })}
                className="pointer-events-none select-none transition-transform duration-200"
                style={{
                  transformOrigin: `${cx}px ${cy}px`,
                  transform: isHovered ? 'scale(1.25)' : 'scale(1)'
                }}
              >
                {/* Badge Outer Glow Circle */}
                <circle
                  cx={cx}
                  cy={cy}
                  r="10.5"
                  fill="#0b0f19"
                  stroke={team.secondaryColor || '#ffffff'}
                  strokeWidth="1.2"
                  className="filter drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]"
                />

                {/* Team Primary Color Fill */}
                <circle
                  cx={cx}
                  cy={cy}
                  r="8.5"
                  fill={team.primaryColor || '#333'}
                />

                {/* Team Badge Emoji or Short Code */}
                <text
                  x={cx}
                  y={cy}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="7.5"
                  fontWeight="900"
                  fill={team.textColor || "#ffffff"}
                  className="filter drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]"
                >
                  {team.shortName || team.badge}
                </text>

                {/* Optional Price Pill Under Badge */}
                {showPrices && (
                  <g transform={`translate(${cx}, ${cy + 13})`}>
                    <rect
                      x="-12"
                      y="-4.5"
                      width="24"
                      height="9"
                      rx="3.5"
                      fill="#090d16"
                      stroke="#f59e0b"
                      strokeWidth="0.6"
                      opacity="0.95"
                    />
                    <text
                      x="0"
                      y="0.5"
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize="5.5"
                      fontWeight="900"
                      fill="#fbbf24"
                    >
                      ₺{dbProv.currentBid}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip */}
        {hoveredData && (
          <div
            className="absolute z-50 pointer-events-none -translate-x-1/2 -translate-y-full pb-3 transition-transform duration-75"
            style={{
              left: `${Math.max(130, Math.min(tooltipPos.x, window.innerWidth > 768 ? 850 : 320))}px`,
              top: `${Math.max(110, tooltipPos.y)}px`
            }}
          >
            <div className="bg-[#0b101b]/95 backdrop-blur-md text-white border border-amber-500/50 rounded-2xl p-3.5 shadow-2xl min-w-[220px] max-w-[260px]">
              
              <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="bg-amber-500/20 text-amber-400 text-[10px] font-black px-1.5 py-0.5 rounded">
                    #{hoveredData.dbProv.plate}
                  </span>
                  <h4 className="font-extrabold text-sm text-white">
                    {hoveredData.dbProv.name}
                  </h4>
                </div>
                <span className="text-[10px] text-gray-400 font-medium">
                  {hoveredData.dbProv.region || 'Türkiye'}
                </span>
              </div>

              {/* Current Leading Team Info */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Hakim Kulüp:</span>
                  <span 
                    className="font-black px-2 py-0.5 rounded-lg text-white flex items-center gap-1.5 text-[11px] shadow-md border border-white/20"
                    style={{ backgroundColor: hoveredData.team.primaryColor || '#333' }}
                  >
                    <span className="text-sm">{hoveredData.team.badge}</span>
                    <span>{hoveredData.team.name}</span>
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Mevcut Fiyat:</span>
                  <span className="font-black text-amber-400 text-sm">
                    ₺{hoveredData.dbProv.currentBid}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-gray-400">
                  <span>Son Teklif Veren:</span>
                  <span className="text-gray-200 font-bold truncate max-w-[110px]">
                    @{hoveredData.dbProv.lastBidder || 'Anonim'}
                  </span>
                </div>

                <div className="pt-2 mt-1 border-t border-gray-800 text-center">
                  <div className="inline-flex items-center gap-1 text-[10px] font-black text-amber-400 bg-amber-950/60 px-2 py-1.5 rounded-xl border border-amber-800/60 w-full justify-center shadow-sm">
                    <Flame className="w-3.5 h-3.5 animate-bounce" />
                    <span>Ele Geçir (Min ₺{hoveredData.dbProv.currentBid + 1})</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>

      {/* Map Legend / Quick Bar */}
      <div className="mt-4 pt-4 border-t border-gray-800 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          <span className="text-gray-300 font-medium">Haritadaki armalar ve renkler en yüksek teklifi veren kulübe göre canlı değişir.</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#A90432]"></span> GS</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#001A5E]"></span> FB</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#111111]"></span> BJK</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#750B27]"></span> TS</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#008037]"></span> Amed / Diğer</span>
        </div>
      </div>

    </div>
  );
}
