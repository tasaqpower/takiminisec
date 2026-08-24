import React, { useState } from 'react';
import { TURKEY_PROVINCES_SVG, TURKEY_VIEWBOX } from '../data/turkeyMapSvgData';
import { TEAMS_CLIENT } from '../data/teamsList';
import { Flame, Sparkles, Shield, Coins, ZoomIn, ZoomOut, RotateCcw, Search } from 'lucide-react';

export default function TurkeyMap({ provinces = {}, teams = [], onSelectProvince, lastUpdatedProvinceId }) {
  const [hoveredData, setHoveredData] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [showBadges, setShowBadges] = useState(true);
  const [showPrices, setShowPrices] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  const allTeams = teams && teams.length > 0 ? teams : TEAMS_CLIENT;

  const getTeam = (teamId) => {
    return allTeams.find(t => t.id === teamId) || TEAMS_CLIENT.find(t => t.id === teamId) || {
      id: teamId || 'galatasaray',
      name: 'Galatasaray',
      shortName: 'GS',
      primaryColor: '#A90432',
      secondaryColor: '#FDB912',
      textColor: '#FFFFFF',
      badge: '🦁'
    };
  };

  const getDbProvince = (svgItem) => {
    let lookupId = svgItem.id;
    if (lookupId.startsWith('istanbul')) lookupId = 'istanbul';
    
    if (provinces && provinces[lookupId]) {
      return provinces[lookupId];
    }

    return {
      id: lookupId,
      name: svgItem.name,
      plate: svgItem.plate,
      currentTeamId: 'galatasaray',
      currentBid: 10,
      lastBidder: 'Cimbom'
    };
  };

  const handleMouseMove = (e) => {
    const bounds = e.currentTarget.getBoundingClientRect();
    setTooltipPos({
      x: e.clientX - bounds.left,
      y: e.clientY - bounds.top
    });
  };

  // Filtered provinces for mobile search
  const searchedProvinces = TURKEY_PROVINCES_SVG.filter(p => {
    if (!searchTerm.trim()) return false;
    const term = searchTerm.toLowerCase();
    const dbP = getDbProvince(p);
    const team = getTeam(dbP.currentTeamId);
    return p.name.toLowerCase().includes(term) || 
           String(p.plate).includes(term) ||
           team.name.toLowerCase().includes(term) ||
           team.shortName.toLowerCase().includes(term);
  });

  return (
    <div className="relative w-full bg-[#080c16] rounded-2xl sm:rounded-3xl border border-gray-800 p-3 sm:p-5 lg:p-6 shadow-2xl overflow-hidden">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-20 pointer-events-none"></div>

      {/* Map Header & Controls */}
      <div className="flex flex-col gap-3 mb-3 relative z-10">
        
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-xl font-black text-white flex items-center gap-1.5">
              <span>🗺️</span> <span>TÜRKİYE TARAFTAR HARİTASI</span>
            </h2>
            <p className="text-[11px] sm:text-xs text-gray-400">
              Dokunduğun şehri takımının renklerine boya!
            </p>
          </div>

          {/* Zoom controls for mobile & desktop */}
          <div className="flex items-center gap-1 bg-gray-900/90 border border-gray-800 p-1 rounded-xl">
            <button
              onClick={() => setZoomLevel(prev => Math.min(prev + 0.25, 2.5))}
              className="p-1.5 text-gray-300 hover:text-white rounded-lg hover:bg-gray-800 active:scale-95 transition-all"
              title="Yakınlaştır"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoomLevel(prev => Math.max(prev - 0.25, 0.9))}
              className="p-1.5 text-gray-300 hover:text-white rounded-lg hover:bg-gray-800 active:scale-95 transition-all"
              title="Uzaklaştır"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            {zoomLevel !== 1 && (
              <button
                onClick={() => setZoomLevel(1)}
                className="p-1.5 text-amber-400 hover:text-amber-300 rounded-lg hover:bg-gray-800 active:scale-95 transition-all"
                title="Sıfırla"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Mobile Search & Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Şehir veya Takım ara (Örn: 34, İzmir, Amed...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-900/80 border border-gray-800 focus:border-amber-400 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowBadges(!showBadges)}
              className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                showBadges 
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' 
                  : 'bg-gray-900 border-gray-800 text-gray-400'
              }`}
            >
              Armalar {showBadges ? '✓' : '✗'}
            </button>

            <button
              onClick={() => setShowPrices(!showPrices)}
              className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                showPrices 
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' 
                  : 'bg-gray-900 border-gray-800 text-gray-400'
              }`}
            >
              Fiyatlar {showPrices ? '✓' : '✗'}
            </button>
          </div>
        </div>

        {/* Mobile Search Results Dropdown */}
        {searchTerm.trim() && (
          <div className="bg-gray-950 border border-gray-800 rounded-xl p-2 max-h-48 overflow-y-auto space-y-1 z-20">
            {searchedProvinces.length === 0 ? (
              <div className="text-xs text-gray-500 p-2 text-center">Sonuç bulunamadı.</div>
            ) : (
              searchedProvinces.map(p => {
                const dbP = getDbProvince(p);
                const team = getTeam(dbP.currentTeamId);
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      onSelectProvince(dbP.id);
                      setSearchTerm('');
                    }}
                    className="w-full flex items-center justify-between p-2 rounded-lg bg-gray-900 hover:bg-gray-800 text-left text-xs transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{team.badge}</span>
                      <span className="font-bold text-white">{p.name} (#{p.plate})</span>
                      <span className="text-[10px] text-gray-400">({team.name})</span>
                    </div>
                    <span className="font-black text-amber-400">₺{dbP.currentBid}</span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* SVG Canvas Container with Smooth Scroll / Zoom for Mobile */}
      <div 
        className="relative w-full select-none cursor-pointer overflow-x-auto overflow-y-hidden touch-pan-x touch-pan-y scrollbar-thin scrollbar-thumb-gray-800"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredData(null)}
      >
        <div 
          className="transition-transform duration-200 origin-center min-w-[700px] sm:min-w-full"
          style={{ transform: `scale(${zoomLevel})` }}
        >
          <svg
            viewBox={TURKEY_VIEWBOX || "0 0 1007.478 527.323"}
            className="w-full h-auto filter drop-shadow-2xl"
          >
            <defs>
              {allTeams.map((team) => (
                <linearGradient key={`grad-${team.id}`} id={`grad-${team.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={team.primaryColor || '#374151'} />
                  <stop offset="100%" stopColor={team.secondaryColor || team.primaryColor || '#111'} />
                </linearGradient>
              ))}

              <filter id="city-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#f59e0b" floodOpacity="0.9" />
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
                      fill={team.primaryColor || `url(#grad-${team.id})` || '#374151'}
                      stroke={isJustUpdated ? '#f59e0b' : isHovered ? '#ffffff' : team.secondaryColor || '#070a12'}
                      strokeWidth={isJustUpdated ? 3.5 : isHovered ? 2.5 : 1.0}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      filter={isJustUpdated ? 'url(#city-glow)' : undefined}
                      className={`transition-all duration-150 ${
                        isHovered ? 'filter brightness-125' : 'opacity-95 hover:opacity-100'
                      } ${isJustUpdated ? 'animate-pulse' : ''}`}
                    />
                  ))}
                </g>
              );
            })}

            {/* 2. Render Club Crest Shields & Labels */}
            {showBadges && TURKEY_PROVINCES_SVG.map((prov) => {
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
                    transform: isHovered ? 'scale(1.35)' : 'scale(1)'
                  }}
                >
                  {/* Shield Shape */}
                  <path
                    d={`M ${cx - 9} ${cy - 8} 
                       L ${cx + 9} ${cy - 8} 
                       L ${cx + 9} ${cy + 1} 
                       C ${cx + 9} ${cy + 8}, ${cx} ${cy + 11}, ${cx} ${cy + 12} 
                       C ${cx} ${cy + 11}, ${cx - 9} ${cy + 8}, ${cx - 9} ${cy + 1} 
                       Z`}
                    fill={team.primaryColor || '#111'}
                    stroke={team.secondaryColor || '#ffffff'}
                    strokeWidth="1.5"
                    className="filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]"
                  />

                  {/* Club Code */}
                  <text
                    x={cx}
                    y={cy + 0.5}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="7.2"
                    fontWeight="900"
                    fontFamily="Inter, system-ui, sans-serif"
                    fill={team.textColor || '#ffffff'}
                    className="filter drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] tracking-tighter"
                  >
                    {team.shortName || team.name.substring(0, 3).toUpperCase()}
                  </text>

                  {/* Price Pill */}
                  {showPrices && (
                    <g transform={`translate(${cx}, ${cy + 16})`}>
                      <rect
                        x="-13"
                        y="-5"
                        width="26"
                        height="10"
                        rx="4"
                        fill="#050811"
                        stroke="#f59e0b"
                        strokeWidth="0.8"
                        opacity="0.95"
                      />
                      <text
                        x="0"
                        y="0.5"
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize="6"
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
        </div>

        {/* Hover Tooltip (Hidden on mobile touch screens for better UX) */}
        {hoveredData && (
          <div
            className="hidden sm:block absolute z-50 pointer-events-none -translate-x-1/2 -translate-y-full pb-3 transition-transform duration-75"
            style={{
              left: `${Math.max(130, Math.min(tooltipPos.x, 850))}px`,
              top: `${Math.max(110, tooltipPos.y)}px`
            }}
          >
            <div className="bg-[#0b101b]/95 backdrop-blur-md text-white border border-amber-500/50 rounded-2xl p-3.5 shadow-2xl min-w-[220px]">
              <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-2">
                <span className="bg-amber-500/20 text-amber-400 text-[10px] font-black px-1.5 py-0.5 rounded">
                  #{hoveredData.dbProv.plate} {hoveredData.dbProv.name}
                </span>
                <span className="text-[10px] text-gray-400">
                  {hoveredData.dbProv.region}
                </span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Takım:</span>
                  <span className="font-bold text-white">{hoveredData.team.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Fiyat:</span>
                  <span className="font-black text-amber-400">₺{hoveredData.dbProv.currentBid}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile-Friendly Hint */}
      <div className="mt-3 pt-3 border-t border-gray-800/80 flex items-center justify-between text-[10px] sm:text-xs text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          <span>Haritada istediğin şehre dokunarak teklif ver!</span>
        </span>
        <span className="hidden sm:inline">Kaydırarak & Yakınlaştırarak gezinebilirsin</span>
      </div>

    </div>
  );
}
