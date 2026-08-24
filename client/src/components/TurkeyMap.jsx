import React, { useState, useMemo } from 'react';
import { TURKEY_PROVINCES_SVG, TURKEY_VIEWBOX } from '../data/turkeyMapSvgData';
import { TEAMS_CLIENT } from '../data/teamsList';
import { Flame, Shield, Coins, ZoomIn, ZoomOut, RotateCcw, Search, Sparkles, TrendingUp, ChevronRight } from 'lucide-react';

export default function TurkeyMap({ provinces = {}, teams = [], onSelectProvince, lastUpdatedProvinceId }) {
  const [hoveredData, setHoveredData] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [showBadges, setShowBadges] = useState(true);
  const [showPrices, setShowPrices] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('ALL');

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
      currentBid: 0,
      lastBidder: 'Henüz Sahipsiz'
    };
  };

  // Top trending hot battles for mobile quick tap
  const hotProvinces = useMemo(() => {
    return TURKEY_PROVINCES_SVG
      .map(p => {
        const dbP = getDbProvince(p);
        const team = getTeam(dbP.currentTeamId);
        return { ...p, dbP, team };
      })
      .sort((a, b) => (b.dbP.currentBid || 0) - (a.dbP.currentBid || 0))
      .slice(0, 8);
  }, [provinces, teams]);

  // Search filter
  const searchedProvinces = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase();
    return TURKEY_PROVINCES_SVG
      .map(p => {
        const dbP = getDbProvince(p);
        const team = getTeam(dbP.currentTeamId);
        return { ...p, dbP, team };
      })
      .filter(item => 
        item.name.toLowerCase().includes(term) ||
        String(item.plate).includes(term) ||
        item.team.name.toLowerCase().includes(term) ||
        item.team.shortName.toLowerCase().includes(term)
      );
  }, [searchTerm, provinces, teams]);

  return (
    <div className="space-y-4">
      
      {/* 1. Mobile Hot Battles Quick Carousel */}
      <div className="bg-[#0b101b] rounded-2xl border border-gray-800/80 p-3 sm:p-4 shadow-xl">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-amber-400 fill-current animate-bounce" />
            <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
              🔥 Canlı Çarpışan Şehirler
            </h3>
          </div>
          <span className="text-[10px] text-gray-400 font-bold hidden sm:inline">Teklif vermek için tıkla</span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none snap-x touch-pan-x">
          {hotProvinces.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelectProvince(item.dbP.id)}
              className="snap-start shrink-0 flex items-center gap-2.5 p-2 sm:p-2.5 rounded-xl bg-gray-900/90 hover:bg-gray-800 border border-gray-800 hover:border-amber-500/50 text-left transition-all active:scale-95 cursor-pointer shadow-sm"
              style={{ minWidth: '150px' }}
            >
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black text-white shrink-0 shadow-md"
                style={{ backgroundColor: item.team.primaryColor || '#333' }}
              >
                {item.team.shortName}
              </div>
              <div className="truncate flex-1">
                <div className="text-xs font-black text-white truncate flex items-center gap-1">
                  <span>{item.name}</span>
                </div>
                <div className="text-[10px] text-amber-400 font-extrabold flex items-center justify-between">
                  <span>₺{item.dbP.currentBid}</span>
                  <span className="text-[9px] text-gray-400 font-normal truncate max-w-[60px]">@{item.dbP.lastBidder}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Main Map Card Container */}
      <div className="relative w-full bg-[#080c16] rounded-2xl sm:rounded-3xl border border-gray-800 p-3 sm:p-5 shadow-2xl overflow-hidden">
        
        {/* Header & Controls */}
        <div className="flex flex-col gap-2.5 mb-3 relative z-10">
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🗺️</span>
              <div>
                <h2 className="text-sm sm:text-lg font-black text-white tracking-tight">
                  TÜRKİYE TARAFTAR HARİTASI
                </h2>
                <p className="text-[10px] sm:text-xs text-gray-400">
                  Şehre dokun, takımının renklerine boya!
                </p>
              </div>
            </div>

            {/* Zoom Buttons */}
            <div className="flex items-center gap-1 bg-gray-900 border border-gray-800 p-1 rounded-xl">
              <button
                onClick={() => setZoomLevel(prev => Math.min(prev + 0.3, 2.5))}
                className="p-1.5 text-gray-300 hover:text-white rounded-lg active:scale-90 transition-all cursor-pointer"
                title="Yakınlaştır"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoomLevel(prev => Math.max(prev - 0.3, 0.9))}
                className="p-1.5 text-gray-300 hover:text-white rounded-lg active:scale-90 transition-all cursor-pointer"
                title="Uzaklaştır"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              {zoomLevel !== 1 && (
                <button
                  onClick={() => setZoomLevel(1)}
                  className="p-1.5 text-amber-400 hover:text-amber-300 rounded-lg active:scale-90 transition-all cursor-pointer"
                  title="Sıfırla"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Quick Search Input */}
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Şehir veya Takım ara (Örn: İstanbul, Trabzon, Amed, FB...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-900 border border-gray-800 focus:border-amber-400 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none transition-all"
            />
          </div>

          {/* Search Dropdown */}
          {searchTerm.trim() && (
            <div className="bg-gray-950 border border-gray-800 rounded-xl p-2 max-h-48 overflow-y-auto space-y-1 z-30 shadow-2xl">
              {searchedProvinces.length === 0 ? (
                <div className="text-xs text-gray-500 p-2 text-center">Sonuç bulunamadı.</div>
              ) : (
                searchedProvinces.map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectProvince(item.dbP.id);
                      setSearchTerm('');
                    }}
                    className="w-full flex items-center justify-between p-2 rounded-lg bg-gray-900 hover:bg-gray-800 text-left text-xs transition-all cursor-pointer active:scale-98"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{item.team.badge}</span>
                      <span className="font-bold text-white">{item.name} (#{item.plate})</span>
                      <span className="text-[10px] text-gray-400">({item.team.name})</span>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-amber-400">₺{item.dbP.currentBid}</span>
                      <div className="text-[9px] text-emerald-400">Ele Geçir →</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* SVG Container with Touch Pan / Scroll on Mobile */}
        <div 
          className="relative w-full select-none cursor-pointer overflow-x-auto overflow-y-hidden touch-pan-x touch-pan-y scrollbar-none rounded-xl"
        >
          <div 
            className="transition-transform duration-150 origin-center min-w-[580px] sm:min-w-full"
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

              {/* Polygons */}
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

              {/* Club Crest Shields & Labels */}
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
                    className="pointer-events-none select-none transition-transform duration-200"
                    style={{
                      transformOrigin: `${cx}px ${cy}px`,
                      transform: isHovered ? 'scale(1.35)' : 'scale(1)'
                    }}
                  >
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

                    {showPrices && dbProv.currentBid > 0 && (
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
        </div>

        {/* Bottom Legend */}
        <div className="mt-3 pt-2.5 border-t border-gray-800/80 flex items-center justify-between text-[10px] sm:text-xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span>Mobilde şehre dokunup hemen teklif verebilirsin.</span>
          </span>
          <span className="text-amber-400 font-bold">81 İl Canlı</span>
        </div>

      </div>

    </div>
  );
}
