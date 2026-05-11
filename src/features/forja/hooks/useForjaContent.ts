import { useState, useEffect } from 'react';
import { ForjaContentDoc, ForjaPrizeConfig } from '../types';
import { getForjaContentOnce, cachedContent } from '../services/forjaService';

export function useForjaContent(docId: 'rules' | 'format') {
  const [data, setData]       = useState<ForjaContentDoc | null>(cachedContent[docId] || null);
  const [loading, setLoading] = useState(!cachedContent[docId]);

  useEffect(() => {
    if (cachedContent[docId]) return;

    let isMounted = true;
    getForjaContentOnce<ForjaContentDoc>(docId).then(d => {
      if (isMounted) {
        setData(d);
        setLoading(false);
      }
    }).catch(() => {
      if (isMounted) setLoading(false);
    });

    return () => { isMounted = false; };
  }, [docId]);

  return { data, loading };
}

export function useForjaPrizes() {
  const [data, setData]       = useState<ForjaPrizeConfig | null>(cachedContent['prizes'] || null);
  const [loading, setLoading] = useState(!cachedContent['prizes']);

  useEffect(() => {
    if (cachedContent['prizes']) return;

    let isMounted = true;
    getForjaContentOnce<ForjaPrizeConfig>('prizes').then(d => {
      if (isMounted) {
        setData(d);
        setLoading(false);
      }
    }).catch(() => {
      if (isMounted) setLoading(false);
    });

    return () => { isMounted = false; };
  }, []);

  return { data, loading };
}
