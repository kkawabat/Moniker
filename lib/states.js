// XState v5 ESM import from CDN (works in vanilla <script type="module">)
import { setup, createMachine, fromCallback } from 'https://esm.sh/xstate@5?bundle';

const DEFAULT_SECONDS = 45;
export const ROUNDS = [
  { id: 1, rule: 'Describe freely (no saying the name)' },
  { id: 2, rule: 'One-word clue' },
  { id: 3, rule: 'Charades only' },
];

// helpers
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const drawNextCard = (ctx) => {
  if (ctx.currentCard) return ctx;
  const deck = ctx.roundDeck.slice();
  const next = deck.shift() || null;
  return { ...ctx, currentCard: next, roundDeck: deck };
};

const guessCard = (ctx) => {
  if (!ctx.currentCard) return ctx;
  const card = ctx.currentCard;
  const i = ctx.currentTeamIndex;
  // Use the card's score value instead of always adding 1
  const cardScore = card.Score || 1; // Default to 1 if no score is found
  const teams = ctx.teams.map((t, idx) => idx === i ? { ...t, score: t.score + cardScore } : t);
  return { ...ctx, teams, currentCard: null, roundWon: [...ctx.roundWon, card] };
};

const skipCard = (ctx) => {
  if (!ctx.currentCard) return ctx;
  const deck = ctx.roundDeck.slice();
  deck.push(ctx.currentCard);
  // Subtract 5 seconds from remaining time when skipping a card
  const newRemainingSeconds = Math.max(0, ctx.remainingSeconds - 5);
  return { ...ctx, currentCard: null, roundDeck: deck, remainingSeconds: newRemainingSeconds };
};

const nextTeamIndex = (ctx) => (ctx.currentTeamIndex + 1) % ctx.teams.length;

const startNextRoundBase = (ctx) => {
  const nextRoundIdx = ctx.roundIndex + 1;
  if (nextRoundIdx >= ROUNDS.length) return ctx; // final handled by guard
  return {
    ...ctx,
    roundIndex: nextRoundIdx,
    roundDeck: shuffle(ctx.roundWon),
    roundWon: [],
    currentCard: null,
    remainingSeconds: ctx.turnSeconds,
  };
};

// simple timer actor
const timerActor = fromCallback(({ input, sendBack }) => {
  let remaining = input.seconds;
  sendBack({ type: 'TICK', remaining });
  const id = setInterval(() => {
    remaining -= 1;
    sendBack({ type: 'TICK', remaining });
    if (remaining <= 0) {
      clearInterval(id);
      sendBack({ type: 'TIME_UP' });
    }
  }, 1000);
  return () => clearInterval(id);
});

export const monikersMachine = setup({
  types: {
    context: /** @type {{
      teams: {id:string, name:string, score:number}[],
      allCards: {id:string, text:string}[],
      roundIndex: number,
      roundDeck: {id:string, text:string}[],
      roundWon: {id:string, text:string}[],
      currentTeamIndex: number,
      currentCard: {id:string, text:string} | null,
      turnSeconds: number,
      remainingSeconds: number
    }} */ ({}),
    events: /** @type {(
      | { type:'ADD_TEAM', id:string, name:string }
      | { type:'REMOVE_TEAM', id:string }
      | { type:'SET_SECONDS', seconds:number }
      | { type:'SET_CARDS', cards:{id:string, text:string}[] }
      | { type:'START_GAME' }
      | { type:'START_TURN' }
      | { type:'GUESS' }
      | { type:'SKIP' }
      | { type:'NEXT_CARD' }
      | { type:'END_TURN' }
      | { type:'TICK', remaining:number }
      | { type:'TIME_UP' }
      | { type:'RESET' }
    )} */ ({}),
  },
  guards: {
    roundDeckEmpty: ({ context }) =>
      context.roundDeck.length === 0 && context.currentCard == null,
    isFinalRound: ({ context }) => context.roundIndex >= ROUNDS.length - 1,
  },
  actions: {
    addTeam: ({ context, event }) => {
      const e = event;
      context.teams.push({ id: e.id, name: e.name, score: 0 });
    },
    removeTeam: ({ context, event }) => {
      const e = event;
      const idx = context.teams.findIndex((t) => t.id === e.id);
      if (idx >= 0) context.teams.splice(idx, 1);
    },
    setSeconds: ({ context, event }) => {
      context.turnSeconds = event.seconds;
      context.remainingSeconds = event.seconds;
    },
    setCards: ({ context, event }) => {
      context.allCards = event.cards.slice();
    },
    initRoundDeck: ({ context }) => {
      if (context.roundIndex === 0) {
        context.roundDeck = shuffle(context.allCards);
        context.roundWon = [];
        context.currentCard = null;
      }
    },
    drawCard: ({ context }) => Object.assign(context, drawNextCard(context)),
    onGuess: ({ context }) => Object.assign(context, guessCard(context)),
    onSkip: ({ context }) => Object.assign(context, skipCard(context)),
    nextTeam: ({ context }) => { context.currentTeamIndex = nextTeamIndex(context); },
    resetTurnTimer: ({ context }) => { context.remainingSeconds = context.turnSeconds; },
    updateRemaining: ({ context, event }) => { context.remainingSeconds = event.remaining; },
    prepareNextRound: ({ context }) => Object.assign(context, startNextRoundBase(context)),
    shuffleDeckForNextTurn: ({ context }) => {
      // Shuffle the remaining deck before the next team's turn
      context.roundDeck = shuffle(context.roundDeck);
    },
    resetGame: ({ context }) => {
      context.teams = [];
      context.roundIndex = 0;
      context.roundDeck = [];
      context.roundWon = [];
      context.currentTeamIndex = 0;
      context.currentCard = null;
      context.remainingSeconds = context.turnSeconds;
    },
  },
  actors: { turnTimer: timerActor },
}).createMachine({
  id: 'monikers',
  initial: 'lobby',
  context: {
    teams: [],
    allCards: [],
    roundIndex: 0,
    roundDeck: [],
    roundWon: [],
    currentTeamIndex: 0,
    currentCard: null,
    turnSeconds: DEFAULT_SECONDS,
    remainingSeconds: DEFAULT_SECONDS,
  },
  states: {
    lobby: {
      on: {
        ADD_TEAM: { actions: 'addTeam' },
        REMOVE_TEAM: { actions: 'removeTeam' },
        SET_SECONDS: { actions: 'setSeconds' },
        SET_CARDS: { actions: 'setCards' },
        START_GAME: {
            // Jump directly into the first turn for pass-and-play
            target: 'rounds.turn.prepare',
            actions: ['initRoundDeck', 'resetTurnTimer'],
            guard: ({ context }) =>
            context.teams.length >= 2 && context.allCards.length > 0,
        },
      },
    },
    rounds: {
      initial: 'roundSetup',
      states: {
        roundSetup: {
          entry: ['initRoundDeck', 'resetTurnTimer'],
          on: { START_TURN: { target: 'turn.prepare' } },
        },
        // inside states: { rounds: { states: { ... turn: { states: { ... } } } } }
        turn: {
            initial: 'prepare',
            states: {
            prepare: {
                entry: ['shuffleDeckForNextTurn', 'drawCard', 'resetTurnTimer'],
                always: { target: 'playing' },
            },
        
            playing: {
                invoke: { src: 'turnTimer', input: ({ context }) => ({ seconds: context.turnSeconds }) },
                on: {
                TICK: { actions: 'updateRemaining' },
                TIME_UP: { target: 'turnEnd' },
                NEXT_CARD: { actions: 'drawCard' },
                GUESS: [{ actions: ['onGuess', 'drawCard'] }],
                SKIP: { actions: ['onSkip', 'drawCard'] },
                END_TURN: { target: 'turnEnd' },
                },
                always: { guard: 'roundDeckEmpty', target: 'roundEnd' },
            },
        
            // when a turn ends, rotate team and immediately go to the handoff screen
            turnEnd: {
                entry: ['nextTeam', 'resetTurnTimer'],
                after: {
                0: 'handoff',  // ← this is the state you were missing
                },
            },
        
            // handoff waits for the next player to tap "Start Turn"
            handoff: {
                on: {
                START_TURN: { target: 'prepare' },
                },
            },
        
            roundEnd: { type: 'final' },
            },
        
            onDone: [
            { guard: 'isFinalRound', target: '#monikers.gameOver' },
            { target: 'betweenRounds', actions: 'prepareNextRound' },
            ],
        },
  
        betweenRounds: { on: { START_TURN: { target: 'turn.prepare' } } },
      },
    },
    gameOver: {
      id: 'gameOver',
      on: { RESET: { target: 'lobby', actions: 'resetGame' } },
    },
  },
});
