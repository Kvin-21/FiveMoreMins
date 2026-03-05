// All the passive-aggressive messages, sorted by how badly you screwed up

export const mildMessages = [
  "Oh, you're back? I was starting to think you'd ghosted your own goals.",
  "5 minutes. That's how long it took you to betray yourself.",
  "Welcome back, quitter. Ready to pretend you're productive?",
  "Wow, a whole 5 minutes of 'just checking something real quick', huh?",
  "Your future self is watching. And they're disappointed.",
  "Cool break. Did you solve anything? No? Shocking.",
  "Back already? Didn't find anything more interesting to waste your time on?",
];

export const mediumMessages = [
  "15 minutes gone. That YouTube video must've been really educational.",
  "You're speedrunning failure at this point. Impressive, actually.",
  "Your accountability partner would be SO proud right now. Oh wait.",
  "Half your focus session, gone. But sure, you'll 'make it up later'.",
  "At this rate, your blackmail photo is basically packing its own suitcase.",
  "Achievement unlocked: Professional Time Waster.",
  "That's 15 minutes you'll never get back. How's that feel? Focus.",
];

export const aggressiveMessages = [
  "30 MINUTES. Your image is being sent RIGHT NOW. Hope it was worth it.",
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

export function getTier(awaySeconds: number): 'mild' | 'medium' | 'aggressive' | null {
  if (awaySeconds >= 30 * 60) return 'aggressive';
  if (awaySeconds >= 15 * 60) return 'medium';
  if (awaySeconds >= 5 * 60) return 'mild';
  return null;
}
