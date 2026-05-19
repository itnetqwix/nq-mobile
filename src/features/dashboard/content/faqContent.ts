export type FaqItem = { id: string; q: string; a: string };
export type FaqSection = { title: string; items: FaqItem[] };

export const FAQ_SECTIONS: FaqSection[] = [
  {
    title: "Getting started",
    items: [
      {
        id: "gs1",
        q: "What is NetQwix?",
        a: "NetQwix connects trainees with expert coaches for live video lessons, clip review, scheduling, and progress tracking — all in one app.",
      },
      {
        id: "gs2",
        q: "Do I need Expo Go for video lessons?",
        a: "No. Live lessons require the NetQwix dev or store build with native WebRTC. Expo Go cannot run in-app video calls.",
      },
      {
        id: "gs3",
        q: "How do I book a coach?",
        a: "Use Book a lesson to pick a trainer, choose instant or scheduled time, attach clips if needed, and confirm payment.",
      },
    ],
  },
  {
    title: "Instant lessons",
    items: [
      {
        id: "il1",
        q: "How does an instant lesson work?",
        a: "The trainee requests a lesson; the coach Accepts; both tap Join now within 2 minutes to enter the native meeting room.",
      },
      {
        id: "il2",
        q: "Why is Join disabled?",
        a: "Join opens only after the coach accepts and while you are inside the 2-minute join window. Refresh Upcoming sessions if the booking just confirmed.",
      },
      {
        id: "il3",
        q: "When does the lesson timer start?",
        a: "For instant lessons the timer starts automatically once both coach and trainee are in the call.",
      },
    ],
  },
  {
    title: "Scheduled sessions",
    items: [
      {
        id: "sc1",
        q: "When can I join a scheduled session?",
        a: "Join is enabled from 15 minutes before the session start time until the session ends (after the coach confirms the booking).",
      },
      {
        id: "sc2",
        q: "Who starts the timer?",
        a: "The coach taps Start after both are connected. If the trainee joins more than 2 minutes after the coach, the timer may start automatically.",
      },
      {
        id: "sc3",
        q: "What if my coach is late?",
        a: "The timer waits until both parties are in the call. You will see a banner when your partner joins.",
      },
    ],
  },
  {
    title: "Video & clips",
    items: [
      {
        id: "v1",
        q: "Why is my video black?",
        a: "Allow camera and microphone in Settings, use a physical device (not simulator-only), and ensure your partner joined the same session.",
      },
      {
        id: "v2",
        q: "How do clips work in a lesson?",
        a: "The coach selects clips from the locker; playback syncs to the trainee. Use the clips button on the compact toolbar during the call.",
      },
      {
        id: "v3",
        q: "Can I draw on video?",
        a: "Coaches can enable draw mode and use shapes. Screenshots save to the session game plan.",
      },
    ],
  },
  {
    title: "Payments & wallet",
    items: [
      {
        id: "p1",
        q: "How do I pay for a lesson?",
        a: "Payments run through Stripe when you book. Your wallet balance may apply per your account settings.",
      },
      {
        id: "p2",
        q: "How do coaches get paid?",
        a: "Coaches connect Stripe in settings. Earnings follow the platform payout schedule after completed sessions.",
      },
    ],
  },
  {
    title: "Locker & game plans",
    items: [
      {
        id: "l1",
        q: "Where are my clips stored?",
        a: "Trainees upload clips to My locker; coaches see trainee clips when attached to bookings or via clip picker in-call.",
      },
      {
        id: "l2",
        q: "What is a game plan?",
        a: "After a lesson the coach can save screenshots and notes as a game plan PDF in the locker for later review.",
      },
    ],
  },
  {
    title: "Chat",
    items: [
      {
        id: "c1",
        q: "Can I edit or delete messages?",
        a: "You can edit your message within 30 minutes, reply to a specific message, archive a chat, or delete a conversation from the chats list.",
      },
      {
        id: "c2",
        q: "How do groups work?",
        a: "Create a group with friends from your circle. Invited members must accept before joining. The creator is the group admin.",
      },
    ],
  },
  {
    title: "Account & support",
    items: [
      {
        id: "a1",
        q: "How do I verify my account?",
        a: "Complete profile, contact verification, and trainer verification steps under Settings when prompted.",
      },
      {
        id: "a2",
        q: "How do I contact support?",
        a: "Use Contact us in Settings for technical issues or refunds, or ask a question at the bottom of the FAQ screen.",
      },
    ],
  },
];
