/**
 * Lecture books: for each lecture, the pages of its subject's book that cover
 * it. The books themselves are paid material, so they never enter the repo:
 * `pnpm books:upload` slices them locally (Doc/study-resource, git-ignored)
 * into one compressed PDF per lecture and uploads those to the private
 * `lecture-books` Supabase Storage bucket, read through signed links only.
 *
 * Page numbers are PDF pages (not the book's printed numbers). Books are
 * split by chapter, not by lecture, so a lecture spread over several videos
 * of one chapter (e.g. Preposition-1 and -2) gets the whole chapter.
 */

export type LectureBook = {
  /** Source PDF in Doc/study-resource. */
  file: string;
  /** Folder in the bucket. */
  folder: string;
  /** Short name shown on the link. */
  name: string;
  /** Pages in the PDF. */
  pages: number;
};

export type BookSlice = {
  book: LectureBook;
  /** PDF page ranges, e.g. "71-78,133-142". */
  pages: string;
  /** Book chapters covered, shown as the link's tooltip. */
  chapters: string;
  /** File name in the bucket, for titles that do not slug (Bengali). */
  slug?: string;
};

export const LECTURE_BOOKS_BUCKET = "lecture-books";

const ENGLISH: LectureBook = {
  file: "লেকচার বুক - English Grammar & Literature.pdf",
  folder: "english",
  name: "English Grammar & Literature",
  pages: 276,
};

/**
 * PDF page = printed page + 5 from printed page 4 on (printed page 3 was
 * scanned twice, PDF 7 and 8); printed pages 1-2 are PDF 5-6.
 */
const BANGLA: LectureBook = {
  file: "লেকচার বুক - বাংলা ভাষা ও সাহিত্য .pdf",
  folder: "bangla",
  name: "বাংলা ভাষা ও সাহিত্য",
  pages: 279,
};

/** PDF page = printed page + 5 throughout. */
const MATH: LectureBook = {
  file: "লেকচার বুক - গনিত ও মানসিক দক্ষতা.pdf",
  folder: "math",
  name: "গাণিতিক যুক্তি ও মানসিক দক্ষতা",
  pages: 153,
};

const slice = (book: LectureBook, pages: string, chapters: string, slug?: string): BookSlice => ({
  book,
  pages,
  chapters,
  slug,
});

const sahitya = (n: string, pages: string, chapters: string) =>
  slice(BANGLA, pages, chapters, `sahitya-${n}`);
const byakoron = (n: string, pages: string, chapters: string) =>
  slice(BANGLA, pages, chapters, `byakoron-${n}`);

/**
 * Bangla lecture book. The literature writers (আধুনিক যুগ ০৫–১১) follow the
 * book's order, grouped as in the Bangla literature question bank. The
 * প্রশ্ন সলভ সেশন lectures (সাহিত্য ১৪–১৬) have no chapter of their own.
 */
const BANGLA_SLICES: Record<string, BookSlice> = {
  "সাহিত্য ০১: বাংলা সাহিত্যের প্রাচীন যুগ": sahitya("01", "160-174", "সাহিত্যধারার সংজ্ঞা, প্রাচীন যুগ"),
  "সাহিত্য ০২: বাংলা সাহিত্যের মধ্যযুগ-০১": sahitya(
    "02",
    "174-188",
    "অন্ধকার যুগ, শ্রীকৃষ্ণকীর্তন, মঙ্গলকাব্য, বৈষ্ণব সাহিত্য, অনুবাদ সাহিত্য",
  ),
  "সাহিত্য ০৩: বাংলা সাহিত্যের মধ্যযুগ-০২": sahitya(
    "03",
    "188-201",
    "রোমান্টিক প্রণয়োপাখ্যান, আরাকান রাজসভা, লোক ও পুথি সাহিত্য, কবিওয়ালা, যুগসন্ধিক্ষণ",
  ),
  "সাহিত্য ০৪: বাংলা সাহিত্যের আধুনিক যুগ-০১": sahitya(
    "04",
    "201-210",
    "আধুনিক যুগ, ঈশ্বরচন্দ্র বিদ্যাসাগর, বঙ্কিমচন্দ্র",
  ),
  "সাহিত্য ০৫: বাংলা সাহিত্যের আধুনিক যুগ-০২": sahitya(
    "05",
    "210-218",
    "মধুসূদন, দীনবন্ধু, মীর মশাররফ, কায়কোবাদ, রোকেয়া, জসীম উদ্‌দীন, ফররুখ আহমদ",
  ),
  "সাহিত্য ০৬: বাংলা সাহিত্যের আধুনিক যুগ-০৩": sahitya(
    "06",
    "218-227",
    "রবীন্দ্রনাথ ঠাকুর, কাজী নজরুল ইসলাম",
  ),
  "সাহিত্য ০৭: বাংলা সাহিত্যের আধুনিক যুগ-০৪": sahitya(
    "07",
    "227-233",
    "ত্রিশোত্তর সাহিত্য ও পঞ্চপাণ্ডব, তিন বন্দ্যোপাধ্যায়",
  ),
  "সাহিত্য ০৮: বাংলা সাহিত্যের আধুনিক যুগ-০৫": sahitya(
    "08",
    "233-245",
    "অন্যান্য সাহিত্যিক: আখতারুজ্জামান ইলিয়াস থেকে আহমদ ছফা",
  ),
  "সাহিত্য ০৯: বাংলা সাহিত্যের আধুনিক যুগ-০৬": sahitya(
    "09",
    "245-251",
    "অন্যান্য সাহিত্যিক: আহমদ শরীফ থেকে আবুল মনসুর আহমদ",
  ),
  "সাহিত্য ১০: বাংলা সাহিত্যের আধুনিক যুগ-০৭": sahitya(
    "10",
    "251-258",
    "অন্যান্য সাহিত্যিক: হুমায়ুন কবির থেকে সৈয়দ ইসমাইল হোসেন সিরাজী",
  ),
  "সাহিত্য ১১: বাংলা সাহিত্যের আধুনিক যুগ-০৮": sahitya(
    "11",
    "258-264",
    "অন্যান্য সাহিত্যিক: সুকুমার রায় থেকে মোতাহের হোসেন চৌধুরী",
  ),
  "সাহিত্য ১২: মুক্তিযুদ্ধ ও ভাষা আন্দোলন ভিত্তিক সাহিত্য": sahitya(
    "12",
    "268-272",
    "মুক্তিযুদ্ধ ও ভাষা আন্দোলন ভিত্তিক সাহিত্য",
  ),
  "সাহিত্য ১৩: পত্র-পত্রিকা, উক্তি-পঙক্তি, ছদ্মনাম/উপাধি, বাংলা সাহিত্যে প্রথম": sahitya(
    "13",
    "264-268,272-279",
    "পত্র পত্রিকা, পঙ্‌ক্তি ও উদ্ধৃতি, চরিত্র, বিচিত্র তথ্য, প্রথম, ছদ্মনাম ও উপাধি",
  ),
  "ব্যাকরণ ০১: শব্দের শ্রেণিবিভাগ-১": byakoron("01", "5-16", "ভাষা, শব্দের শ্রেণিবিভাগ"),
  "ব্যাকরণ ০২: শব্দের শ্রেণিবিভাগ-২": byakoron("02", "11-17", "শব্দের শ্রেণিবিভাগ, পুরুষ ও স্ত্রীবাচক শব্দ"),
  "ব্যাকরণ ০৩: ধ্বনি ও বর্ণ": byakoron("03", "17-23", "ধ্বনি ও বর্ণ, বর্ণের উচ্চারণ, ণ-ত্ব ও ষ-ত্ব বিধি"),
  "ব্যাকরণ ০৪: ধ্বনির পরিবর্তন": byakoron("04", "23-27", "ধ্বনির পরিবর্তন"),
  "ব্যাকরণ ০৫: সন্ধি": byakoron("05", "31-38", "সন্ধি"),
  "ব্যাকরণ ০৬: সমার্থক শব্দ ও প্রায় সমোচ্চারিত শব্দ": byakoron(
    "06",
    "114-121",
    "সমার্থক শব্দ, প্রায় সমোচ্চারিত শব্দ",
  ),
  "ব্যাকরণ ০৭: প্রকৃতি প্রত্যয়-০১": byakoron("07", "38-51", "ধাতু ও ধাতুর গণ, প্রকৃতি-প্রত্যয়"),
  "ব্যাকরণ ০৮: প্রকৃতি প্রত্যয়-০২": byakoron("08", "41-51", "প্রকৃতি-প্রত্যয়"),
  "ব্যাকরণ ০৯: সমাস-১": byakoron("09", "51-65", "সমাস"),
  "ব্যাকরণ ১০: সমাস-২": byakoron("10", "51-65", "সমাস"),
  "ব্যাকরণ ১১: পদ প্রকরণ": byakoron("11", "65-76", "পদ প্রকরণ, পদ পরিবর্তন, ক্রিয়ার কাল"),
  "ব্যাকরণ ১২: বাক্য প্রকরণ": byakoron("12", "76-84", "বাক্য ও বাক্য প্রকরণ"),
  "ব্যাকরণ ১৩: বাংলা বানানের নিয়ম": byakoron(
    "13",
    "22-23,84-99",
    "ণ-ত্ব ও ষ-ত্ব বিধি, বানান শুদ্ধি ও প্রয়োগ-অপপ্রয়োগ",
  ),
  "ব্যাকরণ ১৪: বাক্যশুদ্ধি, প্রয়োগ/অপপ্রয়োগ": byakoron("14", "84-99", "বানান শুদ্ধি ও প্রয়োগ-অপপ্রয়োগ"),
  "ব্যাকরণ ১৫: কারক": byakoron("15", "99-105", "কারক"),
  "ব্যাকরণ ১৬: উপসর্গ ও অন্যান্য": byakoron(
    "16",
    "27-31,105-114,121-160",
    "উপসর্গ, অনুসর্গ, দ্বিরুক্ত শব্দ, বচন, বাচ্য, পুরুষ, উক্তি, যতি চিহ্ন, বাগধারা, বিপরীতার্থক শব্দ, এক কথায় প্রকাশ, পারিভাষিক শব্দ",
  ),
};

const gonit = (n: string, pages: string, chapters: string) =>
  slice(MATH, pages, chapters, `gonit-${n}`);
const manoshik = (n: string, pages: string, chapters: string) =>
  slice(MATH, pages, chapters, `manoshik-${n}`);

/**
 * Math + Mental Ability lecture book. Chapters without a lecture of their own
 * go where the question bank put them: পরিসংখ্যান with সম্ভাব্যতা-০২,
 * স্থানাংক জ্যামিতি with রেখা-কোণ-ত্রিভুজ, ভেনচিত্র with যৌগিক মুনাফা.
 */
const MATH_SLICES: Record<string, BookSlice> = {
  "গণিত ০১: বাস্তব সংখ্যা ও জটিল সংখ্যা-১": gonit("01", "6-11", "বাস্তব সংখ্যা"),
  "গণিত ০২: বাস্তব সংখ্যা ও জটিল সংখ্যা-২": gonit("02", "6-12", "বাস্তব সংখ্যা, জটিল সংখ্যা"),
  "গণিত ০৩: বীজগাণিতিক রাশি": gonit("03", "12-18", "বীজগাণিতিক রাশি"),
  "গণিত ০৪: সূচক": gonit("04", "29-34", "সূচক"),
  "গণিত ০৫: লগারিদম": gonit("05", "34-38", "লগারিদম"),
  "গণিত ০৬: সেট ও ফাংশন": gonit("06", "18-23", "সেট ও ফাংশন"),
  "গণিত ০৭: সমান্তর ধারা": gonit("07", "52-55", "সমান্তর ধারা"),
  "গণিত ০৮: গুণোত্তর ধারা": gonit("08", "55-58", "গুণোত্তর ধারা"),
  "গণিত ০৯: সমীকরণ": gonit("09", "38-46", "সরল সহসমীকরণ, বহুপদী ও দ্বিঘাত সমীকরণ"),
  "গণিত ১০: অসমতা": gonit("10", "46-52", "অসমতা"),
  "গণিত ১১: বিন্যাস (বেসিক)": gonit("11", "58-64", "বিন্যাস"),
  "গণিত ১২: বিন্যাস": gonit("12", "58-64", "বিন্যাস"),
  "গণিত ১৩: সমাবেশ": gonit("13", "64-67", "সমাবেশ"),
  "গণিত ১৪: সম্ভাব্যতা-০১": gonit("14", "67-74", "সম্ভাব্যতা"),
  "গণিত ১৫: সম্ভাব্যতা-০২": gonit("15", "67-74,79-82", "সম্ভাব্যতা, পরিসংখ্যান"),
  "গণিত ১৬: উৎপাদকে বিশ্লেষণ ও দ্বিপদী বহুপদী": gonit(
    "16",
    "43-46,76-79",
    "বহুপদী ও দ্বিঘাত সমীকরণ, দ্বিপদী বিস্তৃতি",
  ),
  "গণিত ১৭: রেখা, কোণ ও ত্রিভুজ": gonit(
    "17",
    "74-76,110-114",
    "স্থানাংক জ্যামিতি, ত্রিভুজ সংক্রান্ত উপপাদ্য",
  ),
  "গণিত ১৮: পরিমিতি": gonit("18", "115-121", "বৃত্ত, পরিমিতি (ত্রিভুজ, চতুর্ভুজ ও বহুভুজ)"),
  "গণিত ১৯: চতুর্ভুজ ও বহুভুজ": gonit(
    "19",
    "114-115,121-125",
    "চতুর্ভুজ সংক্রান্ত উপপাদ্য, পরিমিতি (চতুর্ভুজ ও বহুভুজ)",
  ),
  "গণিত ২০: পরিমিতি ঘনবস্তু + বৃত্তের বাকি অংশ": gonit("20", "115-118,125-128", "বৃত্ত, পরিমিতি (ঘনবস্তু)"),
  "গণিত ২১: ত্রিকোণমিতি": gonit("21", "128-132", "ত্রিকোণমিতি"),
  "গণিত ২২: শতকরা": gonit("22", "82-88", "শতকরা"),
  "গণিত ২৩: লাভ-ক্ষতি": gonit("23", "88-92", "লাভ-ক্ষতি"),
  "গণিত ২৪: সরল মুনাফা": gonit("24", "92-96", "সরল মুনাফা"),
  "গণিত ২৫: লসাগু-গসাগু": gonit("25", "97-101", "লসাগু ও গসাগু"),
  "গণিত ২৬: অনুপাত ও সমানুপাত": gonit("26", "101-105", "অনুপাত ও সমানুপাত"),
  "গণিত ২৭: ঐকিক নিয়ম": gonit("27", "105-110", "ঐকিক নিয়ম"),
  "গণিত ২৮: যৌগিক মুনাফা ও ভেনচিত্র": gonit("28", "23-29,96-97", "ভেনচিত্র, যৌগিক মুনাফা"),
  "মানসিক দক্ষতা ০১: ঘড়ি সংক্রান্ত সমস্যাবলি": manoshik("01", "132-133", "ঘড়ি ও সময়"),
  "মানসিক দক্ষতা ০২: বার নির্ণয়": manoshik("02", "133-134", "দিন, তারিখ ও বার নির্ণয়"),
  "মানসিক দক্ষতা ০৩: অবস্থান নির্ণয়": manoshik("03", "134-137", "অবস্থান নির্ণয়"),
  "মানসিক দক্ষতা ০৪: যান্ত্রিক দক্ষতা": manoshik("04", "145-148", "যান্ত্রিক দক্ষতা"),
  "মানসিক দক্ষতা ০৫: সংখ্যাগত দক্ষতা": manoshik("05", "137-141", "সংখ্যাগত দক্ষতা, ধারা"),
  "মানসিক দক্ষতা ০৬: ত্রিভুজ ও চতুর্ভুজ গণনা": manoshik("06", "148-153", "ত্রিভুজ গণনা, চতুর্ভুজ গণনা"),
  "মানসিক দক্ষতা ০৭: ভাষাগত যৌক্তিক বিচার": manoshik("07", "141-145", "ভাষাগত যৌক্তিক বিচার"),
};

/** By lecture title, as in BCS_SYLLABUS. */
export const LECTURE_BOOK_SLICES: Readonly<Record<string, BookSlice>> = {
  "Lit 01: Literary Terms": slice(ENGLISH, "171-179", "Figure of Speech and Literary Terms"),
  "Lit 02: Old & Middle English Period & The Renaissance Period-1": slice(
    ENGLISH,
    "179-211",
    "Periods of English literature, Old and Middle English, the Renaissance",
  ),
  "Lit 03: The Renaissance Period-2": slice(
    ENGLISH,
    "183-211",
    "The Renaissance: Elizabethan, Jacobean, Caroline, Commonwealth",
  ),
  "Lit 04: The Renaissance Period-3": slice(
    ENGLISH,
    "183-211",
    "The Renaissance: Elizabethan, Jacobean, Caroline, Commonwealth",
  ),
  "Lit 05: The Neoclassical Period (1660-1798)": slice(
    ENGLISH,
    "210-220",
    "Neoclassical: Restoration, Augustan, Age of Sensibility",
  ),
  "Lit 06: The Romantic Period": slice(ENGLISH, "220-231", "The Romantic Period"),
  "Lit 07: The Victorian Period": slice(ENGLISH, "231-244", "The Victorian Period"),
  "Lit 08: Modern English Period": slice(ENGLISH, "244-253", "The Modern Period"),
  "Lit 09: Modern 2 + Post Modern Period": slice(
    ENGLISH,
    "253-268",
    "The Georgian Period, Post Modern Period",
  ),
  "Lit 10: Post Modern Period (1939 – Present)": slice(
    ENGLISH,
    "262-276",
    "Post Modern Period, Confusion, Quotations, writers of different countries",
  ),
  "Grammar 1.1: Basic & Gerund Participle (Part-1)": slice(
    ENGLISH,
    "5-18",
    "Basics of English Grammar",
  ),
  "Grammar 1.2: Basic & Gerund Participle (Part-2)": slice(
    ENGLISH,
    "5-18",
    "Basics of English Grammar",
  ),
  "Grammar 2: Identification of Phrases & Clauses": slice(ENGLISH, "17-22", "Phrase and Clause"),
  "Grammar 3: Determiner, Noun": slice(ENGLISH, "22-32", "Noun"),
  "Grammar 4: Pronoun, Number, Gender": slice(ENGLISH, "32-43", "Pronoun, Number, Gender"),
  "Grammar 5: Adjective & Adverb": slice(ENGLISH, "43-59", "Adjective, Adverb"),
  "Grammar 6: Preposition-1": slice(ENGLISH, "59-71", "Preposition"),
  "Grammar 7: Preposition-2": slice(ENGLISH, "59-71", "Preposition"),
  "Grammar 8: Tense": slice(ENGLISH, "78-87", "Tense"),
  "Grammar 9: Voice": slice(ENGLISH, "122-129", "Voice"),
  "Grammar 10: Conditionals": slice(ENGLISH, "115-122", "Conditional Sentence"),
  "Grammar 11: Verb & Right Form of Verb": slice(ENGLISH, "87-99", "Verb"),
  "Grammar 12: Correction": slice(ENGLISH, "147-156", "Correction"),
  "Grammar 13: Conjunction & Sentence": slice(
    ENGLISH,
    "71-78,133-142",
    "Conjunction, Sentence & Transformation",
  ),
  "Grammar 14: Narration": slice(ENGLISH, "129-133", "Narration"),
  "Grammar 15: Subject-Verb Agreement": slice(ENGLISH, "142-147", "Subject-Verb-Agreement"),
  "Grammar 16: Phrasal Verb": slice(ENGLISH, "99-103", "Phrasal Verb"),
  "Grammar 17: Spelling": slice(ENGLISH, "156-161", "Spelling"),
  "Grammar 18: Phrase & Idioms": slice(ENGLISH, "103-115", "Phrase and Idioms"),
  "Grammar 19: One Word Substitute": slice(ENGLISH, "161-171", "One-Word Substitution"),
  // The book has no vocabulary chapter; One-Word Substitution is the closest
  // (BCS synonym/antonym questions, word meanings, word roots).
  "Vocabulary Marathon-1": slice(
    ENGLISH,
    "161-171",
    "One-Word Substitution (synonyms, antonyms, word roots)",
  ),
  "Vocabulary Marathon-2": slice(
    ENGLISH,
    "161-171",
    "One-Word Substitution (synonyms, antonyms, word roots)",
  ),
  ...BANGLA_SLICES,
  ...MATH_SLICES,
};

/** The lecture's file name in the bucket: its title, lower-cased, as a slug. */
export function lectureSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Where a lecture's book pages live in the bucket, or null without a book. */
export function lectureBookPath(title: string): string | null {
  const s = LECTURE_BOOK_SLICES[title];
  return s ? `${s.book.folder}/${s.slug ?? lectureSlug(title)}.pdf` : null;
}

/** The pages as a list of PDF page numbers (1-based), in order. */
export function slicePages(pages: string): number[] {
  return pages.split(",").flatMap((range) => {
    const [from, to = from] = range.split("-").map(Number);
    return Array.from({ length: to - from + 1 }, (_, i) => from + i);
  });
}
