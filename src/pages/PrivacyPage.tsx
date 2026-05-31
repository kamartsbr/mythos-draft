import { ArrowLeft, Shield } from 'lucide-react';
import { LanguageToggle } from '../components/UI/LanguageToggle';

interface Props {
  t: any;
  lang: string;
  setLang: (lang: string) => void;
}

export function PrivacyPage({ t, lang, setLang }: Props) {
  const l = t.legal;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6 md:p-12 selection:bg-indigo-500/30">
      <div className="max-w-4xl mx-auto relative">
        <div className="flex items-center justify-between mb-8">
          <a href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-indigo-400 transition-colors font-bold uppercase tracking-widest text-sm">
            <ArrowLeft className="w-4 h-4" />
            {l.backToHome}
          </a>
          <LanguageToggle lang={lang} setLang={setLang} />
        </div>
        
        <div className="mythic-card p-8 md:p-12 border border-slate-800 rounded-2xl bg-slate-900/50 backdrop-blur-sm shadow-2xl">
          <div className="flex items-center gap-4 mb-8 border-b border-slate-800 pb-8">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
              <Shield className="w-8 h-8 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tight">{l.privacyTitle}</h1>
              <p className="text-slate-400 mt-2">{l.privacyDesc}</p>
            </div>
          </div>

          <div className="prose prose-invert prose-indigo max-w-none prose-headings:font-black prose-headings:uppercase prose-headings:tracking-widest prose-h2:text-xl prose-h2:mt-12 prose-p:text-slate-300 prose-p:leading-relaxed">
            <p className="text-sm font-bold text-indigo-400/80 tracking-widest">{l.privacyUpdated}</p>

            <h2>{l.privacySec1Title}</h2>
            <p dangerouslySetInnerHTML={{ __html: l.privacySec1Desc }} />

            <h2>{l.privacySec2Title}</h2>
            <p dangerouslySetInnerHTML={{ __html: l.privacySec2Desc }} />

            <h2>{l.privacySec3Title}</h2>
            <p dangerouslySetInnerHTML={{ __html: l.privacySec3Desc }} />

            <h2>{l.privacySec4Title}</h2>
            <p dangerouslySetInnerHTML={{ __html: l.privacySec4Desc }} />

            <h2>{l.privacySec5Title}</h2>
            <p dangerouslySetInnerHTML={{ __html: l.privacySec5Desc }} />
          </div>
        </div>
      </div>
    </div>
  );
}
