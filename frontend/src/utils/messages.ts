// All the passive-aggressive messages, sorted by how badly you screwed up

export const mildMessages = [
  "Oh, you're back? I saw you eyeing your phone. Embarrassing.",
  "5 minutes staring at your phone. That's how long it took to betray yourself.",
  "Welcome back, quitter. Ready to pretend you're productive?",
  "Wow, a whole 5 minutes of 'just checking something real quick', huh?",
  "Your future self is watching through this camera. And they're disappointed.",
  "Cool break. Did you solve anything on that phone? No? Shocking.",
  "Back already? Didn't find anything more interesting to scroll through?",
];

export const mediumMessages = [
  "15 minutes gone. That phone must've had some really educational content.",
  "You're speedrunning failure at this point. Impressive, actually.",
  "Your accountability partner would be SO proud right now. Oh wait.",
  "Half your focus session, gone to your phone. But sure, you'll 'make it up later'.",
  "At this rate, your blackmail photo is basically packing its own suitcase.",
  "Achievement unlocked: Professional Time Waster.",
  "That's 15 minutes you'll never get back. How's that feel? Focus.",
];

export const aggressiveMessages = [
  "30 MINUTES on your phone. Your image is being sent RIGHT NOW. Hope it was worth it.",
  "Congratulations! You've unlocked: CONSEQUENCES. Your partner just got a fun surprise.",
  "Game over. Your embarrassing photo just landed in someone's inbox. Feel motivated yet?",
  "You had ONE job. ONE. And now your partner knows exactly how seriously you take your goals.",
  "The blackmail has been sent. This is what rock bottom looks like. Now get back to work.",
  "30 minutes of nothing. Your photo has been delivered. You played yourself.",
];

export function getRandomMessage(tier: 'mild' | 'medium' | 'aggressive'): string {
  const pool = tier === 'mild' ? mildMessages : tier === 'medium' ? mediumMessages : aggressiveMessages;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getTier(distractedSeconds: number): 'mild' | 'medium' | 'aggressive' | null {
  // ─── Change these to adjust warning thresholds ───────────────────────────────
  // These must match MILD_SECONDS / MEDIUM_SECONDS / PENALTY_SECONDS in useFaceDetection.ts
  if (distractedSeconds >= 30 * 60) return 'aggressive'; // 30 min
  if (distractedSeconds >= 15 * 60) return 'medium';     // 15 min
  if (distractedSeconds >= 5 * 60) return 'mild';        // 5 min
  // ─────────────────────────────────────────────────────────────────────────────
  return null;
}