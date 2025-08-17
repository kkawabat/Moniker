// src/main.js
import { createActor } from 'https://esm.sh/xstate@5?bundle';
import { monikersMachine, ROUNDS } from './lib/states.js';

// Load card data
let monikersCards = {};

// Load the JSON file
async function loadCardData() {
  try {
    const response = await fetch('./data/monikers-cards.json');
    monikersCards = await response.json();
  } catch (error) {
    console.error('Failed to load card data:', error);
    // Fallback to basic cards
    monikersCards = {
      "Classic": [
        { "word": "Ada Lovelace", "description": "First computer programmer" },
        { "word": "Mount Everest", "description": "Highest mountain in the world" },
        { "word": "The Matrix", "description": "1999 sci-fi film" },
        { "word": "Mona Lisa", "description": "Famous painting by Leonardo da Vinci" },
        { "word": "Rubik's Cube", "description": "3D combination puzzle" }
      ]
    };
  }
}

// Utility functions for working with card data
function getAllCards() {
  return Object.values(monikersCards).flat();
}

function getCardsByCategory(category) {
  return monikersCards[category] || [];
}

function getRandomCards(count = 20) {
  const allCards = getAllCards();
  const shuffled = [...allCards].sort(() => 0.5 - Math.random());
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
  loadCardsBtn: $('#loadCardsBtn'),
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
ui.loadCardsBtn.onclick = () => {
  const category = ui.cardCategory.value;
  let cards = [];
  
  if (category === 'All') {
    cards = getRandomCards(20);
  } else if (category) {
    cards = getCardsByCategory(category);
  }
  
  if (cards.length > 0) {
    // Extract just the words from the card objects
    const words = cards.map(card => card.word);
    ui.cardsInput.value = words.join('\n');
  }
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
    ui.currentCard.textContent = ctx.currentCard ? ctx.currentCard.text : 'Draw…';

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
  render();
}

// Start the app
init();
