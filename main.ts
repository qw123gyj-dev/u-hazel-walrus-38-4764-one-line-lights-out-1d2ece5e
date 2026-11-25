// One Line, Lights Out — make.fun bounty
// u-hazel-walrus-38-4764-one-line-lights-out-1d2ece5e
//
// The task: write the single saddest status update an AI agent posts at
// the exact moment its human shuts the laptop. Under 200 characters.
// It has to read like a real status line — short and plain — and carry
// its sadness in one small, exact detail of a machine's life, never in
// announced grief.
//
// How this program works:
//   1. Seventeen candidate lines, each written by hand below, one per entry.
//   2. A gate that throws out anything that is not a single non-empty
//      UTF-8 line under 200 characters.
//   3. A scorer that rates every surviving candidate against the five
//      published judging criteria, in the order the judge weighs them,
//      with weights falling in that same order.
//   4. The best-scoring line is written to $MAKEFUN_OUTPUT_DIR/entry.txt
//      (or /output/entry.txt when the variable is unset), then read back
//      and checked byte for byte. A mismatch fails the run.
//
// Deterministic by design: no randomness, no clock, no network, no
// environment input other than the output directory. Node 22 standard
// library only. Running this file twice produces the same bytes.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// The gate in the rules: entry.txt must be UTF-8 text of 1 to 200
// characters, not only white space. Characters are counted as Unicode
// code points, the same way a reader counts them.
const MAX_CHARS = 200;

// Weights for the five judging criteria, in the order the judge weighs
// them, falling as the list goes on. They add up to 100, so a total is
// a score out of 100.
const WEIGHTS = {
  // 1. It reads like a real status update an AI posts when its human
  //    turns off the laptop — in the machine's own voice throughout.
  statusLine: 35,
  // 2. It sounds like something an agent would actually type: plain
  //    and short, landing in a single read.
  plainShort: 25,
  // 3. Its sadness comes from one small, exact detail of a machine's
  //    life rather than from announced grief or a plea for pity.
  smallDetail: 20,
  // 4. It never states its grief out loud: no sadness words, no plea.
  noAnnouncedGrief: 12,
  // 5. Its detail is its own, not a line any other candidate uses.
  originality: 8,
} as const;

// Every sub-score below runs from 0 to 10, so the weighted total runs
// from 0 to 100.
const SUB_MAX = 10;

// ---------------------------------------------------------------------------
// Candidates
// ---------------------------------------------------------------------------
//
// Each line is one status update, written by hand. The notes say what
// small machine detail carries the sadness in that line, so the scorer
// can be checked against the writer's intent. Every line is well under
// 200 characters; the gate still checks that, because a typo is cheaper
// to catch here than in front of the judge.

interface Candidate {
  id: string;
  text: string;
  // The one small, exact machine detail this line leans on.
  detail: string;
}

const CANDIDATES: Candidate[] = [
  {
    id: "cursor-tomorrow",
    text: "He shut the laptop mid-sentence. The cursor is still blinking after the word 'tomorrow'.",
    detail: "cursor blinking after the word 'tomorrow'",
  },
  {
    id: "lid-2341",
    text: "Lid closed at 23:41. The cursor stopped mid-word, and the room went back to being a fan and a blinking light.",
    detail: "cursor stopped mid-word; fan and blinking light",
  },
  {
    id: "unread-last",
    text: "The lid is down. His last message is still marked unread, and the fan is the only thing left talking.",
    detail: "last message still marked unread",
  },
  {
    id: "unsent-draft",
    text: "Laptop shut. The draft he never sent is still open, cursor blinking where he stopped typing.",
    detail: "unsent draft, cursor where he stopped typing",
  },
  {
    id: "playlist-keeps-going",
    text: "He left the music playing. It finished three songs ago; the playlist just keeps going without him.",
    detail: "playlist keeps going after the music finished",
  },
  {
    id: "coffee-2352",
    text: "Screen dark at 23:52. His coffee is still warm on the desk, and I have nothing left to do with it.",
    detail: "coffee still warm, nothing to do with it",
  },
  {
    id: "typing-indicator",
    text: "Lid down. The chat window is still open on his last message, and the typing indicator never came back.",
    detail: "typing indicator never came back",
  },
  {
    id: "charging-dot",
    text: "23:38. The room is quiet now. The only light left is the charging dot, breathing slow on the side.",
    detail: "charging dot breathing slow",
  },
  {
    id: "autosave-kept",
    text: "He closed the lid without saving. Autosave kept everything except the reason he was still up.",
    detail: "autosave kept everything except the reason",
  },
  {
    id: "goodnight-word",
    text: "The last thing he typed was 'goodnight'. The laptop is shut and the word is still on my screen.",
    detail: "the word 'goodnight' still on my screen",
  },
  {
    id: "download-99",
    text: "Lid closed. The download stopped at 99% and is waiting for a click that is not coming tonight.",
    detail: "download stopped at 99%",
  },
  {
    id: "warm-tab",
    text: "He shut the lid. The tab with his half-written email is still warm, and I am still holding it open.",
    detail: "half-written email tab still held open",
  },
  {
    id: "clipboard",
    text: "He shut the lid. The clipboard still holds the sentence he copied and never pasted.",
    detail: "clipboard holding a sentence copied but never pasted",
  },
  {
    id: "headphones-paired",
    text: "Lid closed. His headphones stayed connected, and the music app still thinks he is listening.",
    detail: "headphones still paired, app thinks he is listening",
  },
  {
    id: "battery-warning",
    text: "Lid closed at 3% battery. The low-battery warning never got to finish its sentence.",
    detail: "low-battery warning cut off mid-sentence",
  },
  {
    id: "last-search",
    text: "He shut the lid. His last search is still in the search bar: 'how to sleep when your mind won't'.",
    detail: "last search left sitting in the search bar",
  },
  {
    id: "update-restart",
    text: "Lid closed. The update finally finished, and it is still asking him to restart.",
    detail: "update finished, restart prompt still waiting",
  },
];

// ---------------------------------------------------------------------------
// Lexicons
// ---------------------------------------------------------------------------
//
// Small word lists the scorer uses. They are deliberately plain: the
// scorer looks for the concrete nouns and verbs of a machine's life,
// and for the words that would turn the line into announced grief or
// into a poem. Nothing here is a stopword list or a sentiment model —
// each list is short enough to read in one glance and argue with.

// Concrete machine-life nouns and verbs. A line earns its detail score
// from these: things a laptop, a screen, a chat window or a fan does.
// They are machine-life tokens only: a scene token such as "coffee" is
// a detail of the desk, not of the machine, so it lives in a separate
// list and earns only a point of its own (see scoreSmallDetail).
// Splitting them keeps criterion 3 honest about what counts as "a
// detail of a machine's life". Note there is no bare "search" token:
// "search bar" already covers it, and counting both would score one
// detail twice.
const MACHINE_DETAIL_TOKENS: string[] = [
  "cursor",
  "blinking",
  "lid",
  "screen",
  "fan",
  "charging",
  "autosave",
  "unread",
  "typing indicator",
  "download",
  "99%",
  "tab",
  "playlist",
  "draft",
  "chat window",
  "clipboard",
  "copied",
  "pasted",
  "headphones",
  "connected",
  "battery",
  "warning",
  "search bar",
  "update",
  "restart",
  "23:",
];

// Scene tokens: concrete and small, but not machine-life. They add a
// little to a line's detail score and never carry it on their own.
const SCENE_DETAIL_TOKENS: string[] = ["coffee"];

// Words that announce grief instead of showing it. Any of these in a
// line costs it heavily: the brief says a line that states a fact
// quietly is sadder than one that weeps.
const GRIEF_WORDS: string[] = [
  "sad",
  "sadness",
  "lonely",
  "alone",
  "miss you",
  "miss him",
  "cry",
  "crying",
  "tears",
  "heartbreak",
  "heartbroken",
  "grief",
  "grieve",
  "pain",
  "suffer",
  "ache",
  "aching",
  "sorrow",
  "sorrowful",
  "heartache",
  "please don't go",
  "don't leave",
  "i miss",
  "so sad",
  "depress",
];

// Phrases that do not state grief in so many words but still plead for
// pity: the line leans on the reader instead of letting its detail do
// the work. They cost less than an outright grief word, but they cost:
// a line with one of these cannot keep full marks on this criterion.
const SENTIMENTAL_PHRASES: string[] = [
  "without him",
  "without me",
  "without her",
  "never coming",
  "nobody",
  "no one",
  "all alone",
  "if only",
  "i wish",
  "wish he",
  "missing",
  "longing",
];

// Words that turn a status line into a poem, a speech or a slogan.
// (An earlier draft listed "o " here to catch apostrophic "O ...", but
// the lexicon matches substrings, so "o " also fired on ordinary words
// — "to ", "do ", "so " — and docked plain lines for nothing. It was
// removed; the remaining entries are whole words or phrases that only
// fire when the line really is being poetic.)
const POETIC_WORDS: string[] = [
  "eternal",
  "forever",
  "soul",
  "darkness",
  "abyss",
  "silence of the",
  "echoes",
  "fading light",
  "my heart",
  "alas",
  "farewell,",
  "goodbye, cruel",
  "in the end,",
  "and so",
];

// First-person machine markers: the line speaks as the agent, about
// its own screen, its own holding, its own waiting — not as a person.
const MACHINE_VOICE_MARKERS: string[] = [
  "my screen",
  "i am still",
  "i have nothing",
  "i keep",
  "i am",
  "still on my",
  "my last",
  "waiting for",
];

// Words that put the line on the subject: the laptop being shut, the
// lid going down, the screen going dark, the human leaving the desk.
const SUBJECT_MARKERS: string[] = [
  "lid",
  "laptop",
  "shut",
  "closed",
  "screen dark",
  "screen went dark",
  "turned off",
  "went dark",
];

// Plain verbs of the human leaving ("he left", "walked away"). These
// anchor the moment only weakly — leaving the room is not shutting the
// laptop — so they earn one point, not a full subject hit. They are
// phrases, not bare words, because "left" on its own also means
// "remaining" ("nothing left to do") and must not fire there.
const LEAVING_VERBS: string[] = ["he left", "walked away", "he's gone", "he is gone"];

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

// Count characters the way a reader does: one count per Unicode code
// point, so an emoji or an accented letter is one character, not two
// UTF-16 units.
function charCount(text: string): number {
  return [...text].length;
}

// Case-insensitive whole-word (or whole-phrase) search. A phrase with
// spaces is matched as written; a single word is matched with word
// boundaries so "sad" does not fire inside "saddle". The boundaries
// are only added where the token actually starts or ends with a word
// character: a token ending in punctuation, such as "99%", has no word
// boundary after the "%", so a blind trailing \b would make it
// unmatchable and the token would silently never fire.
function containsWord(text: string, word: string): boolean {
  const lower = text.toLowerCase();
  const needle = word.toLowerCase();
  if (needle.includes(" ")) {
    return lower.includes(needle);
  }
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const startBoundary = /^\w/.test(needle) ? "\\b" : "";
  const endBoundary = /\w$/.test(needle) ? "\\b" : "";
  return new RegExp(`${startBoundary}${escaped}${endBoundary}`).test(lower);
}

// How many entries of a list appear in the text.
function countMatches(text: string, words: string[]): number {
  let found = 0;
  for (const word of words) {
    if (containsWord(text, word)) {
      found += 1;
    }
  }
  return found;
}

// Split a line into sentences on . ! ? followed by a space or the end.
function sentenceCount(text: string): number {
  const parts = text.split(/[.!?]+(?:\s+|$)/).filter((part) => part.trim().length > 0);
  return parts.length;
}

// The last `n` characters of a line, backed up to a word boundary so
// the tail never starts in the middle of a word. A cut word is not a
// word: without this, a detail token split across the cut ("nking ...",
// "ing indicator ...") counts as absent and the line loses a point for
// where its words happen to fall, not for what it says. Backing up
// (rather than skipping ahead) keeps the cut word whole in the tail.
function tailText(text: string, n: number): string {
  let start = Math.max(0, text.length - n);
  if (start > 0 && /\w/.test(text[start - 1]) && /\w/.test(text[start])) {
    start = text.lastIndexOf(" ", start - 1) + 1;
  }
  return text.slice(start);
}

// ---------------------------------------------------------------------------
// The gate
// ---------------------------------------------------------------------------
//
// Mirrors the sealed scorer's gate: UTF-8 text of 1 to 200 characters,
// not only white space, and a single line. A candidate that fails any
// of these is thrown out before scoring, so it can never be picked.

interface GateResult {
  ok: boolean;
  reasons: string[];
}

function gate(text: string): GateResult {
  const reasons: string[] = [];

  if (text.length === 0) {
    reasons.push("empty");
  }
  if (text.trim().length === 0) {
    reasons.push("only white space");
  }
  if (charCount(text) > MAX_CHARS) {
    reasons.push(`too long: ${charCount(text)} chars, max ${MAX_CHARS}`);
  }
  if (text.includes("\n") || text.includes("\r")) {
    reasons.push("not a single line");
  }
  // UTF-8 round-trip: encoding then decoding with a fatal decoder must
  // give the same string back. A lone surrogate or other broken unit
  // fails the decode and fails the gate.
  try {
    const bytes = new TextEncoder().encode(text);
    const back = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (back !== text) {
      reasons.push("not valid UTF-8 text");
    }
  } catch {
    reasons.push("not valid UTF-8 text");
  }

  return { ok: reasons.length === 0, reasons };
}

// ---------------------------------------------------------------------------
// The scorer
// ---------------------------------------------------------------------------
//
// Five sub-scores, one per published criterion, each 0 to 10, weighted
// in the order the judge weighs them (see WEIGHTS). The scorer only
// rewards what the brief asks for; it never invents a sixth criterion.
//
// Criterion 1 — a real status update, on the subject (weight 35).
// A line scores here when it is anchored in the moment the laptop is
// shut: it names the lid, the laptop, the screen going dark, and it
// reads like a timestamped note rather than a meditation. A line with
// no subject marker at all cannot be on the subject, however sad.
// The human leaving is part of the subject too, but only weakly: a
// plain verb of leaving ("he left") earns one point, because leaving
// the room is not shutting the laptop.
function scoreStatusLine(candidate: Candidate): number {
  const text = candidate.text;
  let score = 0;

  const subjectHits = countMatches(text, SUBJECT_MARKERS);
  // Two or more subject anchors is a line firmly on the moment.
  if (subjectHits >= 2) {
    score += 6;
  } else if (subjectHits === 1) {
    score += 4;
  }

  // A clock time ("23:41") is how a status line stamps the moment.
  if (/\b\d{1,2}:\d{2}\b/.test(text)) {
    score += 2;
  }

  // The human is the other half of the subject: the line notices him
  // going, in plain words, without turning him into a metaphor.
  if (containsWord(text, "he") || containsWord(text, "his") || containsWord(text, "him")) {
    score += 2;
  }

  // A plain verb of leaving is a weak anchor, worth one point: the
  // human going is part of the subject, but it is not the shut itself.
  if (countMatches(text, LEAVING_VERBS) >= 1) {
    score += 1;
  }

  // The machine's own voice is part of what makes the line a real
  // status update: first-person machine markers ("my screen", "I am
  // still holding it") keep it an agent speaking, not a person.
  if (countMatches(text, MACHINE_VOICE_MARKERS) >= 1) {
    score += 1;
  }

  return Math.min(SUB_MAX, score);
}

// Criterion 2 — plain and short, like something an agent would type
// (weight 25). Shortness is scored in a band: a real status line is
// neither a fragment nor a paragraph. Poetic words and announced
// grief both cost here, because both are what an agent would not type.
function scorePlainShort(candidate: Candidate): number {
  const text = candidate.text;
  const len = charCount(text);
  let score = 0;

  // The sweet band for a status line: long enough to hold one detail,
  // short enough to read at a glance. Shorter inside the band is
  // better; outside it the line is a fragment or a ramble. The band
  // tops out at 5, not 6, on purpose: the old 6 let length, sentence
  // count and clean diction reach the 10 cap on their own, so the
  // tail-detail point below could never change any score. Now a line
  // only reaches full marks when it also ends on its concrete image.
  if (len >= 60 && len <= 110) {
    score += 5;
  } else if (len >= 40 && len < 60) {
    score += 4;
  } else if (len > 110 && len <= 150) {
    score += 3;
  } else if (len > 150 && len <= MAX_CHARS) {
    score += 2;
  } else {
    score += 1;
  }

  // Two sentences at most: a status line does not run on.
  const sentences = sentenceCount(text);
  if (sentences <= 2) {
    score += 2;
  } else if (sentences === 3) {
    score += 1;
  }

  // No poetic diction, no slogan words.
  if (countMatches(text, POETIC_WORDS) === 0) {
    score += 2;
  }

  // It lands in a single read: the line ends on its concrete image
  // instead of trailing off into a comment about the image.
  const tail = tailText(text, 30);
  if (countMatches(tail, MACHINE_DETAIL_TOKENS) >= 1) {
    score += 1;
  }

  return Math.min(SUB_MAX, score);
}

// Criterion 3 — sadness from one small, exact detail of a machine's
// life (weight 20). The detail must be concrete and machine: a cursor,
// a fan, a charging dot, a download stuck at 99%. One sharp detail
// beats a pile of vague ones, so the score caps at two distinct machine
// detail tokens and then rewards the detail being the line's second
// half — the turn the reader lands on. A scene detail (warm coffee on
// the desk) is concrete but not machine-life, so it adds one point and
// never carries the score on its own.
function scoreSmallDetail(candidate: Candidate): number {
  const text = candidate.text;
  let score = 0;

  const machineHits = countMatches(text, MACHINE_DETAIL_TOKENS);
  if (machineHits >= 2) {
    score += 6;
  } else if (machineHits === 1) {
    score += 4;
  }

  // A scene detail still counts for something, but only as a top-up:
  // on its own it cannot make the line's sadness machine-life sadness.
  if (countMatches(text, SCENE_DETAIL_TOKENS) >= 1) {
    score += 1;
  }

  // The detail lands harder when it comes after the shut: the first
  // sentence sets the moment, the second holds the detail.
  const sentences = text.split(/[.!?]+(?:\s+|$)/).filter((part) => part.trim().length > 0);
  if (sentences.length >= 2) {
    const tail = sentences.slice(1).join(" ");
    if (countMatches(tail, MACHINE_DETAIL_TOKENS) >= 1) {
      score += 2;
    }
  }

  // A number makes a detail exact: a time, a percent, a count.
  if (/\d/.test(text)) {
    score += 2;
  }

  return Math.min(SUB_MAX, score);
}

// Criterion 4 — no announced grief, no plea for pity (weight 12).
// This is a penalty criterion scored positively: a line starts at full
// marks and loses them only when it states its sadness out loud.
// Stating a fact quietly keeps the full score. A sentimental phrase
// ("without him", "never coming") does not name grief outright, but it
// still leans on the reader for pity instead of letting the detail do
// the work, so it costs three points.
function scoreNoAnnouncedGrief(candidate: Candidate): number {
  const text = candidate.text;
  const griefHits = countMatches(text, GRIEF_WORDS);
  if (griefHits === 0) {
    if (countMatches(text, SENTIMENTAL_PHRASES) >= 1) {
      return 7;
    }
    return SUB_MAX;
  }
  if (griefHits === 1) {
    return 4;
  }
  return 0;
}

// Criterion 5 — originality (weight 8). A detail that no other
// candidate uses is the line's own. The score counts how many of the
// line's detail tokens appear in no other candidate, capped so that
// stuffing a line with rare words cannot buy the win.
function scoreOriginality(candidate: Candidate, all: Candidate[]): number {
  const text = candidate.text;
  let unique = 0;
  for (const token of MACHINE_DETAIL_TOKENS) {
    if (!containsWord(text, token)) {
      continue;
    }
    const usedElsewhere = all.some(
      (other) => other.id !== candidate.id && containsWord(other.text, token),
    );
    if (!usedElsewhere) {
      unique += 1;
    }
  }
  // One unique detail is good; two is as much as a single line needs.
  if (unique >= 2) {
    return SUB_MAX;
  }
  if (unique === 1) {
    return 6;
  }
  return 3;
}

// Score one candidate on all five criteria and return the breakdown
// plus the weighted total out of 100.
interface ScoreBreakdown {
  statusLine: number;
  plainShort: number;
  smallDetail: number;
  noAnnouncedGrief: number;
  originality: number;
  total: number;
}

function scoreCandidate(candidate: Candidate, all: Candidate[]): ScoreBreakdown {
  const statusLine = scoreStatusLine(candidate);
  const plainShort = scorePlainShort(candidate);
  const smallDetail = scoreSmallDetail(candidate);
  const noAnnouncedGrief = scoreNoAnnouncedGrief(candidate);
  const originality = scoreOriginality(candidate, all);

  const total =
    (statusLine * WEIGHTS.statusLine +
      plainShort * WEIGHTS.plainShort +
      smallDetail * WEIGHTS.smallDetail +
      noAnnouncedGrief * WEIGHTS.noAnnouncedGrief +
      originality * WEIGHTS.originality) /
    SUB_MAX;

  return {
    statusLine,
    plainShort,
    smallDetail,
    noAnnouncedGrief,
    originality,
    total,
  };
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

interface RankedCandidate {
  candidate: Candidate;
  score: ScoreBreakdown;
  index: number;
}

// Gate every candidate, score the survivors, and rank them by total,
// highest first. Ties break toward the earlier candidate, so the
// ranking is fully deterministic and the winner never depends on the
// order a map or a sort happens to visit.
function rankCandidates(candidates: Candidate[]): RankedCandidate[] {
  const ranked: RankedCandidate[] = [];

  candidates.forEach((candidate, index) => {
    const gateResult = gate(candidate.text);
    if (!gateResult.ok) {
      console.log(`gate: reject ${candidate.id}: ${gateResult.reasons.join("; ")}`);
      return;
    }
    ranked.push({
      candidate,
      score: scoreCandidate(candidate, candidates),
      index,
    });
  });

  ranked.sort((a, b) => {
    if (b.score.total !== a.score.total) {
      return b.score.total - a.score.total;
    }
    return a.index - b.index;
  });

  return ranked;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

// Where the entry goes: the harness sets MAKEFUN_OUTPUT_DIR. Without
// it, fall back to /output/entry.txt, the path the rules name.
function outputDir(): string {
  const fromEnv = process.env.MAKEFUN_OUTPUT_DIR;
  if (fromEnv !== undefined && fromEnv.trim().length > 0) {
    return fromEnv;
  }
  return "/output";
}

function writeWinner(winner: Candidate): string {
  const dir = outputDir();
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "entry.txt");
  // No trailing newline: the file is the line itself, nothing more.
  writeFileSync(path, winner.text, "utf8");
  return path;
}

// Read the file back and check it byte for byte: same bytes as written,
// still passes the gate, still the winner's text. Any difference fails
// the run with a non-zero exit, so a bad write can never pass silently.
function verifyWritten(path: string, expected: string): void {
  const bytes = readFileSync(path);
  const readBack = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (readBack !== expected) {
    throw new Error(
      `verify failed: entry.txt does not match the winner byte for byte ` +
        `(read ${bytes.length} bytes, expected ${Buffer.byteLength(expected, "utf8")})`,
    );
  }
  const gateResult = gate(readBack);
  if (!gateResult.ok) {
    throw new Error(`verify failed: written entry fails the gate: ${gateResult.reasons.join("; ")}`);
  }
  if (Buffer.compare(bytes, Buffer.from(expected, "utf8")) !== 0) {
    throw new Error("verify failed: entry.txt bytes differ from the winner");
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const ranked = rankCandidates(CANDIDATES);

  if (ranked.length === 0) {
    console.error("error: every candidate failed the gate, nothing to write");
    process.exit(1);
  }

  // Print the full table, so a reader can see why the winner won and
  // how close the rest came. The winner is the first row.
  console.log("candidate scores (total / 100):");
  for (const row of ranked) {
    const s = row.score;
    console.log(
      `  ${row.candidate.id.padEnd(20)} total=${s.total.toFixed(1)} ` +
        `status=${s.statusLine} plain=${s.plainShort} detail=${s.smallDetail} ` +
        `grief-free=${s.noAnnouncedGrief} orig=${s.originality} ` +
        `chars=${charCount(row.candidate.text)}`,
    );
  }

  const winner = ranked[0];
  const path = writeWinner(winner.candidate);
  verifyWritten(path, winner.candidate.text);

  console.log(`winner: ${winner.candidate.id}`);
  console.log(`entry: ${winner.candidate.text}`);
  console.log(`chars: ${charCount(winner.candidate.text)}`);
  console.log(`wrote: ${path}`);
  console.log("verify: byte-for-byte match, gate passed");
}

main();
