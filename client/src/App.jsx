import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import Navbar from './components/Navbar';
import LiveTicker from './components/LiveTicker';
import TurkeyMap from './components/TurkeyMap';
import Leaderboard from './components/Leaderboard';
import ProvinceGrid from './components/ProvinceGrid';
import ProvinceModal from './components/ProvinceModal';
import HowToPlayModal from './components/HowToPlayModal';
import DepositModal from './components/DepositModal';
import { TEAMS_CLIENT } from './data/teamsList';
import { playTakeoverSound } from './utils/audio';

const SOCKET_URL = window.location.hostname === 'localhost' ? 'http://localhost:4000' : '/';

export default function App() {
  const [socket, setSocket] = useState(null);
  const [provinces, setProvinces] = useState({});
  const [teams, setTeams] = useState(TEAMS_CLIENT);
  const [activity, setActivity] = useState([]);
  const [stats, setStats] = useState({ totalBidsCount: 0, totalMoneySpent: 0, teamLeaderboard: [], topProvinces: [] });
  const [activeView, setActiveView] = useState('map');
  
  const [userBalance, setUserBalance] = useState(() => {
    const saved = localStorage.getItem('outbid_user_balance');
    return saved !== null ? Number(saved) : 0;
  });
  const [nickname, setNickname] = useState(() => {
    return localStorage.getItem('outbid_nickname') || '';
  });

  const [selectedProvinceId, setSelectedProvinceId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastUpdatedProvinceId, setLastUpdatedProvinceId] = useState(null);

  // 1. Initial REST Fetch on Mount for 100% instant data reliability
  useEffect(() => {
    fetch('/api/provinces')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.provinces) {
          setProvinces(data.provinces);
        }
      })
      .catch(err => console.warn('REST provinces load error:', err));

    fetch('/api/stats')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.stats) {
          setStats(data.stats);
        }
      })
      .catch(err => console.warn('REST stats load error:', err));

    fetch('/api/teams')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.teams) {
          setTeams(data.teams);
        }
      })
      .catch(err => console.warn('REST teams load error:', err));
  }, []);

  // 2. Real-Time WebSockets
  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('Connected to Outbid WebSocket server');
    });

    newSocket.on('initial_state', (data) => {
      if (data.provinces) setProvinces(data.provinces);
      if (data.teams && data.teams.length > 0) setTeams(data.teams);
      if (data.activity) setActivity(data.activity);
      if (data.stats) setStats(data.stats);
    });

    newSocket.on('province_updated', ({ province, activity: newActivity, stats: newStats }) => {
      setProvinces(prev => ({
        ...prev,
        [province.id]: province
      }));

      if (newActivity) {
        setActivity(prev => [newActivity, ...prev.slice(0, 49)]);
      }

      if (newStats) {
        setStats(newStats);
      }

      setLastUpdatedProvinceId(province.id);
      setTimeout(() => setLastUpdatedProvinceId(null), 3000);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const handleSelectProvince = (provinceId) => {
    setSelectedProvinceId(provinceId);
    setIsModalOpen(true);
  };

  const handleDepositSuccess = (addedAmount) => {
    const newBalance = userBalance + Number(addedAmount);
    setUserBalance(newBalance);
    localStorage.setItem('outbid_user_balance', newBalance);
  };

  const handlePlaceBid = ({ provinceId, teamId, amount, bidder, note }) => {
    return new Promise((resolve, reject) => {
      setIsSubmitting(true);

      const bidPayload = { provinceId, teamId, amount, bidder, note };

      // Optimistic instant update in UI
      setProvinces(prev => {
        const current = prev[provinceId] || {};
        return {
          ...prev,
          [provinceId]: {
            ...current,
            currentTeamId: teamId,
            currentBid: Number(amount),
            lastBidder: bidder
          }
        };
      });

      if (!socket || !socket.connected) {
        fetch('/api/bid', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bidPayload)
        })
          .then(res => res.json())
          .then(res => {
            setIsSubmitting(false);
            if (res.success) {
              const nextBal = Math.max(0, userBalance - Number(amount));
              setUserBalance(nextBal);
              localStorage.setItem('outbid_user_balance', nextBal);
              resolve(res);
            } else {
              reject(new Error(res.error));
            }
          })
          .catch(err => {
            setIsSubmitting(false);
            reject(err);
          });
        return;
      }

      socket.emit('place_bid', bidPayload, (response) => {
        setIsSubmitting(false);
        if (response?.success) {
          const nextBal = Math.max(0, userBalance - Number(amount));
          setUserBalance(nextBal);
          localStorage.setItem('outbid_user_balance', nextBal);
          resolve(response.data);
        } else {
          reject(new Error(response?.error || 'Teklif verilemedi!'));
        }
      });
    });
  };

  const selectedProvince = selectedProvinceId ? provinces[selectedProvinceId] : null;

  return (
    <div className="min-h-screen bg-[#070a12] text-gray-100 flex flex-col selection:bg-amber-500 selection:text-black">
      
      {/* 1. Header Navbar */}
      <Navbar
        stats={stats}
        onOpenHowToPlay={() => setIsHowToPlayOpen(true)}
        onOpenWallet={() => setIsWalletOpen(true)}
        userBalance={userBalance}
        nickname={nickname}
        activeView={activeView}
        setActiveView={setActiveView}
      />

      {/* 2. Live Takeover Ticker */}
      <LiveTicker
        activity={activity}
        teams={teams}
        onSelectProvince={handleSelectProvince}
      />

      {/* 3. Main Body Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 space-y-6">
        
        {activeView === 'map' && (
          <div className="space-y-6">
            <TurkeyMap
              provinces={provinces}
              teams={teams}
              onSelectProvince={handleSelectProvince}
              lastUpdatedProvinceId={lastUpdatedProvinceId}
            />

            <Leaderboard
              stats={stats}
              teams={teams}
              onSelectProvince={handleSelectProvince}
            />
          </div>
        )}

        {activeView === 'grid' && (
          <ProvinceGrid
            provinces={provinces}
            teams={teams}
            onSelectProvince={handleSelectProvince}
          />
        )}

        {activeView === 'leaderboard' && (
          <Leaderboard
            stats={stats}
            teams={teams}
            onSelectProvince={handleSelectProvince}
          />
        )}

      </main>

      {/* 4. Footer */}
      <footer className="border-t border-gray-800/80 bg-[#0a0f1a] py-6 text-center text-xs text-gray-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-300">takiminisec.lol</span>
            <span>•</span>
            <span>Türkiye Taraftar Meydanı ⚽</span>
          </div>
          <div className="text-[11px] text-gray-400">
            Süper Lig & 1. Lig 81 İl Canlı Açık Artırma ve Bakiye Sistemi
          </div>
        </div>
      </footer>

      {/* 5. Modals */}
      <ProvinceModal
        province={selectedProvince}
        teams={teams}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onPlaceBid={handlePlaceBid}
        isSubmitting={isSubmitting}
        userBalance={userBalance}
        onOpenWallet={() => {
          setIsModalOpen(false);
          setIsWalletOpen(true);
        }}
      />

      <DepositModal
        isOpen={isWalletOpen}
        onClose={() => setIsWalletOpen(false)}
        currentBalance={userBalance}
        onDepositSuccess={handleDepositSuccess}
        nickname={nickname}
      />

      <HowToPlayModal
        isOpen={isHowToPlayOpen}
        onClose={() => setIsHowToPlayOpen(false)}
      />

    </div>
  );
}
