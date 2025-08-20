// src/main.js
import { createActor } from 'https://esm.sh/xstate@5?bundle';
import { monikersMachine, ROUNDS } from './lib/states.js';

// Load card data
let monikersCards = [];
let cardDescriptions = new Map(); // Store word -> description mapping

// Load the JSON file
async function loadCardData() {
  try {
    const response = await fetch('./data/monikers-cards.json');
    monikersCards = await response.json();
    
    // Build description mapping
    cardDescriptions.clear();
    monikersCards.forEach(card => {
      cardDescriptions.set(card.word, card.description);
    });
  } catch (error) {
    console.error('Failed to load card data:', error);
    // Fallback to basic cards
    monikersCards = [
      { "word": "Ada Lovelace", "description": "First computer programmer", "category": ["Classic"] },
      { "word": "Mount Everest", "description": "Highest mountain in the world", "category": ["Classic"] },
      { "word": "The Matrix", "description": "1999 sci-fi film", "category": ["Classic"] },
      { "word": "Mona Lisa", "description": "Famous painting by Leonardo da Vinci", "category": ["Classic"] },
      { "word": "Rubik's Cube", "description": "3D combination puzzle", "category": ["Classic"] }
    ];
    
    // Build description mapping for fallback
    cardDescriptions.clear();
    monikersCards.forEach(card => {
      cardDescriptions.set(card.word, card.description);
    });
  }
}

// Utility functions for working with card data
function getAllCards() {
  return monikersCards;
}

function getCardsByCategory(category) {
  return monikersCards.filter(card => card.category.includes(category));
}

function getRandomCards(count = 20) {
  const shuffled = [...monikersCards].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// ------- DOM helpers -------
const $ = (sel) => document.querySelector(sel);

// ------- UI refs -------
const ui = {
  roundRule: $('#roundRule'),
  viewTitle: $('#viewTitle'),

  // lobby
  viewLobby: $('#viewLobby'),
  team1Name: $('#team1Name'),
  team2Name: $('#team2Name'),
  secondsInput: $('#secondsInput'),
  cardCategory: $('#cardCategory'),
  deckSizeInput: $('#deckSizeInput'),
  showWordsBtn: $('#showWordsBtn'),
  cardsInput: $('#cardsInput'),
  startGameBtn: $('#startGameBtn'),

  // round setup (optional)
  viewRoundSetup: $('#viewRoundSetup'),
  roundInfo: $('#roundInfo'),
  startTurnBtn1: $('#startTurnBtn1'),

  // between rounds
  viewBetweenRounds: $('#viewBetweenRounds'),
  betweenInfo: $('#betweenInfo'),
  startTurnBtn2: $('#startTurnBtn2'),

  // turn
  viewTurn: $('#viewTurn'),
  currentTeam: $('#currentTeam'),
  timer: $('#timer'),
  deckCount: $('#deckCount'),
  currentCard: $('#currentCard'),
  guessBtn: $('#guessBtn'),
  skipBtn: $('#skipBtn'),

  // handoff
  viewHandoff: $('#viewHandoff'),
  handoffTeam: $('#handoffTeam'),
  handoffDeckCount: $('#handoffDeckCount'),
  handoffStartBtn: $('#handoffStartBtn'),

  // game over
  viewGameOver: $('#viewGameOver'),
  finalScores: $('#finalScores'),
  resetBtn: $('#resetBtn'),

  // scoreboard
  scoreboard: $('#scoreboard'),
};

// ------- Machine actor -------
const actor = createActor(monikersMachine).start();

// ------- Event handlers -------
// Function to update cards based on current category and deck size
const updateCardsFromCategory = () => {
  const category = ui.cardCategory.value;
  let cards = [];
  
  if (category === 'All') {
    const deckSize = parseInt(ui.deckSizeInput.value) || 20;
    cards = getRandomCards(deckSize);
  } else if (category) {
    cards = getCardsByCategory(category);
  }
  
  if (cards.length > 0) {
    // Extract just the words from the card objects
    const words = cards.map(card => card.word);
    ui.cardsInput.value = words.join('\n');
  }
};

ui.cardCategory.onchange = updateCardsFromCategory;

// Add event handler for deck size changes
ui.deckSizeInput.onchange = updateCardsFromCategory;

ui.showWordsBtn.onclick = () => {
  const isHidden = ui.cardsInput.style.display === 'none';
  ui.cardsInput.style.display = isHidden ? 'block' : 'none';
  ui.showWordsBtn.textContent = isHidden ? 'Hide words' : 'Show words (spoiler)';
};

ui.startGameBtn.onclick = () => {
  // Add both teams
  const team1Name = ui.team1Name.value.trim();
  const team2Name = ui.team2Name.value.trim();
  
  if (!team1Name || !team2Name) {
    alert('Please enter names for both teams');
    return;
  }
  
  // Clear any existing teams and add the two new teams
  actor.send({ type: 'RESET' });
  actor.send({ type: 'ADD_TEAM', id: crypto.randomUUID(), name: team1Name });
  actor.send({ type: 'ADD_TEAM', id: crypto.randomUUID(), name: team2Name });
  
  // parse one card per line
  const cards = ui.cardsInput.value
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean)
    .map((text) => ({ id: crypto.randomUUID(), text }));

  actor.send({ type: 'SET_CARDS', cards });
  actor.send({
    type: 'SET_SECONDS',
    seconds: Math.max(10, Math.min(120, parseInt(ui.secondsInput.value || '45', 10))),
  });
  actor.send({ type: 'START_GAME' });
  render();
};

ui.startTurnBtn1.onclick = () => { actor.send({ type: 'START_TURN' }); render(); };
ui.startTurnBtn2.onclick = () => { actor.send({ type: 'START_TURN' }); render(); };

ui.guessBtn.onclick = () => { actor.send({ type: 'GUESS' }); render(); };
ui.skipBtn.onclick = () => { actor.send({ type: 'SKIP' }); render(); };

// handoff button
ui.handoffStartBtn.onclick = () => { actor.send({ type: 'START_TURN' }); render(); };

// reset game
ui.resetBtn.onclick = () => { actor.send({ type: 'RESET' }); render(); };

// Re-render on state changes
actor.subscribe(() => render());

// ------- Rendering -------
function render() {
  const s = actor.getSnapshot();
  const ctx = s.context;

  // Helper: show exactly one "view" section
  const only = (el) => {
    console.log('Setting visibility for:', el?.id);
    [
      ui.viewLobby,
      ui.viewRoundSetup,
      ui.viewBetweenRounds,
      ui.viewTurn,
      ui.viewHandoff,
      ui.viewGameOver,
    ].forEach((v) => {
      const shouldHide = v !== el;
      v.style.display = shouldHide ? 'none' : 'grid';
      console.log(`${v.id}: display = ${shouldHide ? 'none' : 'grid'}`);
    });
  };

  // Round rule label
  ui.roundRule.textContent = s.matches('rounds')
    ? `Round ${ctx.roundIndex + 1}: ${ROUNDS[ctx.roundIndex].rule}`
    : '';

  // Which view to show
  console.log('Current state:', s.value);
  if (s.matches('lobby')) {
    only(ui.viewLobby);
    ui.viewTitle.textContent = 'Lobby';
  }
  else if (s.matches('rounds.turn.handoff')) {
    only(ui.viewHandoff);
    ui.viewTitle.textContent = 'Pass the phone!';
  }
  else if (s.matches('rounds.turn.playing') || s.matches('rounds.turn.prepare') || s.matches('rounds.turn.turnEnd')) {
    only(ui.viewTurn);
    ui.viewTitle.textContent = 'Playing';
  }
  else if (s.matches('rounds.roundSetup')) {
    only(ui.viewRoundSetup);
    ui.viewTitle.textContent = 'Round Setup';
  }
  else if (s.matches('rounds.betweenRounds')) {
    only(ui.viewBetweenRounds);
    ui.viewTitle.textContent = 'Next Round Ready';
  }
  else if (s.matches('gameOver')) {
    only(ui.viewGameOver);
    ui.viewTitle.textContent = 'Game Over';
  }
  else console.log('No matching state found!');



  // Round setup info
  if (s.matches('rounds.roundSetup')) {
    ui.roundInfo.textContent =
      `Teams: ${ctx.teams.map(t => t.name).join(' vs ')}. ` +
      `Cards in deck: ${ctx.roundDeck.length}.`;
  }

  // Between rounds info
  if (s.matches('rounds.betweenRounds')) {
    ui.betweenInfo.textContent =
      `Round ${ctx.roundIndex + 1} ready. ` +
      `Reused cards: ${ctx.roundDeck.length}.`;
  }

  // Turn view (prepare/playing/turnEnd)
  if (s.matches('rounds.turn.playing') || s.matches('rounds.turn.prepare') || s.matches('rounds.turn.turnEnd')) {
    ui.currentTeam.textContent = ctx.teams[ctx.currentTeamIndex]?.name ?? '—';
    ui.timer.textContent = `${ctx.remainingSeconds}s`;
    
    if (ctx.currentCard) {
      const description = cardDescriptions.get(ctx.currentCard.text);
      if (description) {
        // Check if description is an image URL
        const isImageUrl = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(description) || 
                          /^https?:\/\/.*\.(jpg|jpeg|png|gif|webp|svg)/i.test(description) ||
                          description.startsWith('data:image/');
        
        if (isImageUrl) {
          ui.currentCard.innerHTML = `
            <div style="font-size:1.5rem; margin-bottom:1rem;">${ctx.currentCard.text}</div>
            <img src="${description}" alt="${ctx.currentCard.text}" onerror="this.classList.add('error'); this.nextElementSibling.style.display='block';" style="max-width:100%; max-height:200px; border-radius:0.5rem; box-shadow:0 2px 8px rgba(0,0,0,0.1);">
            <div style="font-size:0.9rem; color:#666; font-style:italic; display:none;">${description}</div>
          `;
        } else {
          ui.currentCard.innerHTML = `
            <div style="font-size:1.5rem; margin-bottom:0.5rem;">${ctx.currentCard.text}</div>
            <div style="font-size:0.9rem; color:#666; font-style:italic;">${description}</div>
          `;
        }
      } else {
        ui.currentCard.textContent = ctx.currentCard.text;
      }
    } else {
      ui.currentCard.textContent = 'Draw…';
    }

    const noCard = !ctx.currentCard;
    ui.guessBtn.disabled = noCard;
    ui.skipBtn.disabled = noCard;
  }

  // Handoff view
  if (s.matches('rounds.turn.handoff')) {
    ui.handoffTeam.textContent = `${ctx.teams[ctx.currentTeamIndex]?.name || 'Next team'}'s turn`;
    ui.handoffDeckCount.textContent = `${ctx.roundDeck.length} cards left`;
  }

  // Scoreboard (hidden in lobby)
  if (s.matches('lobby')) {
    ui.scoreboard.parentElement.style.display = 'none';
  } else {
    ui.scoreboard.parentElement.style.display = 'block';
    const teamScores = ctx.teams
      .map((t, i) =>
        `<span class="score-item">${t.name}: <strong>${t.score}</strong></span>`
      ).join(' • ');
    
    const deckCount = `<span class="score-item deck-count"><strong>${ctx.roundDeck.length + (ctx.currentCard ? 1 : 0)}</strong> cards left</span>`;
    
    ui.scoreboard.innerHTML = `${teamScores} • ${deckCount}`;
  }

  // Game over
  if (s.matches('gameOver')) {
    const max = Math.max(...ctx.teams.map(t => t.score), 0);
    const winners = ctx.teams.filter(t => t.score === max).map(t => t.name);
    ui.finalScores.innerHTML = `
      <p>Winner${winners.length > 1 ? 's' : ''}: <strong>${winners.join(' & ') || '—'}</strong></p>
      <ul>${ctx.teams.map(t => `<li>${t.name}: ${t.score}</li>`).join('')}</ul>
    `;
  }
}

// Initialize and start the app
async function init() {
  await loadCardData();
  
  // Initialize cardsInput with random cards
  const deckSize = parseInt(ui.deckSizeInput.value) || 20;
  const cards = getRandomCards(deckSize);
  const words = cards.map(card => card.word);
  ui.cardsInput.value = words.join('\n');
  
  render();
}

// Start the app
init();
