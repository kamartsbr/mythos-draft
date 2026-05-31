import { useState, useEffect } from 'react';

export type Theme = 'greek' | 'norse' | 'egyptian' | 'atlantean' | 'chinese' | 'japanese' | 'aztec';
export type ColorblindMode = 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem('mythos_theme') as Theme) || 'greek';
  });
  
  const [colorblind, setColorblindState] = useState<ColorblindMode>(() => {
    return (localStorage.getItem('mythos_colorblind') as ColorblindMode) || 'none';
  });

  useEffect(() => {
    document.body.dataset.theme = theme;
    document.body.dataset.colorblind = colorblind;
    localStorage.setItem('mythos_theme', theme);
    localStorage.setItem('mythos_colorblind', colorblind);
  }, [theme, colorblind]);

  return { theme, setTheme: setThemeState, colorblind, setColorblind: setColorblindState };
}
