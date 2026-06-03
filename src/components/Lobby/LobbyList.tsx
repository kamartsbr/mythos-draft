import { Eye, Users, ChevronRight, Info, Trash2, Search, RefreshCw, Loader2 } from 'lucide-react';
import { useState, useMemo } from 'react';
import { LobbySummary } from '../../types';
import { cn } from '../../lib/utils';
import { getMillis } from '../../services/lobbyService';

interface LobbyListProps {
  lobbies: LobbySummary[];
  t: any;
  isAdmin?: boolean;
  onJoin: (id: string) => void;
  onDelete?: (id: string) => void;
  onClearAll?: () => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  onFetchLobbies?: () => void;
  isLoadingLobbies?: boolean;
  hasBeenFetched?: boolean;
}

/**
 * Render a searchable list of lobbies with optional admin controls (clear, delete) and load-more support.
 *
 * Lobbies are NOT loaded automatically — the user must click "Browse Recent Drafts" to fetch them,
 * saving Firestore reads. A refresh button allows re-fetching without page reload.
 *
 * @param lobbies - Array of lobby summaries to display/search; assumed to be pre-sorted/limited when no search is active
 * @param t - Translation/label object used for UI text and confirmations
 * @param isAdmin - When true, enables admin-only UI controls
 * @param onJoin - Called with a lobby id when a lobby row is clicked
 * @param onDelete - Optional. Called with a lobby id after admin confirms deletion
 * @param onClearAll - Optional. Called when admin clears all history
 * @param onLoadMore - Optional. Called when the "load more" button is clicked
 * @param hasMore - Controls visibility of the "load more" button when true
 * @param onFetchLobbies - Called to fetch lobbies on demand
 * @param isLoadingLobbies - Whether lobbies are currently being fetched
 * @param hasBeenFetched - Whether lobbies have been fetched at least once
 * @returns A JSX element representing the lobby list UI
 */
export function LobbyList({ lobbies, t, isAdmin, onJoin, onDelete, onClearAll, onLoadMore, hasMore, onFetchLobbies, isLoadingLobbies, hasBeenFetched }: LobbyListProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLobbies = useMemo(() => {
    const search = searchTerm.toLowerCase().trim();
    const visibleLobbies = lobbies;
    
    // If there's a search term, search through ALL lobbies provided by the service
    if (search) {
      return visibleLobbies.filter(lobby => {
        const matchesId = lobby.id.toLowerCase().includes(search);
        const matchesName = (lobby.name || '').toLowerCase().includes(search);
        const matchesCaptain1 = ((lobby.teamAName || lobby.captain1Name) || '').toLowerCase().includes(search);
        const matchesCaptain2 = ((lobby.teamBName || lobby.captain2Name) || '').toLowerCase().includes(search);
        
        return matchesId || matchesName || matchesCaptain1 || matchesCaptain2;
      });
    }

    // Index is already sorted and limited by service
    return visibleLobbies;
  }, [lobbies, searchTerm]);

  const getLobbyStatus = (pub: LobbySummary) => {
    if (pub.status === 'finished') {
      return <span className="text-green-500 font-bold uppercase tracking-widest text-xs">{t.draftComplete}</span>;
    }

    // Show "waiting" status for lobbies with only 1 captain
    if (!pub.captain1 || !pub.captain2) {
      return <span className="text-amber-500 font-bold uppercase tracking-widest text-xs">{t.waitingForOpponent || "WAITING"}</span>;
    }
    
    const lastActivity = getMillis(pub.lastActivityAt) || getMillis(pub.createdAt) || Date.now();
    const isAbandoned = (Date.now() - lastActivity) > 2 * 60 * 60 * 1000;
    
    if (isAbandoned) {
      return <span className="text-slate-500 font-bold uppercase tracking-widest text-xs">{t.abandoned || "ABANDONED"}</span>;
    }
    
    return <span className="text-blue-500 font-bold uppercase tracking-widest text-xs">{t.draftingInProgress}</span>;
  };

  const showEmptyState = !hasBeenFetched && lobbies.length === 0;

  return (
    <div className="mythic-card overflow-hidden h-full flex flex-col">
      {/* ... (keep rest of UI) */}
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
          <div className="flex items-center gap-2">
            {/* Refresh button — visible after first fetch */}
            {hasBeenFetched && onFetchLobbies && (
              <button
                onClick={onFetchLobbies}
                disabled={isLoadingLobbies}
                className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white transition-all backdrop-blur-sm disabled:opacity-50"
                title={t.refreshLobbies || "Refresh"}
              >
                <RefreshCw className={cn("w-4 h-4", isLoadingLobbies && "animate-spin")} />
              </button>
            )}
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
          {/* Loading spinner */}
          {isLoadingLobbies && (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 text-blue-500 mx-auto mb-3 animate-spin" />
              <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">{t.loading || "Loading..."}</p>
            </div>
          )}

          {/* Not yet fetched — show browse button */}
          {!isLoadingLobbies && showEmptyState && (
            <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl">
              <Eye className="w-12 h-12 text-slate-700 mx-auto mb-4" />
              <p className="text-slate-400 text-sm mb-6">{t.lobbyListHidden || "Lobby list is hidden to save resources."}</p>
              {onFetchLobbies && (
                <button
                  onClick={onFetchLobbies}
                  className="px-6 py-3 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500 hover:text-white transition-all font-black text-sm uppercase tracking-widest flex items-center gap-2 mx-auto"
                >
                  <Eye className="w-4 h-4" />
                  {t.browseRecentDrafts || "Browse Recent Drafts"}
                </button>
              )}
            </div>
          )}

          {/* Fetched but empty (or search yielded no results) */}
          {!isLoadingLobbies && !showEmptyState && filteredLobbies.length === 0 && (
            <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl">
              <Users className="w-12 h-12 text-slate-700 mx-auto mb-4" />
              <p className="text-slate-500 text-sm">{searchTerm ? t.noResults : t.noDrafts}</p>
            </div>
          )}

          {/* Lobby list */}
          {!isLoadingLobbies && filteredLobbies.length > 0 && (
            <>
              {filteredLobbies.map(pub => (
                <div
                  key={pub.id}
                  onClick={() => onJoin(pub.id)}
                  role="button"
                  tabIndex={0}
                  className="w-full p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-blue-500/50 transition-all text-left flex items-center justify-between group cursor-pointer"
                  onKeyDown={(e) => e.key === 'Enter' && onJoin(pub.id)}
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-slate-200">{pub.name || `${pub.teamSize ?? 2}v${pub.teamSize ?? 2} Draft`}</span>
                      <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-400 font-mono">{pub.id}</span>
                    </div>
                    <p className="text-sm text-slate-500">
                      {pub.captain1Name || 'Captain 1'} vs {pub.captain2Name || 'Captain 2'} — {getLobbyStatus(pub)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {isAdmin && onDelete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`${t.confirmDelete || 'Delete this lobby?'} (${pub.id})`)) {
                            onDelete(pub.id);
                          }
                        }}
                        className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all border border-red-500/20 cursor-pointer"
                        title={t.deleteLobby || "Delete Lobby"}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <ChevronRight className="w-5 h-5 text-slate-700 group-hover:text-blue-500 transition-colors" />
                  </div>
                </div>
              ))}
              {hasMore && onLoadMore && (
                <button
                  onClick={onLoadMore}
                  className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all text-sm font-bold uppercase tracking-widest"
                >
                  {t.loadMore || "Carregar Mais"}
                </button>
              )}
            </>
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
