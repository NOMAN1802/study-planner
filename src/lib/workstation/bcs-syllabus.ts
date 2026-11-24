// BCS Preliminary lectures: one lecture per video of Doc/study-resource/*.pdf
// (164 lecture videos), titled as in those PDFs. Within each subject the
// videos follow the class order of Doc/New Routine .pdf. Subjects are in the
// default study order (hardest first). Vocabulary is studied every day
// alongside whichever subject is current.

export type LecturePart = { title: string; url: string };
export type SyllabusTopic = { title: string; parts: LecturePart[] };
export type SyllabusSubject = {
  name: string;
  color: string;
  isDaily?: boolean;
  resourceFile: string;
  topics: SyllabusTopic[];
};

const p = (id: string, title: string): LecturePart => ({ title, url: `https://youtu.be/${id}` });
const lecture = (title: string, ...parts: LecturePart[]): SyllabusTopic => ({ title, parts });
/** A lecture that is exactly one video. */
const video = (id: string, title: string): SyllabusTopic => lecture(title, p(id, title));

/** English vocabulary: one reference lecture per video part (Part 3 is not in the series). */
export const VOCABULARY_LECTURES: readonly SyllabusTopic[] = [
  video("7EP3Cj57e40", "Vocabulary 01: Part 1"),
  video("hvpk_oIWbJ4", "Vocabulary 02: Part 2"),
  video("BZKtfHocHG8", "Vocabulary 03: Part 4"),
  video("VqSA1hiRntI", "Vocabulary 04: Part 5"),
  video("pdN5s923iyU", "Vocabulary 05: Part 6"),
  video("bwQqFtvv6Nc", "Vocabulary 06: Part 7"),
  video("F2yLe0oakwg", "Vocabulary 07: Part 8"),
  lecture("Vocabulary 08: Part 9", p("w3FhXmMPjhE", "Vocabulary Parts 9–10 (Part 9)")),
  lecture("Vocabulary 09: Part 10", p("w3FhXmMPjhE", "Vocabulary Parts 9–10 (Part 10)")),
];

/**
 * The revision phase, in order: whole days given to one subject (or two
 * sharing a day). Subjects are named as in BCS_SYLLABUS. Math gets 2 days:
 * its first falls on the 21 Feb 2027 holiday (a double study session).
 */
export const REVISION_PLAN: readonly { subjects: readonly string[]; days: number }[] = [
  { subjects: ["English Literature + Grammar"], days: 3 },
  { subjects: ["Bangla Literature + Grammar"], days: 2 },
  { subjects: ["Math + Mental Ability"], days: 2 },
  { subjects: ["International Affairs"], days: 2 },
  { subjects: ["Bangladesh Affairs"], days: 2 },
  { subjects: ["General Science"], days: 1 },
  { subjects: ["Computer & ICT"], days: 1 },
  { subjects: ["Geography", "Morality, Values & Good Governance"], days: 1 },
];
export const REVISION_PLAN_DAYS = REVISION_PLAN.reduce((n, b) => n + b.days, 0);
/**
 * 164 lectures (2 a day, Fridays too, 3 on holidays) plus 9 subject final days,
 * from a 24 Nov 2026 start with holidays 16 Dec, 25 Dec, 24 Jan and 21 Feb:
 * lectures end 21 Feb, leaving 2 spare days before the 15-day revision
 * (exam-ready 10 Mar 2027).
 */
export const DEFAULT_LEARNING_DAYS = 92;

export const BCS_SYLLABUS: readonly SyllabusSubject[] = [
  {
    name: "English Literature + Grammar",
    color: "#0f766e",
    resourceFile: "English Literature.pdf, English Grammer.pdf",
    topics: [
      video("0Hnk9DWSzOA", "Lit 01: Literary Terms"),
      video("HJeIq9E56WQ", "Lit 02: Old & Middle English Period & The Renaissance Period-1"),
      video("jySlpt-5IaI", "Lit 03: The Renaissance Period-2"),
      video("3ST-aTkCMA0", "Lit 04: The Renaissance Period-3"),
      video("4n0DztHRk6A", "Lit 05: The Neoclassical Period (1660-1798)"),
      video("96PgkdjndR8", "Lit 06: The Romantic Period"),
      video("AHL8C5Ai_T0", "Lit 07: The Victorian Period"),
      video("lzvquKoFkik", "Lit 08: Modern English Period"),
      video("V_IBnyvm-7c", "Lit 09: Modern 2 + Post Modern Period"),
      video("sSReXI38Rao", "Lit 10: Post Modern Period (1939 – Present)"),
      video("VPCPjHUP3FY", "Grammar 1.1: Basic & Gerund Participle (Part-1)"),
      video("3v6N-2270EU", "Grammar 1.2: Basic & Gerund Participle (Part-2)"),
      video("OH5l0oodQcE", "Grammar 2: Identification of Phrases & Clauses"),
      video("_OK7XGKC1NY", "Grammar 3: Determiner, Noun"),
      video("1Ngc1hzfU-g", "Grammar 4: Pronoun, Number, Gender"),
      video("2H9nSnDyUXw", "Grammar 5: Adjective & Adverb"),
      video("7iwbfiR9E6A", "Grammar 8: Tense"),
      video("yUtNoZIeZKU", "Grammar 9: Voice"),
      video("hy6-9-CqvRA", "Grammar 6: Preposition-1"),
      video("ZXUQtOyKF3Q", "Grammar 7: Preposition-2"),
      video("kxHtrR8j6Hk", "Grammar 11: Verb & Right Form of Verb"),
      video("JRrq5s8m224", "Grammar 10: Conditionals"),
      video("3a7vJKkT_ew", "Grammar 12: Correction"),
      video("sHyvV5QRgN4", "Grammar 13: Conjunction & Sentence"),
      video("-C4NokKPqUM", "Grammar 14: Narration"),
      video("F7N2eGSWu9A", "Grammar 15: Subject-Verb Agreement"),
      video("bA1e5F6IrUg", "Grammar 17: Spelling"),
      video("gv5DEod87Wg", "Grammar 16: Phrasal Verb"),
      video("Ygsv1dNXUMc", "Grammar 18: Phrase & Idioms"),
      video("jxT_wboecYg", "Grammar 19: One Word Substitute"),
    ],
  },
  {
    name: "Bangla Literature + Grammar",
    color: "#b45309",
    resourceFile: "Bangla Literature.pdf, Bangla Grammer.pdf",
    topics: [
      video("3MEDGkWsojE", "সাহিত্য ০১: বাংলা সাহিত্যের প্রাচীন যুগ"),
      video("LNIzTvOJuiQ", "সাহিত্য ০২: বাংলা সাহিত্যের মধ্যযুগ-০১"),
      video("KBJtADJOZbY", "সাহিত্য ০৩: বাংলা সাহিত্যের মধ্যযুগ-০২"),
      video("WIah_OCRFug", "সাহিত্য ০৪: বাংলা সাহিত্যের আধুনিক যুগ-০১"),
      video("Dxu3PGLE3YU", "সাহিত্য ০৫: বাংলা সাহিত্যের আধুনিক যুগ-০২"),
      video("mHbkSssv1cU", "সাহিত্য ০৬: বাংলা সাহিত্যের আধুনিক যুগ-০৩"),
      video("3bCucgMNlEs", "সাহিত্য ০৭: বাংলা সাহিত্যের আধুনিক যুগ-০৪"),
      video("lynsLCVa49Y", "সাহিত্য ০৮: বাংলা সাহিত্যের আধুনিক যুগ-০৫"),
      video("N8Brnh5adPA", "সাহিত্য ০৯: বাংলা সাহিত্যের আধুনিক যুগ-০৬"),
      video("pP2FI3ecjWg", "সাহিত্য ১০: বাংলা সাহিত্যের আধুনিক যুগ-০৭"),
      video("Zkcp030DkVU", "সাহিত্য ১১: বাংলা সাহিত্যের আধুনিক যুগ-০৮"),
      video("pOjesiOjrOg", "সাহিত্য ১২: মুক্তিযুদ্ধ ও ভাষা আন্দোলন ভিত্তিক সাহিত্য"),
      video("_B9HydejT1I", "সাহিত্য ১৩: পত্র-পত্রিকা, উক্তি-পঙক্তি, ছদ্মনাম/উপাধি, বাংলা সাহিত্যে প্রথম"),
      video("XfgsWKFcf1Q", "সাহিত্য ১৪: বাংলা সাহিত্যের প্রশ্ন সলভ সেশন-১"),
      video("-78zCJYlRe0", "সাহিত্য ১৫: বাংলা সাহিত্যের প্রশ্ন সলভ সেশন-২"),
      video("G6TsrfTLdtg", "সাহিত্য ১৬: বাংলা সাহিত্যের প্রশ্ন সলভ সেশন-৩"),
      video("YDxBlXnmnFk", "ব্যাকরণ ০১: শব্দের শ্রেণিবিভাগ-১"),
      video("ZV9jUV8eLVc", "ব্যাকরণ ০২: শব্দের শ্রেণিবিভাগ-২"),
      video("TMaVb4DCdR8", "ব্যাকরণ ০৩: ধ্বনি ও বর্ণ"),
      video("MQmbch2wPlc", "ব্যাকরণ ০৪: ধ্বনির পরিবর্তন"),
      video("mckSn3PTz1s", "ব্যাকরণ ০৫: সন্ধি"),
      video("g0Ya4rDssdM", "ব্যাকরণ ০৬: সমার্থক শব্দ ও প্রায় সমোচ্চারিত শব্দ"),
      video("_zi31qMKiGM", "ব্যাকরণ ১৬: উপসর্গ ও অন্যান্য"),
      video("-cO4FedbLo4", "ব্যাকরণ ০৭: প্রকৃতি প্রত্যয়-০১"),
      video("32mxc6QrlbE", "ব্যাকরণ ০৮: প্রকৃতি প্রত্যয়-০২"),
      video("1hScghIHL3o", "ব্যাকরণ ০৯: সমাস-১"),
      video("rz6xynJJU2I", "ব্যাকরণ ১০: সমাস-২"),
      video("UKadfxMtH_Y", "ব্যাকরণ ১১: পদ প্রকরণ"),
      video("wqvDBPLEzZs", "ব্যাকরণ ১২: বাক্য প্রকরণ"),
      video("ObtptlFOyQo", "ব্যাকরণ ১৩: বাংলা বানানের নিয়ম"),
      video("ihb1aSVXL1U", "ব্যাকরণ ১৪: বাক্যশুদ্ধি, প্রয়োগ/অপপ্রয়োগ"),
      video("v6RgPiWcFCE", "ব্যাকরণ ১৫: কারক"),
    ],
  },
  {
    name: "Math + Mental Ability",
    color: "#1d4ed8",
    resourceFile: "Math.pdf, Mental Ability.pdf",
    topics: [
      video("mb0LivRW6VY", "গণিত ০১: বাস্তব সংখ্যা ও জটিল সংখ্যা-১"),
      video("8VGwIt0Ckfo", "গণিত ০২: বাস্তব সংখ্যা ও জটিল সংখ্যা-২"),
      video("5UpwNWxVbF0", "গণিত ০৩: বীজগাণিতিক রাশি"),
      video("kJOzEWNynuk", "গণিত ১৬: উৎপাদকে বিশ্লেষণ ও দ্বিপদী বহুপদী"),
      video("mmJa7zkb46M", "গণিত ০৪: সূচক"),
      video("w0jSXjeEECs", "গণিত ০৫: লগারিদম"),
      video("LaW6W5a_JJY", "গণিত ০৬: সেট ও ফাংশন"),
      video("Bp_l-24bGQk", "গণিত ২৮: যৌগিক মুনাফা ও ভেনচিত্র"),
      video("4_94DVYTDwA", "গণিত ০৭: সমান্তর ধারা"),
      video("WOEBPqTbNho", "গণিত ০৮: গুণোত্তর ধারা"),
      video("VjSCNlQYzcY", "গণিত ০৯: সমীকরণ"),
      video("RZzQsF8YKb4", "গণিত ১০: অসমতা"),
      video("zvbO8TIqQKQ", "গণিত ১১: বিন্যাস (বেসিক)"),
      video("tWRjgw7nuZs", "গণিত ১২: বিন্যাস"),
      video("gGIxk5j6N8E", "গণিত ১৩: সমাবেশ"),
      video("iM-g58T_8Es", "গণিত ১৪: সম্ভাব্যতা-০১"),
      video("tZ-swAxcwxY", "গণিত ১৫: সম্ভাব্যতা-০২"),
      video("IrGUiQB9kiU", "গণিত ১৭: রেখা, কোণ ও ত্রিভুজ"),
      video("_0Gtk9DeO48", "গণিত ১৯: চতুর্ভুজ ও বহুভুজ"),
      video("8Ti1H8xalGc", "গণিত ২০: পরিমিতি ঘনবস্তু + বৃত্তের বাকি অংশ"),
      video("3XghLgS3ztg", "গণিত ১৮: পরিমিতি"),
      video("dTizsozAKYY", "গণিত ২১: ত্রিকোণমিতি"),
      video("zzpoetC-zW0", "গণিত ২২: শতকরা"),
      video("2EfpQaEz3PI", "গণিত ২৪: সরল মুনাফা"),
      video("n5BoU0T4pTk", "গণিত ২৩: লাভ-ক্ষতি"),
      video("ffge4WrjsBc", "গণিত ২৫: লসাগু-গসাগু"),
      video("Omst_LeJfyU", "গণিত ২৬: অনুপাত ও সমানুপাত"),
      video("aaE5q0yYQ5w", "গণিত ২৭: ঐকিক নিয়ম"),
      video("ivEOLg6XAMU", "মানসিক দক্ষতা ০১: ঘড়ি সংক্রান্ত সমস্যাবলি"),
      video("9Aj7Isj5oTQ", "মানসিক দক্ষতা ০২: বার নির্ণয়"),
      video("SrAIFRJi9z8", "মানসিক দক্ষতা ০৩: অবস্থান নির্ণয়"),
      video("3bUHUAgLnQs", "মানসিক দক্ষতা ০৪: যান্ত্রিক দক্ষতা"),
      video("8pIiWmn1e2A", "মানসিক দক্ষতা ০৭: ভাষাগত যৌক্তিক বিচার"),
      video("ae3YghvAuOc", "মানসিক দক্ষতা ০৫: সংখ্যাগত দক্ষতা"),
      video("8JdTq_OHu2g", "মানসিক দক্ষতা ০৬: ত্রিভুজ ও চতুর্ভুজ গণনা"),
    ],
  },
  {
    name: "International Affairs",
    color: "#7c2d12",
    resourceFile: "International Affairs.pdf",
    topics: [
      video("n-EZQgRfH3Q", "০১: আন্তর্জাতিক বিষয়াবলি প্রস্তুতি, বিশ্ব রাজনীতি ও অর্থনীতির মৌলিক ধারণা"),
      video("5kA81VhM1xM", "০২: বৈশ্বিক ইতিহাস-০১"),
      video("1dHoXCu5Jtc", "০৩: বৈশ্বিক ইতিহাস-০২"),
      video("1tDAVmb_n40", "০৪: বৈশ্বিক ইতিহাস-০৩ এবং জাতিসংঘ-০১"),
      video("vi14W_OVxPo", "০৫: জাতিসংঘ-০২"),
      video("Eh-KhCc-3Qs", "০৬: এশিয়া-০১"),
      video("QamT15U_34U", "০৭: এশিয়া-০২"),
      video("zZGQxzXiOOM", "০৮: এশিয়া-০৩"),
      video("hLmGul4wGrA", "০৯: আমেরিকা, আফ্রিকা ও ওশেনিয়া"),
      video("lrTh9I8vI8k", "১০: পরিবেশ"),
      video("TVcstHy188k", "১২: আন্তর্জাতিক নিরাপত্তা-০১"),
      video("eacuvZPNpXI", "১৩: আন্তর্জাতিক নিরাপত্তা-০২"),
      video("6sPJC45-EmQ", "১১: আন্তরাষ্ট্রীয় ক্ষমতা সম্পর্ক ও কূটনীতি"),
      video("Tdm0tUsYrbg", "14: International Organization-1"),
      video("K2UzRoq4B5s", "15: International Organization-2"),
      video("pBdQu5Wofzs", "16: International Organization-3"),
    ],
  },
  {
    name: "Bangladesh Affairs",
    color: "#15803d",
    resourceFile: "Bangladesh Affairs.pdf",
    topics: [
      video("aPRn2R0IGeI", "০১: বাঙলার প্রাচীন ইতিহাস"),
      video("USMBuA57PyM", "০২: গুরুত্বপূর্ণ স্থাপত্য, পর্যটক ও মুসলমানদের আগমন"),
      video("9IaLRm5oZYo", "০৩: মোগল আমল"),
      video("O8EoBGOrbxk", "০৪: ইংরেজ শাসন-০১"),
      video("IXgj2dwbDKE", "০৫: ইংরেজ শাসন-০২"),
      video("J6MMzthEsUM", "০৭: ১৯৪৭ থেকে ভাষা আন্দোলন"),
      video("JDyHCDoQxIk", "০৮: যুক্তফ্রন্ট থেকে সত্তরের নির্বাচন"),
      video("FL-eoPGYy8Y", "০৯: মুক্তিযুদ্ধ-০১"),
      video("3bOC2hfNgAw", "১০: মুক্তিযুদ্ধ-০২"),
      video("YGMzq_EdjTw", "১১: ইতিহাসের পাতা থেকে (১৯৭২ থেকে ২০২৪)"),
      video("v1PjqJmYFcI", "১৫: সংবিধান-০১"),
      video("pa-lvIw-_Jc", "১৬: সংবিধান-০২"),
      video("qo8bJtmmUrk", "১৭: সংবিধান-০৩"),
      video("xquKeUFi0Cw", "১৮: বাংলাদেশের সরকার ও রাজনৈতিক ব্যবস্থা"),
      video("qxPfgHZNG2o", "০৬: বাংলাদেশের অর্থনীতি"),
      video("tuZU1MjpDIc", "১২: বাংলাদেশের শিল্প ও বাণিজ্য"),
      video("2_s6wBLAByI", "১৪: বাংলাদেশের জনসংখ্যা"),
      video("2hNjm062OQU", "১৩: বাংলাদেশের কৃষিজ সম্পদ"),
    ],
  },
  {
    name: "General Science",
    color: "#0e7490",
    resourceFile: "General Science.pdf",
    topics: [
      video("uofN9iDZco4", "০১: পদার্থের অবস্থা ও গঠন"),
      video("L3iCR693BDY", "০২: পর্যায় সারণি ও জারণ-বিজারণ"),
      video("SAeUf7mSF7g", "০৩: জারণ-বিজারণ, তড়িৎ কোষ, এসিড-ক্ষারক-লবণ"),
      video("RC3Jvep7Rb0", "০৪: ধাতু, অধাতু ও জৈব রসায়ন ও প্রাত্যহিক জীবনে রসায়ন"),
      video("zweFwDVgdUw", "০৫: ভৌত বিজ্ঞানের বিকাশ ও বলবিদ্যা, মহাকর্ষ অভিকর্ষ, কাজ ক্ষমতা শক্তি"),
      video("XA0LCkztf-I", "০৬: তাপ ও শব্দ"),
      video("nJYWOdlhuqs", "০৭: তড়িৎ ও আলো"),
      video("ENrckZiGh6k", "০৮: চুম্বক, ইলেকট্রনিক্স, আধুনিক এবং বাস্তবজীবনে পদার্থবিজ্ঞান"),
      video("OeniCZg_bE8", "১০: জীববিজ্ঞানের ক্রমবিকাশ ও কোষ, কোষ বিভাজন, কলা, জিনতত্ত্ব"),
      video("Q2kJLYYRs5s", "১১: কোষ বিভাজন, কলা, জিনতত্ত্ব"),
      video("WZizSLKM8wk", "১২: অণুজীববিজ্ঞান, উদ্ভিদবিজ্ঞান ও প্রাণিবৈচিত্র্য"),
      video("_XicKhSMvGA", "১৩: মানবদেহ-১ ও ২"),
      video("CwxyC8RYnzc", "০৯: খাদ্য ও পুষ্টি"),
    ],
  },
  {
    name: "Computer & ICT",
    color: "#4338ca",
    resourceFile: "Computer & ICT.pdf",
    topics: [
      video("s8rl4xXYqNs", "01: Computer Architecture, Hardware & Software"),
      video("FvBxW8piRgI", "02: Memory, Software, OS"),
      video("RuS6pMJk1ao", "05: Numbering System"),
      video("KuzIFMQs544", "04: Logic Gate"),
      video("ATNb1Kj-mhc", "03: Computer Network"),
      video("l6CuHgQozaE", "06: Internet"),
      video("BgwCXDjZRa4", "07: Computer Programming"),
      video("Sz0zHDvu3ik", "08: ডেটাবেজ ও ডেটা কমিউনিকেশন"),
      video("EXP90w9VPG4", "09: Malware, Cyber Security"),
    ],
  },
  {
    name: "Geography",
    color: "#a16207",
    resourceFile: "Geography.pdf",
    topics: [
      video("xg4W1zyO5p8", "০১: মানচিত্র, কাল্পনিক রেখা ও মহাকাশ"),
      video("tBgCo-ENoPI", "০২: বাংলাদেশের অবস্থান, সম্পদ"),
      video("ZiG5Qssn9v8", "০৩: ভূ-অভ্যন্তরীণ গঠন ও উপাদান"),
      video("GL7Xbd9mPp8", "০৪: বায়ুমণ্ডল ও বাংলাদেশের নদনদী"),
      video("NmbzzshKzyk", "০৫: বারিমণ্ডল ও ভৌগোলিক অবস্থান"),
      video("xvoXQPTeG0Y", "০৬: আবহাওয়া ও জলবায়ু"),
      video("BYHr-Ct1YBk", "০৭: প্রাকৃতিক দুর্যোগ ও ব্যবস্থাপনা"),
    ],
  },
  {
    name: "Morality, Values & Good Governance",
    color: "#be123c",
    resourceFile: "MORALITY.pdf",
    topics: [
      video("Wf-8deXhONg", "০১: নৈতিকতা, সুশাসন ও মূল্যবোধ-১"),
      video("CewWS3jK6k0", "০২: নৈতিকতা, সুশাসন ও মূল্যবোধ-২"),
      video("5cP2lapoVSU", "০৩: নৈতিকতা, সুশাসন ও মূল্যবোধ-৩"),
      video("Ix_lgAuXj0I", "০৪: নৈতিকতা, সুশাসন ও মূল্যবোধ-৪"),
    ],
  },
  {
    name: "English Vocabulary",
    color: "#6d28d9",
    isDaily: true,
    resourceFile: "English Vocabulary.pdf",
    topics: [
      // 9 reference lectures, each behind ~8 word days (VOCAB_DAYS_PER_LECTURE).
      // The Parts 9–10 video serves the last two.
      ...VOCABULARY_LECTURES,
    ],
  },
];
