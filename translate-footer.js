import fs from 'fs';
import path from 'path';

const localesDir = path.join(process.cwd(), 'src', 'locales');

const shortLinks = {
  en: { about: "About", terms: "Terms", privacy: "Privacy", cookies: "Cookies" },
  pt: { about: "Sobre", terms: "Termos", privacy: "Privacidade", cookies: "Cookies" },
  es: { about: "Acerca de", terms: "Términos", privacy: "Privacidad", cookies: "Cookies" },
  fr: { about: "À propos", terms: "Conditions", privacy: "Confidentialité", cookies: "Cookies" },
  de: { about: "Über", terms: "Bedingungen", privacy: "Datenschutz", cookies: "Cookies" },
  ru: { about: "О нас", terms: "Условия", privacy: "Конфиденциальность", cookies: "Cookies" },
  da: { about: "Om", terms: "Vilkår", privacy: "Privatliv", cookies: "Cookies" },
  it: { about: "Info", terms: "Termini", privacy: "Privacy", cookies: "Cookie" },
  mx: { about: "Acerca de", terms: "Términos", privacy: "Privacidad", cookies: "Cookies" }
};

for (const [lang, links] of Object.entries(shortLinks)) {
  const filePath = path.join(localesDir, `${lang}.json`);
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath, 'utf8');
    try {
      const json = JSON.parse(data);
      if (!json.legal) json.legal = {};
      json.legal.navAbout = links.about;
      json.legal.navTerms = links.terms;
      json.legal.navPrivacy = links.privacy;
      json.legal.navCookies = links.cookies;
      fs.writeFileSync(filePath, JSON.stringify(json, null, 2), 'utf8');
      console.log(`Updated ${lang}.json with footer links`);
    } catch (e) {
      console.error(`Error parsing ${lang}.json`, e);
    }
  }
}
