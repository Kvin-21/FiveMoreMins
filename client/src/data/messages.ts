export type EscalationLevel = 'mild' | 'medium' | 'aggressive';

export const messages: Record<EscalationLevel, string[]> = {
  mild: [
    "Oh, you're back. How generous of you.",
    "Five minutes? That's cute. Real productive stuff out there, huh?",
    "You left for a bit. The timer noticed. I noticed. We all noticed.",
    "Back already? Thought you ghosted us like your gym membership.",
    "Wow, a whole five minutes. Did you find the meaning of life out there?",
    "That tab wasn't gonna focus itself, but sure, take your time.",
    "You stepped away and nothing burned down. Disappointed, honestly.",
    "Oh hey, stranger. Pull up a chair. Or don't. You'll leave again anyway.",
    "Welcome back. Your productivity didn't miss you either.",
    "Five minutes of freedom. Was it worth it? Rhetorical question."
  ],
  medium: [
    "Fifteen minutes. That's not a break, that's a lifestyle choice.",
    "Was the distraction worth it? Narrator: it wasn't.",
    "Congrats, you found the internet's rabbit hole. Again.",
    "You've been gone long enough to microwave a meal and eat it. Twice.",
    "At this rate, your deadline is gonna file a restraining order.",
    "Your focus session called. It wants a divorce.",
    "Even your screen saver thinks you're slacking.",
    "If procrastination was a sport, you'd have sponsorships by now.",
    "Your attention span just filed for bankruptcy.",
    "Fifteen minutes of 'just checking one thing', right? Sure."
  ],
  aggressive: [
    "Thirty minutes. THREE-ZERO. Do you even want to pass?",
    "If this was a job, your desk would already be packed.",
    "Your accountability partner is about to see something interesting. Just saying.",
    "You know that image you uploaded? It's getting restless.",
    "At this point, the blackmail is doing you a FAVOUR.",
    "I've seen glaciers move faster than your work ethic.",
    "Your future self is going to HATE present you. More than usual.",
    "Pack it up. Actually, don't — you clearly love suffering.",
    "That image is one API call away from your partner's inbox. Tick tock.",
    "You're speedrunning failure and honestly? Impressive commitment.",
    "Hope that YouTube video was worth your dignity.",
    "The image. The email. The send button. Think about it."
  ]
};

export function getRandomMessage(level: EscalationLevel): string {
  const pool = messages[level];
  return pool[Math.floor(Math.random() * pool.length)];
}
