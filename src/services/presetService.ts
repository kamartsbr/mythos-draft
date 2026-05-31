import { collection, doc, setDoc, getDocs, updateDoc, increment, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { LobbyConfig } from '../types';

export type PublicPreset = {
  id: string;
  name: string;
  description: string;
  authorUid: string;
  authorName: string;
  config: LobbyConfig;
  upvotes: number;
  createdAt: any;
};

export const presetService = {
  async publishPreset(name: string, description: string, config: LobbyConfig, authorName: string) {
    if (!auth.currentUser) throw new Error("Must be logged in to publish a preset");
    const docRef = doc(collection(db, 'public_presets'));
    const preset: Partial<PublicPreset> = {
      id: docRef.id,
      name,
      description,
      authorUid: auth.currentUser.uid,
      authorName,
      config,
      upvotes: 0,
      createdAt: serverTimestamp()
    };
    await setDoc(docRef, preset);
    return docRef.id;
  },

  async getPresets() {
    const q = query(collection(db, 'public_presets'), orderBy('upvotes', 'desc'), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as PublicPreset);
  },

  async upvotePreset(id: string) {
    if (!auth.currentUser) throw new Error("Must be logged in to upvote");
    const docRef = doc(db, 'public_presets', id);
    await updateDoc(docRef, { upvotes: increment(1) });
  }
};
