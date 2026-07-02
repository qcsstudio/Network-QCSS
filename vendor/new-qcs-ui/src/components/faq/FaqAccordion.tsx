import type { ReactNode } from "react";

type FaqTuple = readonly [question: string, answer: string];

interface FaqAccordionProps {
  faqs: readonly FaqTuple[];
  defaultOpenIndex?: number;
  answerClassName?: string;
  renderAnswer?: (answer: string, question: string, index: number) => ReactNode;
}

export default function FaqAccordion({
  faqs,
  defaultOpenIndex = 0,
  answerClassName = "mt-2 mb-0",
  renderAnswer,
}: FaqAccordionProps) {
  return (
    <div className="cs_accordeon">
      {faqs.map(([question, answer], index) => (
        <details
          key={question}
          className="cs_accordion_item cs_card cs_style_1 p-3 mb-3"
          open={index === defaultOpenIndex}
        >
          <summary className="cs_accordion_header fw-semibold">
            {question}
          </summary>
          <div className="cs_accordion_body">
            {renderAnswer ? (
              renderAnswer(answer, question, index)
            ) : (
              <p className={answerClassName}>{answer}</p>
            )}
          </div>
        </details>
      ))}
    </div>
  );
}
