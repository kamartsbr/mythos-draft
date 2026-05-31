import { ArrowLeft, Scroll } from 'lucide-react';
import { LanguageToggle } from '../components/UI/LanguageToggle';

interface Props {
  t: any;
  lang: string;
  setLang: (lang: string) => void;
}

export function TermsPage({ t, lang, setLang }: Props) {
  const l = t.legal;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6 md:p-12 selection:bg-amber-500/30">
      <div className="max-w-4xl mx-auto relative">
        <div className="flex items-center justify-between mb-8">
          <a href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-amber-500 transition-colors font-bold uppercase tracking-widest text-sm">
            <ArrowLeft className="w-4 h-4" />
            {l.backToHome}
          </a>
          <LanguageToggle lang={lang} setLang={setLang} />
        </div>
        
        <div className="mythic-card p-8 md:p-12 border border-slate-800 rounded-2xl bg-slate-900/50 backdrop-blur-sm shadow-2xl">
          <div className="flex items-center gap-4 mb-8 border-b border-slate-800 pb-8">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
              <Scroll className="w-8 h-8 text-amber-500" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tight">{l.termsTitle}</h1>
              <p className="text-slate-400 mt-2">{l.termsDesc}</p>
            </div>
          </div>

          <div className="prose prose-invert prose-amber max-w-none prose-headings:font-black prose-headings:uppercase prose-headings:tracking-widest prose-h2:text-xl prose-h2:mt-12 prose-p:text-slate-300 prose-p:leading-relaxed">
            <p className="text-sm font-bold text-amber-500/80 tracking-widest">{l.termsUpdated}</p>
            
            <h2>{l.termsSec1Title}</h2>
            <p dangerouslySetInnerHTML={{ __html: l.termsSec1Desc }} />

            <h2>{l.termsSec2Title}</h2>
            <p dangerouslySetInnerHTML={{ __html: l.termsSec2Desc }} />

            <h2>{l.termsSec3Title}</h2>
            <p dangerouslySetInnerHTML={{ __html: l.termsSec3Desc }} />

            <h2>{l.termsSec4Title}</h2>
            <p dangerouslySetInnerHTML={{ __html: l.termsSec4Desc }} />

            <h2>{l.termsSec5Title}</h2>
            <p dangerouslySetInnerHTML={{ __html: l.termsSec5Desc }} />
          </div>
        </div>
      </div>
    </div>
  );
}
