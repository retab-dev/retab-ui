// One sample PoliTax-Split document: GT / Split v1 / Split v2 segments
// plus per-pipeline Pages Labelled Correctly (seg_accuracy) and Total F1 (lenient).
// Source row extracted from handmade-tests/benchmark/gen_showcase_data.py output.

export type ShowcaseSeg = { t: string; s: number; e: number };

export type ShowcaseDoc = {
  document: string;
  pretty_name: string;
  page_count: number;
  ground_truth: ShowcaseSeg[];
  v1: ShowcaseSeg[];
  v2: ShowcaseSeg[];
  v1_seg_accuracy: number;
  v1_lenient_f1: number;
  v2_seg_accuracy: number;
  v2_lenient_f1: number;
};

export const SHOWCASE_DOC: ShowcaseDoc = {
    document: "harris_2020_federal_state_returns.pdf",
    pretty_name: "Harris 2020 \u2014 Federal & State Returns",
    page_count: 100,
    ground_truth: [
      {
        t: "Form 1040",
        s: 1,
        e: 2,
      },
      {
        t: "Schedule 1 (Form 1040)",
        s: 3,
        e: 3,
      },
      {
        t: "Schedule 2 (Form 1040)",
        s: 4,
        e: 4,
      },
      {
        t: "Schedule 3 (Form 1040)",
        s: 5,
        e: 5,
      },
      {
        t: "Form 2210",
        s: 6,
        e: 8,
      },
      {
        t: "Schedule A (Form 1040)",
        s: 9,
        e: 9,
      },
      {
        t: "Schedule B (Form 1040)",
        s: 10,
        e: 10,
      },
      {
        t: "Schedule C (Form 1040)",
        s: 11,
        e: 11,
      },
      {
        t: "Schedule D (Form 1040)",
        s: 12,
        e: 13,
      },
      {
        t: "Schedule E (Form 1040)",
        s: 14,
        e: 14,
      },
      {
        t: "Schedule SE (Form 1040)",
        s: 15,
        e: 16,
      },
      {
        t: "Schedule SE (Form 1040)",
        s: 17,
        e: 18,
      },
      {
        t: "misc_form",
        s: 19,
        e: 20,
      },
      {
        t: "misc_form",
        s: 21,
        e: 23,
      },
      {
        t: "Form 6251",
        s: 24,
        e: 25,
      },
      {
        t: "misc_form",
        s: 26,
        e: 27,
      },
      {
        t: "Schedule H (Form 1040)",
        s: 28,
        e: 29,
      },
      {
        t: "misc_form",
        s: 30,
        e: 30,
      },
      {
        t: "misc_form",
        s: 31,
        e: 31,
      },
      {
        t: "Form 8960",
        s: 32,
        e: 33,
      },
      {
        t: "supplement",
        s: 34,
        e: 41,
      },
      {
        t: "misc_form",
        s: 42,
        e: 46,
      },
      {
        t: "misc_form",
        s: 47,
        e: 47,
      },
      {
        t: "misc_form",
        s: 48,
        e: 50,
      },
      {
        t: "supplement",
        s: 51,
        e: 51,
      },
      {
        t: "misc_form",
        s: 52,
        e: 53,
      },
      {
        t: "misc_form",
        s: 54,
        e: 54,
      },
      {
        t: "misc_form",
        s: 55,
        e: 55,
      },
      {
        t: "misc_form",
        s: 56,
        e: 56,
      },
      {
        t: "misc_form",
        s: 57,
        e: 57,
      },
      {
        t: "misc_form",
        s: 58,
        e: 58,
      },
      {
        t: "misc_form",
        s: 59,
        e: 59,
      },
      {
        t: "misc_form",
        s: 60,
        e: 60,
      },
      {
        t: "misc_form",
        s: 61,
        e: 61,
      },
      {
        t: "misc_form",
        s: 62,
        e: 62,
      },
      {
        t: "misc_form",
        s: 63,
        e: 63,
      },
      {
        t: "misc_form",
        s: 64,
        e: 64,
      },
      {
        t: "misc_form",
        s: 65,
        e: 65,
      },
      {
        t: "misc_form",
        s: 66,
        e: 66,
      },
      {
        t: "misc_form",
        s: 67,
        e: 67,
      },
      {
        t: "misc_form",
        s: 68,
        e: 68,
      },
      {
        t: "misc_form",
        s: 69,
        e: 69,
      },
      {
        t: "misc_form",
        s: 70,
        e: 70,
      },
      {
        t: "misc_form",
        s: 71,
        e: 71,
      },
      {
        t: "misc_form",
        s: 72,
        e: 72,
      },
      {
        t: "misc_form",
        s: 73,
        e: 73,
      },
      {
        t: "misc_form",
        s: 74,
        e: 75,
      },
      {
        t: "misc_form",
        s: 76,
        e: 77,
      },
      {
        t: "supplement",
        s: 78,
        e: 78,
      },
      {
        t: "misc_form",
        s: 79,
        e: 83,
      },
      {
        t: "supplement",
        s: 84,
        e: 84,
      },
      {
        t: "supplement",
        s: 85,
        e: 85,
      },
      {
        t: "supplement",
        s: 86,
        e: 87,
      },
      {
        t: "misc_form",
        s: 88,
        e: 90,
      },
      {
        t: "misc_form",
        s: 91,
        e: 91,
      },
      {
        t: "supplement",
        s: 92,
        e: 92,
      },
      {
        t: "supplement",
        s: 93,
        e: 97,
      },
      {
        t: "Schedule D (Form 1040)",
        s: 98,
        e: 99,
      },
      {
        t: "supplement",
        s: 100,
        e: 100,
      },
    ],
    v1: [
      {
        t: "Form 1040",
        s: 1,
        e: 2,
      },
      {
        t: "Schedule 1 (Form 1040)",
        s: 3,
        e: 3,
      },
      {
        t: "Schedule 2 (Form 1040)",
        s: 4,
        e: 4,
      },
      {
        t: "Schedule 3 (Form 1040)",
        s: 5,
        e: 5,
      },
      {
        t: "Form 2210",
        s: 6,
        e: 8,
      },
      {
        t: "Schedule A (Form 1040)",
        s: 9,
        e: 9,
      },
      {
        t: "Schedule B (Form 1040)",
        s: 10,
        e: 10,
      },
      {
        t: "Schedule C (Form 1040)",
        s: 11,
        e: 11,
      },
      {
        t: "Schedule D (Form 1040)",
        s: 12,
        e: 13,
      },
      {
        t: "Schedule E (Form 1040)",
        s: 14,
        e: 14,
      },
      {
        t: "Schedule SE (Form 1040)",
        s: 15,
        e: 18,
      },
      {
        t: "misc_form",
        s: 19,
        e: 20,
      },
      {
        t: "misc_form",
        s: 21,
        e: 23,
      },
      {
        t: "Form 6251",
        s: 24,
        e: 25,
      },
      {
        t: "misc_form",
        s: 26,
        e: 27,
      },
      {
        t: "Schedule H (Form 1040)",
        s: 28,
        e: 29,
      },
      {
        t: "misc_form",
        s: 30,
        e: 30,
      },
      {
        t: "misc_form",
        s: 31,
        e: 31,
      },
      {
        t: "Form 8960",
        s: 32,
        e: 33,
      },
      {
        t: "supplement",
        s: 34,
        e: 34,
      },
      {
        t: "supplement",
        s: 35,
        e: 35,
      },
      {
        t: "supplement",
        s: 35,
        e: 35,
      },
      {
        t: "supplement",
        s: 35,
        e: 35,
      },
      {
        t: "supplement",
        s: 35,
        e: 35,
      },
      {
        t: "supplement",
        s: 36,
        e: 36,
      },
      {
        t: "supplement",
        s: 37,
        e: 37,
      },
      {
        t: "supplement",
        s: 38,
        e: 38,
      },
      {
        t: "supplement",
        s: 39,
        e: 39,
      },
      {
        t: "supplement",
        s: 40,
        e: 40,
      },
      {
        t: "supplement",
        s: 41,
        e: 41,
      },
      {
        t: "supplement",
        s: 41,
        e: 41,
      },
      {
        t: "misc_form",
        s: 42,
        e: 46,
      },
      {
        t: "misc_form",
        s: 47,
        e: 47,
      },
      {
        t: "misc_form",
        s: 48,
        e: 50,
      },
      {
        t: "supplement",
        s: 51,
        e: 51,
      },
      {
        t: "misc_form",
        s: 52,
        e: 53,
      },
      {
        t: "misc_form",
        s: 54,
        e: 73,
      },
      {
        t: "misc_form",
        s: 74,
        e: 77,
      },
      {
        t: "supplement",
        s: 78,
        e: 78,
      },
      {
        t: "misc_form",
        s: 79,
        e: 83,
      },
      {
        t: "supplement",
        s: 84,
        e: 87,
      },
      {
        t: "misc_form",
        s: 88,
        e: 91,
      },
      {
        t: "misc_form",
        s: 89,
        e: 91,
      },
      {
        t: "misc_form",
        s: 91,
        e: 91,
      },
      {
        t: "supplement",
        s: 92,
        e: 92,
      },
      {
        t: "supplement",
        s: 93,
        e: 97,
      },
      {
        t: "Schedule D (Form 1040)",
        s: 98,
        e: 99,
      },
      {
        t: "supplement",
        s: 100,
        e: 100,
      },
      {
        t: "supplement",
        s: 100,
        e: 100,
      },
    ],
    v2: [
      {
        t: "Form 1040",
        s: 1,
        e: 2,
      },
      {
        t: "Schedule 1 (Form 1040)",
        s: 3,
        e: 3,
      },
      {
        t: "Schedule 2 (Form 1040)",
        s: 4,
        e: 4,
      },
      {
        t: "Schedule 3 (Form 1040)",
        s: 5,
        e: 5,
      },
      {
        t: "Form 2210",
        s: 6,
        e: 8,
      },
      {
        t: "Schedule A (Form 1040)",
        s: 9,
        e: 9,
      },
      {
        t: "Schedule B (Form 1040)",
        s: 10,
        e: 10,
      },
      {
        t: "Schedule C (Form 1040)",
        s: 11,
        e: 11,
      },
      {
        t: "Schedule D (Form 1040)",
        s: 12,
        e: 13,
      },
      {
        t: "Schedule E (Form 1040)",
        s: 14,
        e: 14,
      },
      {
        t: "Schedule SE (Form 1040)",
        s: 15,
        e: 16,
      },
      {
        t: "Schedule SE (Form 1040)",
        s: 17,
        e: 18,
      },
      {
        t: "misc_form",
        s: 19,
        e: 20,
      },
      {
        t: "misc_form",
        s: 21,
        e: 23,
      },
      {
        t: "Form 6251",
        s: 24,
        e: 25,
      },
      {
        t: "misc_form",
        s: 26,
        e: 27,
      },
      {
        t: "Schedule H (Form 1040)",
        s: 28,
        e: 29,
      },
      {
        t: "misc_form",
        s: 30,
        e: 30,
      },
      {
        t: "misc_form",
        s: 31,
        e: 31,
      },
      {
        t: "Form 8960",
        s: 32,
        e: 32,
      },
      {
        t: "Form 8960",
        s: 33,
        e: 33,
      },
      {
        t: "supplement",
        s: 34,
        e: 41,
      },
      {
        t: "misc_form",
        s: 42,
        e: 46,
      },
      {
        t: "misc_form",
        s: 47,
        e: 47,
      },
      {
        t: "misc_form",
        s: 48,
        e: 50,
      },
      {
        t: "supplement",
        s: 51,
        e: 51,
      },
      {
        t: "misc_form",
        s: 52,
        e: 53,
      },
      {
        t: "misc_form",
        s: 54,
        e: 54,
      },
      {
        t: "misc_form",
        s: 55,
        e: 55,
      },
      {
        t: "misc_form",
        s: 56,
        e: 56,
      },
      {
        t: "misc_form",
        s: 57,
        e: 57,
      },
      {
        t: "misc_form",
        s: 58,
        e: 58,
      },
      {
        t: "misc_form",
        s: 59,
        e: 59,
      },
      {
        t: "misc_form",
        s: 60,
        e: 60,
      },
      {
        t: "misc_form",
        s: 61,
        e: 61,
      },
      {
        t: "misc_form",
        s: 62,
        e: 62,
      },
      {
        t: "misc_form",
        s: 63,
        e: 63,
      },
      {
        t: "misc_form",
        s: 64,
        e: 64,
      },
      {
        t: "misc_form",
        s: 65,
        e: 65,
      },
      {
        t: "misc_form",
        s: 66,
        e: 66,
      },
      {
        t: "misc_form",
        s: 67,
        e: 67,
      },
      {
        t: "misc_form",
        s: 68,
        e: 68,
      },
      {
        t: "misc_form",
        s: 69,
        e: 69,
      },
      {
        t: "misc_form",
        s: 70,
        e: 70,
      },
      {
        t: "misc_form",
        s: 71,
        e: 71,
      },
      {
        t: "misc_form",
        s: 72,
        e: 72,
      },
      {
        t: "misc_form",
        s: 73,
        e: 73,
      },
      {
        t: "misc_form",
        s: 74,
        e: 75,
      },
      {
        t: "misc_form",
        s: 76,
        e: 77,
      },
      {
        t: "supplement",
        s: 78,
        e: 78,
      },
      {
        t: "misc_form",
        s: 79,
        e: 83,
      },
      {
        t: "supplement",
        s: 84,
        e: 87,
      },
      {
        t: "misc_form",
        s: 88,
        e: 90,
      },
      {
        t: "misc_form",
        s: 91,
        e: 91,
      },
      {
        t: "supplement",
        s: 92,
        e: 97,
      },
      {
        t: "Schedule D (Form 1040)",
        s: 98,
        e: 99,
      },
      {
        t: "supplement",
        s: 100,
        e: 100,
      },
    ],
    v1_seg_accuracy: 1.0,
    v1_lenient_f1: 0.6296,
    v2_seg_accuracy: 1.0,
    v2_lenient_f1: 0.9655,
  };
