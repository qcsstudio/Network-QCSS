"use client";

import { CheckCircle2, RefreshCcw, XCircle } from "lucide-react";
import { useState } from "react";
import type { CcnaLessonContent } from "@/lib/ccna-lesson-schema";

export function CcnaQuiz({ questions, slug }: { questions: CcnaLessonContent["quiz"]; slug: string }) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const score = questions.reduce((total, question, index) => total + (answers[index] === question.correctIndex ? 1 : 0), 0);

  function submit() {
    setSubmitted(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`qcs-ccna-quiz-${slug}`, JSON.stringify({ score, total: questions.length, completedAt: new Date().toISOString() }));
    }
  }

  function reset() {
    setAnswers({});
    setSubmitted(false);
  }

  return (
    <section className="ccna-quiz" aria-labelledby="lesson-quiz-title">
      <div className="ccna-quiz-heading">
        <div><p className="eyebrow">Knowledge check</p><h2 id="lesson-quiz-title">Quiz: prove the reasoning</h2></div>
        {submitted ? <strong>{score}/{questions.length}</strong> : <span>{Object.keys(answers).length}/{questions.length} answered</span>}
      </div>
      <div className="ccna-quiz-list">
        {questions.map((question, questionIndex) => {
          const selected = answers[questionIndex];
          const correct = submitted && selected === question.correctIndex;
          return (
            <fieldset className="ccna-quiz-question" key={question.question}>
              <legend><span>{String(questionIndex + 1).padStart(2, "0")}</span>{question.question}</legend>
              <div className="ccna-quiz-options">
                {question.options.map((option, optionIndex) => {
                  const isCorrect = submitted && optionIndex === question.correctIndex;
                  const isWrong = submitted && selected === optionIndex && !isCorrect;
                  return (
                    <label className={`${isCorrect ? "is-correct" : ""} ${isWrong ? "is-wrong" : ""}`} key={option}>
                      <input
                        checked={selected === optionIndex}
                        disabled={submitted}
                        name={`question-${questionIndex}`}
                        onChange={() => setAnswers((current) => ({ ...current, [questionIndex]: optionIndex }))}
                        type="radio"
                      />
                      <span>{option}</span>
                      {isCorrect ? <CheckCircle2 aria-hidden="true" size={18} /> : isWrong ? <XCircle aria-hidden="true" size={18} /> : null}
                    </label>
                  );
                })}
              </div>
              {submitted ? <p className={`ccna-quiz-explanation ${correct ? "is-correct" : ""}`}>{question.explanation}</p> : null}
            </fieldset>
          );
        })}
      </div>
      <div className="button-row">
        {!submitted ? <button className="button primary" disabled={Object.keys(answers).length !== questions.length} onClick={submit} type="button">Check answers</button> : null}
        {submitted ? <button className="button secondary" onClick={reset} type="button"><RefreshCcw aria-hidden="true" size={17} /> Try again</button> : null}
      </div>
    </section>
  );
}
