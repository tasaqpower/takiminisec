import React, { useState } from 'react';
import { Search, Flame, Filter, ArrowUpDown, Shield } from 'lucide-react';

export default function ProvinceGrid({ provinces = {}, teams = [], onSelectProvince }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('ALL');
  const [selectedTeamFilter, setSelectedTeamFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('bid_desc'); // 'bid_desc' | 'bid_asc' | 'plate' | 'name'

  const regions = [
    'ALL',
    'Marmara',
    'Ege',
    'Akdeniz',
    'İç Anadolu',
    'Karadeniz',
    'Doğu Anadolu',
    'Güneydoğu Anadolu'
  ];

  const getTeam = (teamId) => {
    return teams.find(t => t.id === teamId) || {
      id: teamId,
      name: teamId,
      shortName: teamId,
      primaryColor: '#333',
      badge: '⚽'
    };
  };

  const provinceList = Object.values(provinces);

  // Filtering
  const filtered = provinceList.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.plate.toString().includes(searchTerm);
    const matchesRegion = selectedRegion === 'ALL' || p.region === selectedRegion;
    const matchesTeam = selectedTeamFilter === 'ALL' || p.currentTeamId === selectedTeamFilter;
    return matchesSearch && matchesRegion && matchesTeam;
  });

  // Sorting
  filtered.sort((a, b) => {
    if (sortBy === 'bid_desc') return b.currentBid - a.currentBid;
    if (sortBy === 'bid_asc') return a.currentBid - b.currentBid;
    if (sortBy === 'plate') return a.plate - b.plate;
    if (sortBy === 'name') return a.name.localeCompare(b.name, 'tr');
    return 0;
  });

  return (
    <div className="bg-[#0d131f] rounded-2xl border border-gray-800 p-4 lg:p-6 shadow-2xl text-white">
      
      {/* Header and Controls */}
      <div className="flex flex-col gap-4 border-b border-gray-800/80 pb-5 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-black flex items-center gap-2">
              <span>📋</span> TÜM İLLER LİSTESİ ({filtered.length}/81)
            </h2>
            <p className="text-xs text-gray-400">
              Dilediğin şehri ara, takımına göre filtrele ve anında teklif ver!
            </p>
          </div>

          {/* Sort selector */}
          <div className="flex items-center gap-2 bg-gray-900 px-3 py-1.5 rounded-xl border border-gray-800 text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-gray-400">Sırala:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
            >
              <option value="bid_desc" className="bg-gray-900">En Yüksek Teklif</option>
              <option value="bid_asc" className="bg-gray-900">En Düşük Teklif</option>
              <option value="plate" className="bg-gray-900">Plaka No (1-81)</option>
              <option value="name" className="bg-gray-900">İl Adı (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="İl ara (Örn: Diyarbakır, 34, İzmir...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-900/90 border border-gray-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Region Dropdown */}
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="bg-gray-900/90 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="ALL">Tüm Bölgeler (7 Coğrafi Bölge)</option>
            {regions.filter(r => r !== 'ALL').map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          {/* Team Dropdown */}
          <select
            value={selectedTeamFilter}
            onChange={(e) => setSelectedTeamFilter(e.target.value)}
            className="bg-gray-900/90 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="ALL">Tüm Takımlar</option>
            {teams.map(t => (
              <option key={t.id} value={t.id}>{t.badge} {t.name}</option>
            ))}
          </select>

        </div>
      </div>

      {/* Provinces Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {filtered.map((prov) => {
          const team = getTeam(prov.currentTeamId);

          return (
            <div
              key={prov.id}
              onClick={() => onSelectProvince(prov.id)}
              className="group bg-gray-900/70 hover:bg-gray-800/90 border border-gray-800 hover:border-amber-500/50 rounded-2xl p-4 transition-all duration-200 cursor-pointer flex flex-col justify-between shadow-sm relative overflow-hidden"
            >
              {/* Corner Team Color Glow */}
              <div 
                className="absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl opacity-20 pointer-events-none transition-opacity group-hover:opacity-40"
                style={{ backgroundColor: team.primaryColor || '#f59e0b' }}
              ></div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded">
                      #{prov.plate}
                    </span>
                    <h4 className="font-extrabold text-sm text-white group-hover:text-amber-400 transition-colors">
                      {prov.name}
                    </h4>
                  </div>
                  <span className="text-[10px] text-gray-400">{prov.region}</span>
                </div>

                {/* Team Badge pill */}
                <div className="mt-2 mb-3">
                  <div 
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold text-white shadow-sm"
                    style={{ backgroundColor: team.primaryColor || '#333' }}
                  >
                    <span>{team.badge}</span>
                    <span className="truncate max-w-[130px]">{team.name}</span>
                  </div>
                </div>
              </div>

              {/* Bottom Bid Info & Action */}
              <div className="pt-3 border-t border-gray-800/80 flex items-center justify-between">
                <div>
                  <div className="text-[9px] text-gray-400 uppercase font-bold">Mevcut Teklif</div>
                  <div className="font-black text-amber-400 text-sm">₺{prov.currentBid}</div>
                </div>

                <button
                  type="button"
                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 group-hover:bg-amber-500 text-amber-300 group-hover:text-black font-black text-xs transition-all flex items-center gap-1"
                >
                  <Flame className="w-3 h-3" />
                  <span>Ele Geçir</span>
                </button>
              </div>

            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-500 text-xs">
          Arama kriterlerine uygun il bulunamadı.
        </div>
      )}

    </div>
  );
}
