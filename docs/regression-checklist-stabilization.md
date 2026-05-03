# Checklist pós-estabilização (Mythos Draft)

Use em PR ou antes de release.

## Listeners / Firestore

- [ ] Abrir draft, alternar abas, verificar no DevTools (Application → Service Workers) que não há explosão de erros de `Listen`/`Write` no console.
- [ ] Após login anônimo, confirmar que `getServerTimeOffset` não deixa o console em loop (timeout/erro tratados).

## Lobby pública (20 itens, host+guest)

- [ ] Com >20 lobbies elegíveis no banco, a UI mostra no máximo 20; o 21º não aparece.
- [ ] Lobbies sem `captain1` e `captain2` preenchidos não entram na lista pública.
- [ ] "Load more" ainda traz lote seguindo a mesma regra (apenas elegíveis).

## Roster / substituições

- [ ] Dois clientes: ao salvar *Edit Roster* com mudança real, o oponente vê o aviso de roster alterado.
- [ ] Avançar de game (report) sem editar roster não reabre loop de alerta de substituição com dados antigos.
- [ ] Abrir *Edit Roster* após trocar de game: nomes refletem o jogo atual.

## Streamer HUD

- [ ] Com substituições visíveis, cards laterais não cobrem os picks centrais (camadas/escala ok em 1080p).
