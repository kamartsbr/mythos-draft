async updateLobby(id: string, updates: Partial<Lobby>): Promise<void> {
  if (IS_DEV) {
    const current = getLocalLobby(id) || ({ ...MOCK_LOBBY_TEMPLATE, id } as Lobby);
    const updated = { ...current, ...updates, lastActivityAt: Date.now() as any };
    setLocalLobby(id, updated);
    console.log(`[MOCK] Lobby updated locally: ${id}`);
    return;
  }
  try {
    await updateDoc(doc(db, 'lobbies', id), cleanData({
      ...updates,
      lastActivityAt: now()
    }));
    
    // Index is primarily for public/waiting lobbies. 
    // Only refresh if visibility or status changes in a way that affects the list.
    const statusChanged = updates.status === 'finished' || updates.status === 'waiting' || updates.status === 'INCOMPLETE';
    const isVisibilityUpdate = updates.isHidden !== undefined;
    const teamNamesChanged = updates.captain1Name !== undefined || updates.captain2Name !== undefined;
    
    if (statusChanged || isVisibilityUpdate || teamNamesChanged) {
      // Optimization: Only refresh for major state changes that affect the public list
      await this.refreshLobbyIndex();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `lobbies/${id}`);
  }
}