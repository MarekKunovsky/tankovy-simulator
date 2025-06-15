// js/script_game1.js
// Počkej, až bude DOM hotový
document.addEventListener('DOMContentLoaded', () => {
    initGame();    // nastavíme balíček, rozdání, vykreslení
    nextTurn();    // spustíme první tah (hráč)
   });
   // Globální stav hry
   const colors   = ['red','yellow','green','blue'];
   const values   = ['0','1','2','3','4','5','6','7','8','9','skip','reverse','draw2'];
   let deck        = [];
   let hands       = { player: [], cpu1: [], cpu2: [], cpu3: [] };
   let discardPile = [];
   const players   = ['player','cpu1','cpu2','cpu3'];
   const nameMap   = {
    player: 'Hráč 1',
    cpu1:   'Hráč 2',
    cpu2:   'Hráč 3',
    cpu3:   'Hráč 4'
   };
   let current     = 0;    // index v poli players
   const delay     = 1000; // 1 sekunda mezi tahy
   // --- Inicializace hry ---
   function initGame() {
    buildDeck();
    shuffle(deck);
    dealCards(7);                // 7 karet na ruku, můžete měnit
    // první karta na odkládací hromadu
    discardPile.push(deck.pop());
    renderAll();
    log(`Hra začíná. První karta: ${formatCard(discardPile[0])}`);
   }
   // Vytvoří balíček karet
   function buildDeck() {
    deck = [];
    colors.forEach(c => {
      values.forEach(v => {
        deck.push({ color:c, value:v });
        if (v !== '0') deck.push({ color:c, value:v });
      });
    });
   }
   // Prohodí prvky pole (Fisher–Yates)
   function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
   }
   // Rozdá všem hráčům n karet
   function dealCards(n) {
    for (let i = 0; i < n; i++) {
      players.forEach(p => hands[p].push(deck.pop()));
    }
   }
   // Vykreslí karty všech hráčů a odkládací hromadu
   function renderAll() {
    players.forEach(p => renderHand(p));
    renderDiscard();
   }
   // Vykreslí ruku jednoho hráče, včetně štítku s jeho jménem
   function renderHand(player) {
    const container = document.getElementById(`${player}-hand`);
    container.innerHTML = '';
    // ▷ štítek s názvem hráče
    const label = document.createElement('div');
    label.className = 'player-label';
    label.textContent = nameMap[player];
    container.appendChild(label);
    // ▷ vykreslení karet
    hands[player].forEach((card, idx) => {
      const div = document.createElement('div');
      div.className = 'card' + (player === 'player' ? '' : ' card-back');
      if (player === 'player') {
        div.textContent = formatCard(card);
        // když na kartu klikne hráč, zahraje ji
        div.addEventListener('click', () => {
          if (players[current] === 'player') {
            playCard('player', idx);
          }
        });
      }
      container.appendChild(div);
    });
   }
   // Vykreslí vrchní kartu odkládací hromady
   function renderDiscard() {
    const d = document.getElementById('discard-pile');
    d.innerHTML = '';
    const top = discardPile[discardPile.length - 1];
    const div = document.createElement('div');
    div.className = 'card';
    div.textContent = formatCard(top);
    d.appendChild(div);
   }
   // Formát karty pro zobrazení
   function formatCard(card) {
    return `${card.color} ${card.value}`;
   }
   // Zapíše zprávu do logu a vždy posune scroll dolů
   function log(message) {
    const lg = document.getElementById('game-log');
    const p  = document.createElement('p');
    p.textContent = message;
    lg.appendChild(p);
    lg.scrollTop = lg.scrollHeight;
   }
   // Provede tah daného hráče
   function playCard(player, cardIdx) {
    const card = hands[player][cardIdx];
    if (!isValidMove(card)) return;
    // odstran kartu z ruky
    hands[player].splice(cardIdx, 1);
    // přidej na odkládací
    discardPile.push(card);
    renderAll();
    log(`${nameMap[player]} zahraje ${formatCard(card)}`);
    // pokračuj dalším hráčem po prodlevě
    setTimeout(nextTurn, delay);
   }
   // Funkce, která řídí, čí tah bude následovat
   function nextTurn() {
    current = (current + 1) % players.length;
    const who     = players[current];
    const whoName = nameMap[who];
    if (who === 'player') {
      // zkontroluj, zda má hráč platný tah
      const hasValid = hands.player.some(isValidMove);
      if (!hasValid) {
        // automaticky lízne kartu a pokračuje
        const drawn = deck.pop();
        hands.player.push(drawn);
        renderHand('player');
        log(`${whoName} nemá platnou kartu a lízne ${formatCard(drawn)}`);
        return setTimeout(nextTurn, delay);
      }
      // čekáme na akci hráče
      log(`Na tahu ${whoName}.`);
    } else {
      // CPU tah
      log(`Na tahu ${whoName}.`);
      setTimeout(() => cpuTurn(who), delay);
    }
   }
   // Tah algoritmu (CPU)
   function cpuTurn(player) {
    // najdi první validní kartu
    const idx = hands[player].findIndex(isValidMove);
    if (idx >= 0) {
      // zahraj ji
      playCard(player, idx);
    } else {
      // nemá platnou – vezme kartu
      const drawn = deck.pop();
      hands[player].push(drawn);
      renderHand(player);
      log(`${nameMap[player]} si lízne ${formatCard(drawn)}`);
      setTimeout(nextTurn, delay);
    }
   }
   // Ověří, zda je karta platná vůči vrchní kartě odkládací hromady
   function isValidMove(card) {
    const top = discardPile[discardPile.length - 1];
    return card.color === top.color
        || card.value === top.value;
        // + sem můžeš později přidat wild karty
   }