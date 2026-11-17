// BCS Preliminary lecture lists, transcribed from Doc/study-resource/*.pdf and
// merged into lectures following Doc/New Routine .pdf: one lecture per class of
// the routine, with the original videos kept as its parts. Subjects are in the
// default study order (hardest first). Vocabulary is studied every day alongside
// whichever subject is current.

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

export const BCS_SYLLABUS: readonly SyllabusSubject[] = [
  {
    name: "English Literature + Grammar",
    color: "#0f766e",
    resourceFile: "English Literature.pdf, English Grammer.pdf",
    topics: [
      lecture("Lit 01: Literary Terms", p("0Hnk9DWSzOA", "Lit 01: Literary Terms")),
      lecture(
        "Lit 02: Old & Middle English Period & Renaissance-1",
        p("HJeIq9E56WQ", "Lit 02: Old & Middle English Period & The Renaissance Period-1"),
      ),
      lecture("Lit 03: Renaissance-2", p("jySlpt-5IaI", "Lit 03: The Renaissance Period-2")),
      lecture("Lit 04: Renaissance-3", p("3ST-aTkCMA0", "Lit 04: The Renaissance Period-3")),
      lecture(
        "Lit 05: Neoclassical Period",
        p("4n0DztHRk6A", "Lit 05: The Neoclassical Period (1660-1798)"),
      ),
      lecture("Lit 06: Romantic Period", p("96PgkdjndR8", "Lit 06: The Romantic Period")),
      lecture("Lit 07: Victorian Period", p("AHL8C5Ai_T0", "Lit 07: The Victorian Period")),
      lecture("Lit 08: Modern Period", p("lzvquKoFkik", "Lit 08: Modern English Period")),
      lecture(
        "Lit 09: Post Modern Period",
        p("V_IBnyvm-7c", "Lit 09: Modern 2 + Post Modern Period"),
        p("sSReXI38Rao", "Lit 10: Post Modern Period (1939 – Present)"),
      ),
      lecture(
        "Grammar 01: Anatomy of English Sentence, Gerund, Participle",
        p("VPCPjHUP3FY", "Grammar 1.1: Basic & Gerund Participle (Part-1)"),
        p("3v6N-2270EU", "Grammar 1.2: Basic & Gerund Participle (Part-2)"),
      ),
      lecture(
        "Grammar 02: Identification of Phrase & Clause",
        p("OH5l0oodQcE", "Grammar 2: Identification of Phrases & Clauses"),
      ),
      lecture("Grammar 03: Determiner, Noun", p("_OK7XGKC1NY", "Grammar 3: Determiner, Noun")),
      lecture(
        "Grammar 04: Pronoun, Adjectives & Adverb",
        p("1Ngc1hzfU-g", "Grammar 4: Pronoun, Number, Gender"),
        p("2H9nSnDyUXw", "Grammar 5: Adjective & Adverb"),
      ),
      lecture("Grammar 05: Tense", p("7iwbfiR9E6A", "Grammar 8: Tense")),
      lecture("Grammar 06: Voice", p("yUtNoZIeZKU", "Grammar 9: Voice")),
      lecture("Grammar 07: Preposition-1", p("hy6-9-CqvRA", "Grammar 6: Preposition-1")),
      lecture("Grammar 08: Preposition-2", p("ZXUQtOyKF3Q", "Grammar 7: Preposition-2")),
      lecture(
        "Grammar 09: Verb & Right Form of Verb, Conditionals",
        p("kxHtrR8j6Hk", "Grammar 11: Verb & Right Form of Verb"),
        p("JRrq5s8m224", "Grammar 10: Conditionals"),
      ),
      lecture("Grammar 10: Correction", p("3a7vJKkT_ew", "Grammar 12: Correction")),
      lecture(
        "Grammar 11: Sentence & Conjunction",
        p("sHyvV5QRgN4", "Grammar 13: Conjunction & Sentence"),
      ),
      lecture("Grammar 12: Narration", p("-C4NokKPqUM", "Grammar 14: Narration")),
      lecture(
        "Grammar 13: Subject-Verb Agreement, Spelling",
        p("F7N2eGSWu9A", "Grammar 15: Subject-Verb Agreement"),
        p("bA1e5F6IrUg", "Grammar 17: Spelling"),
      ),
      lecture("Grammar 14: Phrasal Verb", p("gv5DEod87Wg", "Grammar 16: Phrasal Verb")),
      lecture("Grammar 15: Phrase & Idioms", p("Ygsv1dNXUMc", "Grammar 18: Phrase & Idioms")),
      lecture(
        "Grammar 16: One Word Substitute",
        p("jxT_wboecYg", "Grammar 19: One Word Substitute"),
      ),
    ],
  },
  {
    name: "Bangla Literature + Grammar",
    color: "#b45309",
    resourceFile: "Bangla Literature.pdf, Bangla Grammer.pdf",
    topics: [
      lecture("সাহিত্য ০১: প্রাচীন যুগ", p("3MEDGkWsojE", "সাহিত্য ০১: বাংলা সাহিত্যের প্রাচীন যুগ")),
      lecture("সাহিত্য ০২: মধ্যযুগ-১", p("LNIzTvOJuiQ", "সাহিত্য ০২: বাংলা সাহিত্যের মধ্যযুগ-০১")),
      lecture("সাহিত্য ০৩: মধ্যযুগ-২", p("KBJtADJOZbY", "সাহিত্য ০৩: বাংলা সাহিত্যের মধ্যযুগ-০২")),
      lecture("সাহিত্য ০৪: আধুনিক যুগ-১", p("WIah_OCRFug", "সাহিত্য ০৪: বাংলা সাহিত্যের আধুনিক যুগ-০১")),
      lecture("সাহিত্য ০৫: আধুনিক যুগ-২", p("Dxu3PGLE3YU", "সাহিত্য ০৫: বাংলা সাহিত্যের আধুনিক যুগ-০২")),
      lecture("সাহিত্য ০৬: আধুনিক যুগ-৩", p("mHbkSssv1cU", "সাহিত্য ০৬: বাংলা সাহিত্যের আধুনিক যুগ-০৩")),
      lecture("সাহিত্য ০৭: আধুনিক যুগ-৪", p("3bCucgMNlEs", "সাহিত্য ০৭: বাংলা সাহিত্যের আধুনিক যুগ-০৪")),
      lecture("সাহিত্য ০৮: আধুনিক যুগ-৫", p("lynsLCVa49Y", "সাহিত্য ০৮: বাংলা সাহিত্যের আধুনিক যুগ-০৫")),
      lecture("সাহিত্য ০৯: আধুনিক যুগ-৬", p("N8Brnh5adPA", "সাহিত্য ০৯: বাংলা সাহিত্যের আধুনিক যুগ-০৬")),
      lecture(
        "সাহিত্য ১০: আধুনিক যুগ-৭",
        p("pP2FI3ecjWg", "সাহিত্য ১০: বাংলা সাহিত্যের আধুনিক যুগ-০৭"),
        p("Zkcp030DkVU", "সাহিত্য ১১: বাংলা সাহিত্যের আধুনিক যুগ-০৮"),
      ),
      lecture(
        "সাহিত্য ১১: মুক্তিযুদ্ধ ও ভাষা আন্দোলন ভিত্তিক সাহিত্য, পত্র-পত্রিকা, উক্তি, ছদ্মনাম",
        p("pOjesiOjrOg", "সাহিত্য ১২: মুক্তিযুদ্ধ ও ভাষা আন্দোলন ভিত্তিক সাহিত্য"),
        p("_B9HydejT1I", "সাহিত্য ১৩: পত্র-পত্রিকা, উক্তি-পঙক্তি, ছদ্মনাম/উপাধি, বাংলা সাহিত্যে প্রথম"),
      ),
      lecture(
        "সাহিত্য ১২: প্রশ্ন সলভ সেশন",
        p("XfgsWKFcf1Q", "সাহিত্য ১৪: বাংলা সাহিত্যের প্রশ্ন সলভ সেশন-১"),
        p("-78zCJYlRe0", "সাহিত্য ১৫: বাংলা সাহিত্যের প্রশ্ন সলভ সেশন-২"),
        p("G6TsrfTLdtg", "সাহিত্য ১৬: বাংলা সাহিত্যের প্রশ্ন সলভ সেশন-৩"),
      ),
      lecture("ব্যাকরণ ০১: শব্দ-১", p("YDxBlXnmnFk", "ব্যাকরণ ০১: শব্দের শ্রেণিবিভাগ-১")),
      lecture("ব্যাকরণ ০২: শব্দ-২", p("ZV9jUV8eLVc", "ব্যাকরণ ০২: শব্দের শ্রেণিবিভাগ-২")),
      lecture("ব্যাকরণ ০৩: ধ্বনি ও বর্ণ", p("TMaVb4DCdR8", "ব্যাকরণ ০৩: ধ্বনি ও বর্ণ")),
      lecture("ব্যাকরণ ০৪: ধ্বনির পরিবর্তন", p("MQmbch2wPlc", "ব্যাকরণ ০৪: ধ্বনির পরিবর্তন")),
      lecture("ব্যাকরণ ০৫: সন্ধি", p("mckSn3PTz1s", "ব্যাকরণ ০৫: সন্ধি")),
      lecture(
        "ব্যাকরণ ০৬: সমার্থক শব্দ",
        p("g0Ya4rDssdM", "ব্যাকরণ ০৬: সমার্থক শব্দ ও প্রায় সমোচ্চারিত শব্দ"),
      ),
      lecture(
        "ব্যাকরণ ০৭: প্রকৃতি ও প্রত্যয়",
        p("-cO4FedbLo4", "ব্যাকরণ ০৭: প্রকৃতি প্রত্যয়-০১"),
        p("32mxc6QrlbE", "ব্যাকরণ ০৮: প্রকৃতি প্রত্যয়-০২"),
      ),
      lecture(
        "ব্যাকরণ ০৮: সমাস",
        p("1hScghIHL3o", "ব্যাকরণ ০৯: সমাস-১"),
        p("rz6xynJJU2I", "ব্যাকরণ ১০: সমাস-২"),
      ),
      lecture("ব্যাকরণ ০৯: পদ প্রকরণ", p("UKadfxMtH_Y", "ব্যাকরণ ১১: পদ প্রকরণ")),
      lecture("ব্যাকরণ ১০: বাক্য প্রকরণ", p("wqvDBPLEzZs", "ব্যাকরণ ১২: বাক্য প্রকরণ")),
      lecture("ব্যাকরণ ১১: বানান", p("ObtptlFOyQo", "ব্যাকরণ ১৩: বাংলা বানানের নিয়ম")),
      lecture(
        "ব্যাকরণ ১২: বাক্যশুদ্ধি, প্রয়োগ-অপপ্রয়োগ",
        p("ihb1aSVXL1U", "ব্যাকরণ ১৪: বাক্যশুদ্ধি, প্রয়োগ/অপপ্রয়োগ"),
      ),
      lecture("ব্যাকরণ ১৩: উপসর্গ", p("_zi31qMKiGM", "ব্যাকরণ ১৬: উপসর্গ ও অন্যান্য")),
      lecture("ব্যাকরণ ১৪: কারক", p("v6RgPiWcFCE", "ব্যাকরণ ১৫: কারক")),
    ],
  },
  {
    name: "Math + Mental Ability",
    color: "#1d4ed8",
    resourceFile: "Math.pdf, Mental Ability.pdf",
    topics: [
      lecture(
        "গণিত ০১: বাস্তব ও জটিল সংখ্যা",
        p("mb0LivRW6VY", "গণিত ০১: বাস্তব সংখ্যা ও জটিল সংখ্যা-১"),
        p("8VGwIt0Ckfo", "গণিত ০২: বাস্তব সংখ্যা ও জটিল সংখ্যা-২"),
      ),
      lecture(
        "গণিত ০২: বীজগাণিতিক রাশি ও উৎপাদকে বিশ্লেষণ",
        p("5UpwNWxVbF0", "গণিত ০৩: বীজগাণিতিক রাশি"),
        p("kJOzEWNynuk", "গণিত ১৬: উৎপাদকে বিশ্লেষণ ও দ্বিপদী বহুপদী"),
      ),
      lecture(
        "গণিত ০৩: সূচক ও লগারিদম",
        p("mmJa7zkb46M", "গণিত ০৪: সূচক"),
        p("w0jSXjeEECs", "গণিত ০৫: লগারিদম"),
      ),
      lecture("গণিত ০৪: সেট ও ফাংশন", p("LaW6W5a_JJY", "গণিত ০৬: সেট ও ফাংশন")),
      lecture(
        "গণিত ০৫: সমান্তর ও গুণোত্তর ধারা",
        p("4_94DVYTDwA", "গণিত ০৭: সমান্তর ধারা"),
        p("WOEBPqTbNho", "গণিত ০৮: গুণোত্তর ধারা"),
      ),
      lecture("গণিত ০৬: সমীকরণ", p("VjSCNlQYzcY", "গণিত ০৯: সমীকরণ")),
      lecture("গণিত ০৭: অসমতা", p("RZzQsF8YKb4", "গণিত ১০: অসমতা")),
      lecture(
        "গণিত ০৮: বিন্যাস",
        p("zvbO8TIqQKQ", "গণিত ১১: বিন্যাস (বেসিক)"),
        p("tWRjgw7nuZs", "গণিত ১২: বিন্যাস"),
      ),
      lecture("গণিত ০৯: সমাবেশ", p("gGIxk5j6N8E", "গণিত ১৩: সমাবেশ")),
      lecture(
        "গণিত ১০: সম্ভাব্যতা",
        p("iM-g58T_8Es", "গণিত ১৪: সম্ভাব্যতা-০১"),
        p("tZ-swAxcwxY", "গণিত ১৫: সম্ভাব্যতা-০২"),
      ),
      lecture(
        "গণিত ১১: ত্রিভুজ ও চতুর্ভুজ সংক্রান্ত উপপাদ্য",
        p("IrGUiQB9kiU", "গণিত ১৭: রেখা, কোণ ও ত্রিভুজ"),
        p("_0Gtk9DeO48", "গণিত ১৯: চতুর্ভুজ ও বহুভুজ"),
      ),
      lecture("গণিত ১২: পরিমিতি-১", p("3XghLgS3ztg", "গণিত ১৮: পরিমিতি")),
      lecture(
        "গণিত ১৩: পরিমিতি-২ (ঘনবস্তু) ও বৃত্ত",
        p("8Ti1H8xalGc", "গণিত ২০: পরিমিতি ঘনবস্তু + বৃত্তের বাকি অংশ"),
      ),
      lecture("গণিত ১৪: ত্রিকোণমিতি ও পরিসংখ্যান", p("dTizsozAKYY", "গণিত ২১: ত্রিকোণমিতি")),
      lecture("গণিত ১৫: শতকরা", p("zzpoetC-zW0", "গণিত ২২: শতকরা")),
      lecture("গণিত ১৬: লাভ-ক্ষতি", p("n5BoU0T4pTk", "গণিত ২৩: লাভ-ক্ষতি")),
      lecture(
        "গণিত ১৭: সরল ও যৌগিক মুনাফা, ভেনচিত্র",
        p("2EfpQaEz3PI", "গণিত ২৪: সরল মুনাফা"),
        p("Bp_l-24bGQk", "গণিত ২৮: যৌগিক মুনাফা ও ভেনচিত্র"),
      ),
      lecture("গণিত ১৮: লসাগু-গসাগু", p("ffge4WrjsBc", "গণিত ২৫: লসাগু-গসাগু")),
      lecture(
        "গণিত ১৯: অনুপাত-সমানুপাত ও ঐকিক নিয়ম",
        p("Omst_LeJfyU", "গণিত ২৬: অনুপাত ও সমানুপাত"),
        p("aaE5q0yYQ5w", "গণিত ২৭: ঐকিক নিয়ম"),
      ),
      lecture(
        "মানসিক দক্ষতা ০১: ঘড়ি ও সময়",
        p("ivEOLg6XAMU", "মানসিক দক্ষতা ০১: ঘড়ি সংক্রান্ত সমস্যাবলি"),
      ),
      lecture(
        "মানসিক দক্ষতা ০২: দিন, তারিখ ও বার নির্ণয়",
        p("9Aj7Isj5oTQ", "মানসিক দক্ষতা ০২: বার নির্ণয়"),
      ),
      lecture(
        "মানসিক দক্ষতা ০৩: অবস্থান নির্ণয় ও যান্ত্রিক দক্ষতা",
        p("SrAIFRJi9z8", "মানসিক দক্ষতা ০৩: অবস্থান নির্ণয়"),
        p("3bUHUAgLnQs", "মানসিক দক্ষতা ০৪: যান্ত্রিক দক্ষতা"),
      ),
      lecture(
        "মানসিক দক্ষতা ০৪: ভাষাগত যৌক্তিক বিচার",
        p("8pIiWmn1e2A", "মানসিক দক্ষতা ০৭: ভাষাগত যৌক্তিক বিচার"),
      ),
      lecture(
        "মানসিক দক্ষতা ০৫: সংখ্যাগত দক্ষতা, ত্রিভুজ ও চতুর্ভুজ গণনা",
        p("ae3YghvAuOc", "মানসিক দক্ষতা ০৫: সংখ্যাগত দক্ষতা"),
        p("8JdTq_OHu2g", "মানসিক দক্ষতা ০৬: ত্রিভুজ ও চতুর্ভুজ গণনা"),
      ),
    ],
  },
  {
    name: "International Affairs",
    color: "#7c2d12",
    resourceFile: "International Affairs.pdf",
    topics: [
      lecture(
        "০১: আন্তর্জাতিক বিষয়াবলি প্রস্তুতি, বিশ্ব রাজনীতি ও অর্থনীতির মৌলিক ধারণা",
        p("n-EZQgRfH3Q", "০১: আন্তর্জাতিক বিষয়াবলি প্রস্তুতি, বিশ্ব রাজনীতি ও অর্থনীতির মৌলিক ধারণা"),
      ),
      lecture("০২: বৈশ্বিক ইতিহাস-১", p("5kA81VhM1xM", "০২: বৈশ্বিক ইতিহাস-০১")),
      lecture("০৩: বৈশ্বিক ইতিহাস-২", p("1dHoXCu5Jtc", "০৩: বৈশ্বিক ইতিহাস-০২")),
      lecture(
        "০৪: বৈশ্বিক ইতিহাস-৩ ও জাতিসংঘ-১",
        p("1tDAVmb_n40", "০৪: বৈশ্বিক ইতিহাস-০৩ এবং জাতিসংঘ-০১"),
      ),
      lecture("০৫: জাতিসংঘ-২", p("vi14W_OVxPo", "০৫: জাতিসংঘ-০২")),
      lecture("০৬: এশিয়া-১", p("Eh-KhCc-3Qs", "০৬: এশিয়া-০১")),
      lecture("০৭: এশিয়া-২", p("QamT15U_34U", "০৭: এশিয়া-০২"), p("zZGQxzXiOOM", "০৮: এশিয়া-০৩")),
      lecture(
        "০৮: ইউরোপ, আমেরিকা, আফ্রিকা ও ওশেনিয়া",
        p("hLmGul4wGrA", "০৯: আমেরিকা, আফ্রিকা ও ওশেনিয়া"),
      ),
      lecture("০৯: পরিবেশ", p("lrTh9I8vI8k", "১০: পরিবেশ")),
      lecture(
        "১০: আন্তর্জাতিক নিরাপত্তা",
        p("TVcstHy188k", "১২: আন্তর্জাতিক নিরাপত্তা-০১"),
        p("eacuvZPNpXI", "১৩: আন্তর্জাতিক নিরাপত্তা-০২"),
      ),
      lecture(
        "১১: আন্তঃরাষ্ট্রীয় ক্ষমতা সম্পর্ক ও কূটনীতি",
        p("6sPJC45-EmQ", "১১: আন্তরাষ্ট্রীয় ক্ষমতা সম্পর্ক ও কূটনীতি"),
      ),
      lecture(
        "১২: আন্তর্জাতিক সংগঠন ও জোট-১",
        p("Tdm0tUsYrbg", "14: International Organization-1"),
        p("K2UzRoq4B5s", "15: International Organization-2"),
      ),
      lecture("১৩: আন্তর্জাতিক সংগঠন ও জোট-২", p("pBdQu5Wofzs", "16: International Organization-3")),
    ],
  },
  {
    name: "Bangladesh Affairs",
    color: "#15803d",
    resourceFile: "Bangladesh Affairs.pdf",
    topics: [
      lecture("০১: প্রাচীন জনপদ এবং গুরুত্বপূর্ণ স্থাপত্য", p("aPRn2R0IGeI", "০১: বাঙলার প্রাচীন ইতিহাস")),
      lecture(
        "০২: মুসলমানদের আগমন ও সুলতানি আমল",
        p("USMBuA57PyM", "০২: গুরুত্বপূর্ণ স্থাপত্য, পর্যটক ও মুসলমানদের আগমন"),
      ),
      lecture("০৩: মোগল আমল", p("9IaLRm5oZYo", "০৩: মোগল আমল")),
      lecture(
        "০৪: ইংরেজ শাসন",
        p("O8EoBGOrbxk", "০৪: ইংরেজ শাসন-০১"),
        p("IXgj2dwbDKE", "০৫: ইংরেজ শাসন-০২"),
      ),
      lecture("০৫: ১৯৪৭ থেকে ভাষা আন্দোলন", p("J6MMzthEsUM", "০৭: ১৯৪৭ থেকে ভাষা আন্দোলন")),
      lecture(
        "০৬: যুক্তফ্রন্ট থেকে সত্তরের নির্বাচন ও ২৬ মার্চ",
        p("JDyHCDoQxIk", "০৮: যুক্তফ্রন্ট থেকে সত্তরের নির্বাচন"),
      ),
      lecture("০৭: মুক্তিযুদ্ধ-১", p("FL-eoPGYy8Y", "০৯: মুক্তিযুদ্ধ-০১")),
      lecture("০৮: মুক্তিযুদ্ধ-২", p("3bOC2hfNgAw", "১০: মুক্তিযুদ্ধ-০২")),
      lecture("০৯: ১৯৭২ থেকে শাসনামল", p("YGMzq_EdjTw", "১১: ইতিহাসের পাতা থেকে (১৯৭২ থেকে ২০২৪)")),
      lecture("১০: সংবিধান-১", p("v1PjqJmYFcI", "১৫: সংবিধান-০১")),
      lecture(
        "১১: সংবিধান-২",
        p("pa-lvIw-_Jc", "১৬: সংবিধান-০২"),
        p("qo8bJtmmUrk", "১৭: সংবিধান-০৩"),
      ),
      lecture(
        "১২: বাংলাদেশের সরকার ব্যবস্থা",
        p("xquKeUFi0Cw", "১৮: বাংলাদেশের সরকার ও রাজনৈতিক ব্যবস্থা"),
      ),
      lecture("১৩: অর্থনীতি", p("qxPfgHZNG2o", "০৬: বাংলাদেশের অর্থনীতি")),
      lecture("১৪: শিল্প ও বাণিজ্য", p("tuZU1MjpDIc", "১২: বাংলাদেশের শিল্প ও বাণিজ্য")),
      lecture("১৫: বাংলাদেশের জনসংখ্যা", p("2_s6wBLAByI", "১৪: বাংলাদেশের জনসংখ্যা")),
      lecture("১৬: বাংলাদেশের কৃষিজ সম্পদ", p("2hNjm062OQU", "১৩: বাংলাদেশের কৃষিজ সম্পদ")),
    ],
  },
  {
    name: "General Science",
    color: "#0e7490",
    resourceFile: "General Science.pdf",
    topics: [
      lecture("০১: পদার্থের অবস্থা ও গঠন", p("uofN9iDZco4", "০১: পদার্থের অবস্থা ও গঠন")),
      lecture("০২: পর্যায় সারণি ও জারণ-বিজারণ", p("L3iCR693BDY", "০২: পর্যায় সারণি ও জারণ-বিজারণ")),
      lecture(
        "০৩: জারণ-বিজারণ, তড়িৎ কোষ, এসিড-ক্ষারক-লবণ",
        p("SAeUf7mSF7g", "০৩: জারণ-বিজারণ, তড়িৎ কোষ, এসিড-ক্ষারক-লবণ"),
      ),
      lecture(
        "০৪: ধাতু, অধাতু ও জৈব রসায়ন ও প্রাত্যহিক জীবনে রসায়ন",
        p("RC3Jvep7Rb0", "০৪: ধাতু, অধাতু ও জৈব রসায়ন ও প্রাত্যহিক জীবনে রসায়ন"),
      ),
      lecture(
        "০৫: ভৌত বিজ্ঞানের বিকাশ ও বলবিদ্যা, মহাকর্ষ অভিকর্ষ, কাজ ক্ষমতা শক্তি",
        p("zweFwDVgdUw", "০৫: ভৌত বিজ্ঞানের বিকাশ ও বলবিদ্যা, মহাকর্ষ অভিকর্ষ, কাজ ক্ষমতা শক্তি"),
      ),
      lecture("০৬: তাপ ও শব্দ", p("XA0LCkztf-I", "০৬: তাপ ও শব্দ")),
      lecture("০৭: তড়িৎ ও আলো", p("nJYWOdlhuqs", "০৭: তড়িৎ ও আলো")),
      lecture(
        "০৮: চুম্বক, ইলেকট্রনিক্স, আধুনিক এবং বাস্তবজীবনে পদার্থবিজ্ঞান",
        p("ENrckZiGh6k", "০৮: চুম্বক, ইলেকট্রনিক্স, আধুনিক এবং বাস্তবজীবনে পদার্থবিজ্ঞান"),
      ),
      lecture("০৯: খাদ্য ও পুষ্টি", p("CwxyC8RYnzc", "০৯: খাদ্য ও পুষ্টি")),
      lecture(
        "১০: জীববিজ্ঞানের ক্রমবিকাশ ও কোষ, কোষ বিভাজন, কলা, জিনতত্ত্ব",
        p("OeniCZg_bE8", "১০: জীববিজ্ঞানের ক্রমবিকাশ ও কোষ, কোষ বিভাজন, কলা, জিনতত্ত্ব"),
        p("Q2kJLYYRs5s", "১১: কোষ বিভাজন, কলা, জিনতত্ত্ব"),
      ),
      lecture(
        "১১: অণুজীববিজ্ঞান, উদ্ভিদবিজ্ঞান ও প্রাণিবৈচিত্র্য",
        p("WZizSLKM8wk", "১২: অণুজীববিজ্ঞান, উদ্ভিদবিজ্ঞান ও প্রাণিবৈচিত্র্য"),
      ),
      lecture("১২: মানবদেহ-১ ও ২", p("_XicKhSMvGA", "১৩: মানবদেহ-১ ও ২")),
    ],
  },
  {
    name: "Computer & ICT",
    color: "#4338ca",
    resourceFile: "Computer & ICT.pdf",
    topics: [
      lecture(
        "01: Computer Architecture, Hardware",
        p("s8rl4xXYqNs", "01: Computer Architecture, Hardware & Software"),
      ),
      lecture("02: Memory, Software & OS", p("FvBxW8piRgI", "02: Memory, Software, OS")),
      lecture(
        "03: Number System, Logic Gate",
        p("RuS6pMJk1ao", "05: Numbering System"),
        p("KuzIFMQs544", "04: Logic Gate"),
      ),
      lecture("04: Computer Network", p("ATNb1Kj-mhc", "03: Computer Network")),
      lecture(
        "05: Internet, Computer Programming",
        p("l6CuHgQozaE", "06: Internet"),
        p("BgwCXDjZRa4", "07: Computer Programming"),
      ),
      lecture(
        "06: Database Management & Data Communication",
        p("Sz0zHDvu3ik", "08: ডেটাবেজ ও ডেটা কমিউনিকেশন"),
      ),
      lecture(
        "07: Website, Cloud Computing, Malware & Security",
        p("EXP90w9VPG4", "09: Malware, Cyber Security"),
      ),
    ],
  },
  {
    name: "Geography",
    color: "#a16207",
    resourceFile: "Geography.pdf",
    topics: [
      lecture(
        "০১: মানচিত্র, কাল্পনিক রেখা ও মহাকাশ",
        p("xg4W1zyO5p8", "০১: মানচিত্র, কাল্পনিক রেখা ও মহাকাশ"),
      ),
      lecture("০২: বাংলাদেশের অবস্থান, সম্পদ", p("tBgCo-ENoPI", "০২: বাংলাদেশের অবস্থান, সম্পদ")),
      lecture("০৩: ভূ-অভ্যন্তরীণ গঠন ও উপাদান", p("ZiG5Qssn9v8", "০৩: ভূ-অভ্যন্তরীণ গঠন ও উপাদান")),
      lecture("০৪: বায়ুমণ্ডল ও বাংলাদেশের নদনদী", p("GL7Xbd9mPp8", "০৪: বায়ুমণ্ডল ও বাংলাদেশের নদনদী")),
      lecture("০৫: বারিমণ্ডল ও ভৌগোলিক অবস্থান", p("NmbzzshKzyk", "০৫: বারিমণ্ডল ও ভৌগোলিক অবস্থান")),
      lecture("০৬: আবহাওয়া ও জলবায়ু", p("xvoXQPTeG0Y", "০৬: আবহাওয়া ও জলবায়ু")),
      lecture("০৭: প্রাকৃতিক দুর্যোগ ও ব্যবস্থাপনা", p("BYHr-Ct1YBk", "০৭: প্রাকৃতিক দুর্যোগ ও ব্যবস্থাপনা")),
    ],
  },
  {
    name: "Morality, Values & Good Governance",
    color: "#be123c",
    resourceFile: "MORALITY.pdf",
    topics: [
      lecture("০১: নৈতিকতা, সুশাসন ও মূল্যবোধ-১", p("Wf-8deXhONg", "০১: নৈতিকতা, সুশাসন ও মূল্যবোধ-১")),
      lecture("০২: নৈতিকতা, সুশাসন ও মূল্যবোধ-২", p("CewWS3jK6k0", "০২: নৈতিকতা, সুশাসন ও মূল্যবোধ-২")),
      lecture("০৩: নৈতিকতা, সুশাসন ও মূল্যবোধ-৩", p("5cP2lapoVSU", "০৩: নৈতিকতা, সুশাসন ও মূল্যবোধ-৩")),
      lecture("০৪: নৈতিকতা, সুশাসন ও মূল্যবোধ-৪", p("Ix_lgAuXj0I", "০৪: নৈতিকতা, সুশাসন ও মূল্যবোধ-৪")),
    ],
  },
  {
    name: "English Vocabulary",
    color: "#6d28d9",
    isDaily: true,
    resourceFile: "English Vocabulary.pdf",
    topics: [
      lecture(
        "Vocabulary Marathon-1",
        p("7EP3Cj57e40", "Vocabulary 1.1 (Part-1)"),
        p("hvpk_oIWbJ4", "Vocabulary 1.2 (Part-2)"),
        p("BZKtfHocHG8", "Vocabulary 1.4 (Part-4)"),
        p("VqSA1hiRntI", "Vocabulary 1.5 (Part-5)"),
      ),
      lecture(
        "Vocabulary Marathon-2",
        p("pdN5s923iyU", "Vocabulary 1.6 (Part-6)"),
        p("bwQqFtvv6Nc", "Vocabulary 1.7 (Part-7)"),
        p("F2yLe0oakwg", "Vocabulary 1.8 (Part-8)"),
        p("w3FhXmMPjhE", "Vocabulary 1.9 (Parts 9–10)"),
      ),
    ],
  },
];
