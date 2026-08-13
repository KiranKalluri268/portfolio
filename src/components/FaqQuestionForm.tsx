"use client";

import Link from "next/link";
import { useState } from "react";

interface FaqForm {
  email: string;
  question: string;
}

interface FaqFormErrors {
  email?: string;
  question?: string;
}

const fieldClasses = (hasError: boolean) =>
  [
    "w-full rounded-control border bg-white/5 px-3 py-2 text-white",
    "placeholder:text-white/40 transition-colors",
    "focus:outline-none focus:ring-2 focus:ring-accent",
    hasError ? "border-red-500" : "border-white/20 hover:border-white/35",
  ].join(" ");

export default function FaqQuestionForm() {
  const [form, setForm] = useState<FaqForm>({ email: "", question: "" });
  const [errors, setErrors] = useState<FaqFormErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const validate = (): boolean => {
    const newErrors: FaqFormErrors = {};
    if (!form.email.trim()) newErrors.email = "Email is required";
    else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(form.email.trim()))
      newErrors.email = "Invalid email address";
    if (!form.question.trim()) newErrors.question = "Question is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setSubmitError("");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, message: form.question, source: "faq" }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) throw new Error(result.error || "Unable to send your question.");

      setSubmitted(true);
      setForm({ email: "", question: "" });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to send your question.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="animate-fade-in flex flex-col items-center gap-5">
        <p className="font-semibold text-green-500" role="status" aria-live="polite">
          Thanks for asking! I will get back to you soon.
        </p>
        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className="rounded-full border border-white/25 bg-black/40 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:border-accent hover:text-accent-soft"
        >
          Ask another question
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mx-auto w-full max-w-md space-y-4 text-left"
      aria-label="Ask a question"
    >
      <div>
        <label htmlFor="faq-email" className="mb-1 block text-sm font-medium">
          Email <span className="text-red-500">*</span>
        </label>
        <input
          id="faq-email"
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          className={fieldClasses(Boolean(errors.email))}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "faq-email-error" : undefined}
          required
        />
        {errors.email && (
          <p id="faq-email-error" className="mt-1 text-sm text-red-500">
            {errors.email}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="faq-question" className="mb-1 block text-sm font-medium">
          Your question <span className="text-red-500">*</span>
        </label>
        <textarea
          id="faq-question"
          name="question"
          rows={4}
          value={form.question}
          onChange={handleChange}
          className={fieldClasses(Boolean(errors.question))}
          aria-invalid={errors.question ? true : undefined}
          aria-describedby={errors.question ? "faq-question-error" : undefined}
          required
        />
        {errors.question && (
          <p id="faq-question-error" className="mt-1 text-sm text-red-500">
            {errors.question}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition-[background-color,transform] hover:scale-105 hover:bg-accent-soft focus:outline-none focus:ring-2 focus:ring-accent disabled:cursor-wait disabled:opacity-60 disabled:hover:scale-100"
        >
          {isSubmitting ? "Sending..." : "Submit question"}
        </button>
        <Link
          href="/resume"
          className="rounded-full border border-white/20 bg-black/45 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:border-accent-soft/60 hover:text-accent-soft focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-soft"
        >
          View résumé
        </Link>
      </div>
      {submitError && (
        <p className="text-center text-sm text-red-500" role="alert" aria-live="assertive">
          {submitError}
        </p>
      )}
    </form>
  );
}
