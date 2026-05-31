import fs from 'fs';
import path from 'path';

const localesDir = path.join(process.cwd(), 'src', 'locales');

const lobbyTranslations = {
  en: { 
    lobbyListHidden: "Lobby list is hidden to save resources.", 
    browseRecentDrafts: "Browse Recent Drafts" 
  },
  pt: { 
    lobbyListHidden: "A lista de lobbies está oculta para economizar recursos.", 
    browseRecentDrafts: "Explorar Drafts Recentes" 
  },
  es: { 
    lobbyListHidden: "La lista de lobbies está oculta para ahorrar recursos.", 
    browseRecentDrafts: "Explorar Drafts Recientes" 
  },
  fr: { 
    lobbyListHidden: "La liste des salons est masquée pour économiser les ressources.", 
    browseRecentDrafts: "Parcourir les Drafts Récents" 
  },
  de: { 
    lobbyListHidden: "Die Lobby-Liste ist ausgeblendet, um Ressourcen zu sparen.", 
    browseRecentDrafts: "Aktuelle Drafts durchsuchen" 
  },
  ru: { 
    lobbyListHidden: "Список лобби скрыт для экономии ресурсов.", 
    browseRecentDrafts: "Просмотр недавних драфтов" 
  },
  da: { 
    lobbyListHidden: "Lobby-listen er skjult for at spare ressourcer.", 
    browseRecentDrafts: "Gennemse seneste drafts" 
  },
  it: { 
    lobbyListHidden: "L'elenco delle lobby è nascosto per risparmiare risorse.", 
    browseRecentDrafts: "Sfoglia i Draft Recenti" 
  },
  mx: { 
    lobbyListHidden: "La lista de lobbies está oculta para ahorrar recursos.", 
    browseRecentDrafts: "Explorar Drafts Recientes" 
  }
};

for (const [lang, translations] of Object.entries(lobbyTranslations)) {
  const filePath = path.join(localesDir, `${lang}.json`);
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath, 'utf8');
    try {
      const json = JSON.parse(data);
      json.lobbyListHidden = translations.lobbyListHidden;
      json.browseRecentDrafts = translations.browseRecentDrafts;
      fs.writeFileSync(filePath, JSON.stringify(json, null, 2), 'utf8');
      console.log(`Updated ${lang}.json with lobby translations`);
    } catch (e) {
      console.error(`Error parsing ${lang}.json`, e);
    }
  }
}
