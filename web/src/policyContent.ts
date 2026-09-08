/**
 * Privacy and terms content.
 *
 * **This describes what the product actually does with data — it is not legal
 * advice, and it has not been reviewed by a lawyer.** Every factual statement
 * here was taken from the running code: which third parties receive data, what
 * is stored, what Synzapp can and cannot read. That is the part an engineer is
 * best placed to get right, and the part a lawyer cannot write without us.
 *
 * The legal framing around it — governing law, liability, the customer's own
 * obligations — needs a solicitor before this is published as binding.
 *
 * If the product changes, this changes with it. A privacy policy that has
 * drifted from what the software does is worse than none, because it is a
 * written record of a false statement.
 */

export interface PolicySection {
  body: string[];
  heading: string;
}

export interface PolicyDocument {
  intro: string;
  /** Shown to readers so they can tell whether they are looking at a current version. */
  lastUpdated: string;
  sections: PolicySection[];
  title: string;
}

/**
 * Terms of service.
 *
 * The same rule as the privacy policy applies here, and applies harder: every
 * factual statement is taken from what the software does, and the legal framing
 * around it — governing law, liability caps, the customer's own obligations —
 * needs a solicitor before this is published as binding.
 *
 * Two things are said plainly rather than hidden. There is no availability
 * guarantee yet, and we will not delete records that are under a legal hold.
 * Both are easier to argue about now than after somebody has signed.
 */
export const TERMS_OF_SERVICE: PolicyDocument = {
  intro:
    "These terms govern an organization's use of Synzapp. They are written plainly on purpose: an agreement that has to be decoded is an agreement that will be misunderstood by both sides.",
  lastUpdated: '1 September 2026',
  sections: [
    {
      body: [
        'This agreement is between Synzapp and the organization that subscribes to the service. Individual users access Synzapp through their organization and do not enter into a separate agreement with us.',
        'Where a person accepts these terms, they confirm they are authorised to bind their organization.'
      ],
      heading: 'Who this agreement is with'
    },
    {
      body: [
        'Messaging between an organization\'s people, encrypted so that only intended recipients can read it.',
        'Live interpretation for meetings, with transcripts and summaries.',
        'Operating disciplines: Leaders Standard Work, root cause analysis, and an improvement loop.',
        'Administrative controls over retention, legal holds and the production of records.',
        'We may improve and change the service. Where a change removes a capability an organization relies on, we will give reasonable notice rather than withdrawing it without warning.'
      ],
      heading: 'What Synzapp provides'
    },
    {
      body: [
        'Who it grants access to, and removing access when someone leaves.',
        'Telling its staff how the service is configured, and in particular where a readable compliance archive is enabled, that their work conversations are retained by their employer and can be produced.',
        'Its retention settings, and the consequences of them. Content removed under a rule the organization configured cannot be recovered by us.',
        'The lawfulness of the content its people create and of its instructions to us.'
      ],
      heading: "The organization's responsibilities"
    },
    {
      body: [
        'We process it to provide the service and for no other purpose. We do not sell it, use it for advertising, or use customer content to train models.',
        'Messages are encrypted such that Synzapp cannot read them. Where the organization enables a compliance archive, the readable copy is protected by a key belonging to that organization.',
        'Our handling of information is described in the Privacy Policy, which forms part of these terms.'
      ],
      heading: "What we do with the organization's information"
    },
    {
      body: [
        'We aim to keep Synzapp available and to restore it promptly when it is not.',
        'We do not currently offer a contractual availability guarantee or service credit scheme. We would rather say so than publish a figure we are not yet in a position to stand behind. Where an organization requires committed availability terms, that is a conversation to have before subscribing.'
      ],
      heading: 'Availability'
    },
    {
      body: [
        'We protect information using the measures described in the Privacy Policy, including encryption in transit and at rest, access tied to a verified telephone number, and recorded administrative actions.',
        'No service can promise that a compromise is impossible. If one occurs, we will tell affected organizations without undue delay.'
      ],
      heading: 'Security'
    },
    {
      body: [
        'We may suspend access where it is necessary to protect the service or other customers. Examples include an account that is compromised or is being used to attack the platform. We will restore access as soon as the cause is resolved and will explain what happened.'
      ],
      heading: 'Suspension'
    },
    {
      body: [
        'An organization may stop using Synzapp at any time.',
        'On termination, the organization may export its records before deletion. We will say clearly how long that window is and will not delete anything within it.',
        'Where records are subject to a legal hold, deletion is refused until the hold is lifted. This is deliberate: destroying preserved evidence on request is not a service we will provide.'
      ],
      heading: 'Ending the agreement'
    },
    {
      body: [
        'The organization keeps all rights in the content its people create. We claim no ownership of it.',
        'Synzapp keeps all rights in the software and everything we provide. Nothing in these terms transfers ownership of it.'
      ],
      heading: 'Intellectual property'
    },
    {
      body: [
        'Nothing in these terms limits liability that cannot lawfully be limited, including for death or personal injury caused by negligence, or for fraud.',
        "Subject to that, the extent of each party's liability is to be agreed in the subscription documentation for the organization concerned."
      ],
      heading: 'Liability'
    },
    {
      body: [
        'Every version is retained with the date it took effect. Where a change materially affects an organization we will tell that organization directly, and give reasonable notice before it takes effect.'
      ],
      heading: 'Changes to these terms'
    },
    {
      body: [
        'The law governing this agreement and the courts having jurisdiction are set out in the subscription documentation for the organization concerned.',
        'For anything else, use the contact form on this site.'
      ],
      heading: 'Governing law and contact'
    }
  ],
  title: 'Terms of Service'
};

export const PRIVACY_POLICY: PolicyDocument = {
  intro:
    'This explains what Synzapp does with information when an organization uses it. It is written to be read, not to be survived.',
  lastUpdated: '30 August 2026',
  sections: [
    {
      body: [
        'Synzapp is sold to organizations, not to individuals. Where your employer provides Synzapp to you, your employer decides what is kept and for how long, and this policy sits underneath those decisions.',
        'That means some questions about your own data are answered by your employer rather than by us. We say plainly below which is which.'
      ],
      heading: 'Who this applies to'
    },
    {
      body: [
        'To sign in: your phone number, and a code we send to it. We do not store passwords, because there are none to store.',
        'Your name, role and department, as entered by your organization.',
        'Records of activity within the product, such as messages sent, meetings held and tasks completed, kept for your organization.',
        'Technical information needed to run the service, such as the type of device you sign in from.'
      ],
      heading: 'What we collect'
    },
    {
      body: [
        'Messages between people in your organization are encrypted on the sending device. Synzapp cannot read them. This is not a policy commitment that could be changed later. We do not hold a key that opens them.',
        'Where an organization turns on a compliance archive, a readable copy is kept for that organization, opened only under its control. Organizations that do this are expected to tell their staff, and Synzapp states it here as well.',
        'Photographs, video, voice notes and documents are encrypted in the same way.',
        'Announcements are different, and deliberately so. A notice sent by your organization to its staff is kept as a company record, not sealed like a private message, because its purpose is to be produced later if somebody asks whether people were told. Your organization decides how long these are kept, and the record of who confirmed reading one outlives the notice itself.',
        'Actions work the same way. When somebody turns a message into an action, so that a named team can fix a problem and confirm it is done, that action is kept as a company record rather than sealed like the message it came from. This is stated on screen before the action is created. Your organization decides how long these are kept, and the record of who raised it, who did the work and who verified it outlives the description of the problem itself.'
      ],
      heading: 'What we cannot read'
    },
    {
      body: [
        'Two companies process data on our behalf, and no others:',
        'Google Cloud provides the servers, databases and file storage that run Synzapp, and holds the keys that protect compliance archives. Data is stored in the United States.',
        'OpenAI provides the live interpreter. When a meeting uses interpretation, the spoken audio of that meeting is sent to OpenAI to be translated, and the translation is returned. This applies only to meetings where interpretation is switched on. It does not apply to your messages.',
        'We do not sell information to anyone, and we do not use it to advertise.'
      ],
      heading: 'Who else receives information'
    },
    {
      body: [
        'How long conversations are kept is set by your organization, not by us. It can be anything from a few days to indefinitely.',
        'Where your organization has set a rule to remove old conversations, nothing is removed automatically at the moment it expires. An administrator at your organization reviews and approves it first.',
        'Where a legal case requires records to be preserved, your organization can freeze them, and nothing removes them while that freeze is in place.'
      ],
      heading: 'How long things are kept'
    },
    {
      body: [
        'Ask your employer first. Because Synzapp is provided to you by your organization, requests about your own information usually go to them, and they can act on it directly within the product.',
        'If you cannot reach your employer, or your request concerns Synzapp itself rather than your organization, contact us using the form on this site and we will respond.'
      ],
      heading: 'Your rights over your information'
    },
    {
      body: [
        'Signing in requires a code sent to your phone, so a leaked password cannot be used against you. There is no password.',
        'Actions that permanently remove an organization’s records require the administrator to confirm their identity again, so a signed-in computer left unattended is not enough.',
        'Searching, producing, approving a removal and lifting a freeze are each recorded with who did it and when.'
      ],
      heading: 'How access is protected'
    },
    {
      body: [
        'If we change what we do with information, we change this page and update the date at the top. Where a change materially affects an organization, we tell that organization rather than relying on them to notice.'
      ],
      heading: 'Changes to this policy'
    },
    {
      body: [
        'Use the contact form on this site. If you are reporting a security problem, say so in the subject and we will treat it as urgent.'
      ],
      heading: 'How to reach us'
    }
  ],
  title: 'Privacy'
};

export const SUBPROCESSORS = [
  {
    location: 'United States',
    name: 'Google Cloud',
    purpose: 'Servers, database, file storage, and protection of compliance archive keys'
  },
  {
    location: 'United States',
    name: 'OpenAI',
    purpose: 'Live meeting interpretation, using spoken audio from meetings where interpretation is switched on'
  }
];
