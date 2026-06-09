import { motion, AnimatePresence } from 'motion/react';
import { RotateCcw } from 'lucide-react';

type Props = {
  open: boolean;
  onReload: () => void;
};

/**
 * Render a fixed top-center status banner that prompts the user to reload when a new version is available.
 *
 * @param open - Controls whether the banner is visible.
 * @param onReload - Callback invoked when the user activates the update button.
 * @returns The banner element; renders no visible banner when `open` is `false`.
 */
export function VersionUpdateBanner({ open, onReload }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.98 }}
          transition={{ duration: 0.18 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[220] w-[min(92vw,560px)]"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-amber-500/30 bg-slate-950/95 backdrop-blur-xl px-4 py-3 shadow-2xl shadow-black/40">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.35em] text-amber-500/80">
                Nova versão disponível
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-100">
                Atualize para carregar a versão mais recente.
              </p>
            </div>

            <button
              type="button"
              onClick={onReload}
              data-testid="version-update-reload-button"
              className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-950 transition-colors hover:bg-amber-400"
            >
              <RotateCcw className="h-4 w-4" />
              Nova versão disponível — atualizar
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
