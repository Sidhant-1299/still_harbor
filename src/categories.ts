export type Category = {
  id: string;
  name: string;
  symbol: string;
  description: string;
  note: string;
  domains: readonly string[];
};

// Deliberately small, reviewable starter lists, shipped with the extension.
// No runtime downloads, wildcard matching, or site visits. See docs/categories.md.
export const CATEGORY_VERSION = '2026-10-11';
export const CATEGORIES: readonly Category[] = [
  {
    id: 'social', name: 'Social media', symbol: '◉',
    description: 'Less scrolling. More room for the world around you.',
    note: 'Includes social feeds, video communities, and messaging sites. It also blocks useful work and community pages on these domains.',
    domains: [
      'facebook.com', 'fb.com', 'messenger.com', 'instagram.com', 'threads.net', 'threads.com',
      'twitter.com', 'x.com', 't.co', 'tiktok.com', 'reddit.com', 'redd.it',
      'snapchat.com', 'pinterest.com', 'pin.it', 'linkedin.com', 'tumblr.com',
      'bsky.app', 'mastodon.social', 'discord.com', 'discord.gg', 'whatsapp.com',
      'telegram.org', 't.me', 'youtube.com', 'youtu.be', 'twitch.tv', 'kick.com',
      'quora.com', 'weibo.com', 'vk.com', 'ok.ru', 'nextdoor.com', 'bereal.com', 'lemon8-app.com',
    ],
  },
  {
    id: 'adult', name: 'Pornography', symbol: '◇',
    description: 'A quiet boundary around explicit-content sites.',
    note: 'Includes adult video, webcam, and subscription platforms. Some subscription platforms also host non-explicit creators.',
    domains: [
      'pornhub.com', 'pornhubpremium.com', 'xvideos.com', 'xnxx.com', 'xhamster.com',
      'youporn.com', 'redtube.com', 'tube8.com', 'spankbang.com', 'eporner.com',
      'porn.com', 'pornone.com', 'tnaflix.com', 'beeg.com', 'youjizz.com',
      'motherless.com', 'redgifs.com', 'chaturbate.com', 'stripchat.com', 'bongacams.com',
      'myfreecams.com', 'cam4.com', 'livejasmin.com', 'camsoda.com', 'onlyfans.com',
      'fansly.com', 'manyvids.com', 'clips4sale.com', 'brazzers.com', 'bangbros.com',
      'realitykings.com', 'naughtyamerica.com', 'mofos.com', 'sex.com', 'xhamsterlive.com',
    ],
  },
  {
    id: 'betting', name: 'Betting & gambling', symbol: '♧',
    description: 'Keep the odds outside your quiet space.',
    note: 'Includes sportsbooks, casinos, poker, and real-money fantasy sports. Some operator domains also host hotel/travel pages. Regional domains and changing mirrors are not comprehensively covered.',
    domains: [
      'bet365.com', 'bet365.fr', 'betfair.com', 'betway.com', 'bwin.com',
      'paddypower.com', 'williamhill.com', 'ladbrokes.com', 'coral.co.uk', 'skybet.com',
      'unibet.com', 'unibet.co.uk', '888sport.com', '888casino.com', '888poker.com',
      'pokerstars.com', 'partypoker.com', 'draftkings.com', 'fanduel.com', 'betmgm.com',
      'caesars.com', 'sportsbet.com.au', 'tab.com.au', 'stake.com', 'stake.us',
      'bc.game', 'roobet.com', 'rollbit.com', '1xbet.com', '22bet.com',
      'betsson.com', 'leovegas.com', 'bet-at-home.com', 'dafabet.com', 'parimatch.com',
      'betvictor.com', 'betfred.com', 'smarkets.com', 'pinnacle.com', 'bovada.lv',
      'betonline.ag', 'betus.com.pa', '10bet.com', 'dream11.com', 'my11circle.com',
    ],
  },
];

export function categoryById(id: string): Category | undefined {
  return CATEGORIES.find(category => category.id === id);
}
