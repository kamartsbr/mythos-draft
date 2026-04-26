import { Eye, Users, ChevronRight, Info, Trash2, Search } from 'lucide-react';
import { useState, useMemo } from 'react';
import { Lobby } from '../../types';
import { cn } from '../../lib/utils';

interface LobbyListProps {
  lobbies: Lobby[];
  t: any;
  isAdmin?: boolean;
  onJoin: (id: string) => void;
  onClearAll?: () => void;
}

export function LobbyList({ lobbies, t, isAdmin, onJoin, onClearAll }: LobbyListProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLobbies = useMemo(() => {
    const search = searchTerm.toLowerCase().trim();
    const visibleLobbies = lobbies.filter(l => l.captain1 && l.captain2);
    
    // If there's a search term, search through ALL lobbies provided by the service
    if (search) {
      return visibleLobbies.filter(lobby => {
        const matchesId = lobby.id.toLowerCase().includes(search);
        const matchesName = (lobby.config.name || '').toLowerCase().includes(search);
        const matchesCaptain1 = (lobby.captain1Name || '').toLowerCase().includes(search);
        const matchesCaptain2 = (lobby.captain2Name || '').toLowerCase().includes(search);
        const matchesSpectators = (lobby.spectators || []).some(s => s.name.toLowerCase().includes(search));
        
        return matchesId || matchesName || matchesCaptain1 || matchesCaptain2 || matchesSpectators;
      });
    }

    // If no search term, filter out abandoned drafts and show the latest 20
    return visibleLobbies.filter(lobby => {
      if (lobby.status === 'finished') return true;
      
      const lastActivity = lobby.lastActivityAt?.toMillis?.() || lobby.createdAt?.toMillis?.() || Date.now();
      const isAbandoned = (Date.now() - lastActivity) > 2 * 60 * 60 * 1000; // 2 hours
      
      return !isAbandoned;
    }).slice(0, 20);
  }, [lobbies, searchTerm]);

  const getLobbyStatus = (pub: Lobby) => {
    if (pub.status === 'finished') {
      return <span className="text-green-500 font-bold uppercase tracking-widest text-xs">{t.draftComplete}</span>;
    }
    if (pub.status === 'INCOMPLETE') {
      return <span className="text-red-500 font-bold uppercase tracking-widest text-xs">{t.incomplete || "INCOMPLETE"}</span>;
    }
    
    const lastActivity = pub.lastActivityAt?.toMillis?.() || pub.createdAt?.toMillis?.() || Date.now();
    const isAbandoned = (Date.now() - lastActivity) > 2 * 60 * 60 * 1000;
    
    if (isAbandoned) {
      return <span className="text-slate-500 font-bold uppercase tracking-widest text-xs">{t.abandoned || "ABANDONED"}</span>;
    }
    
    return <span className="text-blue-500 font-bold uppercase tracking-widest text-xs">{t.draftingInProgress}</span>;
  };

  return (
    <div className="mythic-card overflow-hidden h-full flex flex-col">
      {/* Hero Banner */}
      <div className="h-24 md:h-32 relative shrink-0 overflow-hidden">
        <img 
          src="https://static.wikia.nocookie.net/ageofempires/images/d/d3/AoMR_OM_cover_portrait.jpg/revision/latest" 
          alt="Age of Mythology Banner" 
          className="w-full h-full object-cover opacity-40"
          referrerPolicy="no-referrer"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
        <div className="absolute bottom-4 left-8 right-8 flex items-center justify-between">
          <h2 className="text-2xl font-black mythic-text flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 backdrop-blur-sm">
              <Eye className="w-5 h-5 text-blue-500" />
            </div>
            {t.spectate}
          </h2>
          {isAdmin && onClearAll && (
            <button 
              onClick={onClearAll}
              className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center gap-2 text-xs font-black uppercase tracking-widest backdrop-blur-sm"
            >
              <Trash2 className="w-4 h-4" />
              {t.clearHistory || "Limpar Tudo"}
            </button>
          )}
        </div>
      </div>

      <div className="p-8 pt-4 flex-1 flex flex-col min-h-0">
        {/* Search Bar */}
        <div className="relative mb-6 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
          <input 
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-all placeholder:text-slate-600"
          />
        </div>

        <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
          {filteredLobbies.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl">
              <Users className="w-12 h-12 text-slate-700 mx-auto mb-4" />
              <p className="text-slate-500 text-sm">{searchTerm ? t.noResults : t.noDrafts}</p>
            </div>
          ) : (
            filteredLobbies.map(pub => (
              <button
                key={pub.id}
                onClick={() => onJoin(pub.id)}
                className="w-full p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-blue-500/50 transition-all text-left flex items-center justify-between group"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-slate-200">{pub.config.name || `${pub.config.teamSize}v${pub.config.teamSize} Draft`}</span>
                    <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-400 font-mono">{pub.id}</span>
                  </div>
                  <p className="text-sm text-slate-500">
                    {pub.captain1Name || 'Captain 1'} vs {pub.captain2Name || 'Captain 2'} • {getLobbyStatus(pub)}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-700 group-hover:text-blue-500 transition-colors" />
              </button>
            ))
          )}
        </div>

        <div className="mt-8 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 text-blue-400/80 text-xs leading-relaxed shrink-0">
          <Info className="w-4 h-4 mb-2" />
          {searchTerm 
            ? t.searchingAll 
            : t.showingRecent}
        </div>
      </div>
  </div>
);
}
