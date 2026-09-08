/**
 * What the marketing page says Synzapp does.
 *
 * Written for the people who decide: owners, operations leaders, legal and
 * compliance. They need to know what the product does for the business and
 * what obligations it helps them meet — not how any of it is built. Anything
 * that only an engineer would care about has been left out on purpose; naming
 * the machinery does not reassure a buyer, it just makes them ask who will
 * maintain it.
 *
 * Equally deliberate: no customer counts, no logos, no uptime figures, no
 * certification badges and no testimonials. None of those are true yet, and an
 * enterprise buyer checks. A page that overstates costs more than a plain one,
 * because the first thing it spends is the reader's trust in everything else.
 *
 * Kept separate from the page so the claims can be reviewed on their own.
 */

/**
 * Counted from the interpreter's own language catalogue, not estimated.
 * If the catalogue changes, this number has to change with it.
 */
export const INTERPRETER_LANGUAGE_COUNT = 245;
export const INTERPRETER_SIMULTANEOUS_LANGUAGES = 4;

export interface ProductEntry {
  /** Three concrete things it does, in the reader's language. */
  capabilities: string[];
  /** What it is and why it matters, in one sentence a buyer can repeat. */
  description: string;
  id: string;
  name: string;
}

export interface ProductGroup {
  id: string;
  intro: string;
  products: ProductEntry[];
  title: string;
}

export const PRODUCT_GROUPS: ProductGroup[] = [
  {
    id: 'communication',
    intro:
      'Your people do two things every day. They talk to each other, and they talk to people who do not share their language.',
    products: [
      {
        capabilities: [
          'Direct and group conversations',
          'Photos, video, voice notes and documents',
          'Only the people in a conversation can read it',
          'Leavers lose access; the record does not leave with them'
        ],
        description:
          'Everyday messaging for staff that belongs to the organization rather than to a consumer app. Your people get what they already expect; the business keeps a say in what happens to the conversation.',
        id: 'chat',
        name: 'Organization-controlled workplace chat'
      },
      {
        capabilities: [
          `${INTERPRETER_LANGUAGE_COUNT} languages`,
          `Up to ${INTERPRETER_SIMULTANEOUS_LANGUAGES} languages in the same meeting`,
          'Spoken translation while the person is still speaking',
          'A written record and a summary afterwards'
        ],
        description:
          'A meeting between people with no language in common, handled as it happens. Natural spoken translation rather than subtitles, so the conversation keeps its pace.',
        id: 'interpreter',
        name: 'Live real-time interpreter'
      }
    ],
    title: 'How your people communicate'
  },
  {
    id: 'operations',
    intro:
      'Three disciplines that separate a business which improves from one that keeps solving the same problem.',
    products: [
      {
        capabilities: [
          'Daily and weekly routines with a named owner',
          'Checked by the level above',
          'A record of what was done, and when'
        ],
        description:
          'The checks your leaders are meant to run become scheduled work with an owner, instead of something remembered on a good week.',
        id: 'lsw',
        name: 'Leaders Standard Work'
      },
      {
        capabilities: [
          'Work a problem back to its cause',
          'Evidence kept with the finding',
          'Actions with an owner and a date'
        ],
        description:
          'Get past the symptom to what actually caused it, and keep the reasoning where the next person can find it.',
        id: 'rca',
        name: 'Root Cause Analysis'
      },
      {
        capabilities: [
          'Improvements move through defined stages',
          'Ownership and due dates in the open',
          'Raised automatically when something slips'
        ],
        description:
          'Rapid Action & Improvement Looping System. Improvement work moves through a defined loop instead of stalling in an inbox until it is forgotten.',
        id: 'rails',
        name: 'RAILS'
      }
    ],
    title: 'How the business improves'
  },
  {
    id: 'governance',
    intro:
      'The part that matters when a dispute, an audit or a regulator arrives. It is also the part most messaging tools leave you to solve on your own.',
    products: [
      {
        capabilities: [
          'Set how long conversations are kept',
          'See what a rule would do before it takes effect',
          'A clear answer for why any conversation was kept or removed'
        ],
        description:
          'Decide how long conversations are kept, and be able to show why. A rule is tested before it takes effect, and nothing is removed without a person approving it.',
        id: 'retention',
        name: 'Retention rules'
      },
      {
        capabilities: [
          'Freeze conversations so nothing can remove them',
          'Find messages by person, date or wording',
          'Hand over a readable record with the original files'
        ],
        description:
          'When you are asked to produce records, freeze what is relevant and hand over something a lawyer can read, with a list of exactly what is in it.',
        id: 'ediscovery',
        name: 'Legal hold and disclosure'
      }
    ],
    title: 'What happens to the record'
  }
];

export interface AssuranceEntry {
  detail: string;
  title: string;
}

/**
 * Why an organization can rely on this.
 *
 * Stated as commitments a buyer can hold us to, not as technology. Each one is
 * something the product genuinely does today — and each is phrased as the
 * outcome, because that is the form a legal or compliance reader can act on.
 */
export const ASSURANCES: AssuranceEntry[] = [
  {
    detail:
      'A message can only be read by the people it was sent to. It is protected on the sender’s device before it travels, and Synzapp cannot open it.',
    title: 'Private to the people in the conversation'
  },
  {
    detail:
      'Where an organization needs a readable record of its own conversations, that record belongs to the organization and is opened only under its control. Its staff are told this is in place.',
    title: 'Your records stay yours'
  },
  {
    detail:
      'A freeze for a legal matter outranks every retention rule and every administrator. While it is on, nothing it covers can be removed, and lifting it does not take effect immediately.',
    title: 'A freeze nobody can override'
  },
  {
    detail:
      'Nothing disappears the moment a rule expires. Expired conversations go to a review queue, and approving their removal requires the administrator to confirm their identity again.',
    title: 'Nothing is deleted without a person approving it'
  },
  {
    detail:
      'Searching records, producing them, approving a deletion and lifting a freeze are each written down with who did it and what they asked for.',
    title: 'Every action on records is recorded'
  },
  {
    detail:
      'People sign in with their work phone number and a code sent to it. There are no shared passwords to leak, and a device that leaves the organization loses access.',
    title: 'Access tied to a person, not a password'
  }
];

export interface AboutPrinciple {
  detail: string;
  title: string;
}

/**
 * About us.
 *
 * Deliberately free of the things an About page usually invents: no founding
 * year, no headcount, no offices, no customer logos, no awards. Every sentence
 * here is either the problem the product addresses or something the product
 * actually does today, because a claim a buyer can check is worth more than
 * one that merely sounds established.
 */
export const ABOUT_PARAGRAPHS: string[] = [
  'Most companies run their working day on tools that were built for consumers. '
    + 'Conversations about real work sit in apps the company does not own, in accounts tied to '
    + 'personal phone numbers, on services nobody at the company can search when a regulator or a '
    + 'lawyer asks what was said.',
  'At the same time the people doing that work do not all share a language, and the routines that '
    + 'keep a business improving, the daily checks and the root cause work and the follow-through, '
    + 'end up in spreadsheets that nobody opens twice.',
  'Synzapp exists to put those things in one place and hand control of them to the organization. '
    + 'The conversation, the interpreting, the improvement work and the record of all of it, on '
    + 'iPhone, on Android and on the web.'
];

export const ABOUT_PRINCIPLES: AboutPrinciple[] = [
  {
    detail:
      'A message is protected on the sending device. We cannot open one, and that is a property of '
      + 'how it is built rather than a promise we could quietly withdraw later.',
    title: 'We cannot read your messages'
  },
  {
    detail:
      'Where an organization keeps a readable archive of its own conversations, that archive '
      + 'belongs to the organization, opens only under its control, and its staff are told it is '
      + 'in place.',
    title: 'The record belongs to the company, not to us'
  },
  {
    detail:
      'Nothing is removed at the moment a rule expires. A person has to approve it, a legal freeze '
      + 'overrides every rule and every administrator, and each of those steps is written down.',
    title: 'Deleting is a decision, never a side effect'
  }
];

export interface FooterColumn {
  links: { href: string; label: string }[];
  title: string;
}

/**
 * Footer navigation — only destinations that exist. A footer of links to pages
 * that were never built is the fastest way to look unfinished.
 */
export const FOOTER_COLUMNS: FooterColumn[] = [
  {
    links: [
      { href: '#chat', label: 'Workplace chat' },
      { href: '#interpreter', label: 'Live interpreter' },
      { href: '#retention', label: 'Retention rules' },
      { href: '#ediscovery', label: 'Legal hold and disclosure' }
    ],
    title: 'Communication and records'
  },
  {
    links: [
      { href: '#lsw', label: 'Leaders Standard Work' },
      { href: '#rca', label: 'Root cause analysis' },
      { href: '#rails', label: 'RAILS improvement loop' }
    ],
    title: 'Operations'
  },
  {
    links: [
      { href: '#assurance', label: 'Why you can rely on it' },
      { href: '#about', label: 'About us' },
      { href: '#contact', label: 'Contact' },
      { href: '#terms', label: 'Terms of Service' },
      { href: '#privacy', label: 'Privacy' },
      { href: '#subprocessors', label: 'Who processes our data' }
    ],
    title: 'Company'
  }
];
