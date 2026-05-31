import { ArrowLeft, Info, Code2, Users, Heart } from 'lucide-react';
import { LanguageToggle } from '../components/UI/LanguageToggle';

interface Props {
  t: any;
  lang: string;
  setLang: (lang: string) => void;
}

export function AboutPage({ t, lang, setLang }: Props) {
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
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
              <Info className="w-8 h-8 text-cyan-500" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tight">{l.aboutTitle}</h1>
              <p className="text-slate-400 mt-2">{l.aboutDesc}</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                <Code2 className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h3 className="text-lg font-black uppercase tracking-widest text-white mb-2">{l.aboutProject}</h3>
                <p className="text-sm text-slate-400 leading-relaxed" dangerouslySetInnerHTML={{ __html: l.aboutProjectDesc }} />
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                <Users className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <h3 className="text-lg font-black uppercase tracking-widest text-white mb-2">{l.aboutCreator}</h3>
                <p className="text-sm text-slate-400 leading-relaxed" dangerouslySetInnerHTML={{ __html: l.aboutCreatorDesc }} />
              </div>
            </div>
          </div>

          <div className="prose prose-invert prose-cyan max-w-none prose-headings:font-black prose-headings:uppercase prose-headings:tracking-widest prose-h2:text-2xl prose-p:text-slate-300 prose-p:leading-relaxed">
            <h2>{l.aboutMission}</h2>
            <p dangerouslySetInnerHTML={{ __html: l.aboutMissionDesc }} />
            
            <div className="mt-12 p-6 bg-slate-900/50 border border-slate-800 rounded-xl text-center">
              <Heart className="w-8 h-8 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-black uppercase tracking-widest text-white mb-2">{l.aboutDonate}</h3>
              <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto" dangerouslySetInnerHTML={{ __html: l.aboutDonateDesc }} />
              <a 
                href="https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=joaocarfan@hotmail.com&currency_code=USD" 
                target="_blank" 
                rel="noreferrer"
                className="inline-block px-8 py-3 bg-amber-500 text-slate-950 font-black uppercase tracking-widest rounded-xl hover:bg-amber-400 transition-colors shadow-[0_0_15px_rgba(245,158,11,0.3)]"
              >
                {l.aboutDonateBtn}
              </a>
              <p className="text-xs text-slate-500 mt-4">{l.aboutContact}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
