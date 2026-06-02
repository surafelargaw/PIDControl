"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { WidgetHost, type WidgetSlot } from "@/components/learn/widget-host";
import { getBundledLessonMarkdown } from "@/lib/content/documentation-assets";
import { lessonRegistry } from "@/lib/content/lessons";
import { renderMarkdown } from "@/lib/content/markdown";
import { buildLessonSearchSections, searchLessonSections, type LessonSearchSection } from "@/lib/content/search";
import { useHashRoute } from "@/lib/platform/hash-router";

type Lesson = (typeof lessonRegistry)[number];

const isPlatformReferenceLesson = (lesson: Lesson) => lesson.title.startsWith("0.");
const platformReferenceLessons = lessonRegistry.filter(isPlatformReferenceLesson);
const advancedLessons = lessonRegistry.filter((lesson) => !isPlatformReferenceLesson(lesson));
const lessonMarkdown = Object.fromEntries(
  lessonRegistry.map((lesson) => [lesson.id, getBundledLessonMarkdown(lesson.file)])
);
const searchSections: LessonSearchSection[] = lessonRegistry.flatMap((lesson) =>
  buildLessonSearchSections(lesson, lessonMarkdown[lesson.id])
);

export function LearnBrowser() {
  const [activeLessonId, setActiveLessonId] = useState<string>(lessonRegistry[0]?.id ?? "");
  const [isPlatformReferenceOpen, setIsPlatformReferenceOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [widgetSlots, setWidgetSlots] = useState<WidgetSlot[]>([]);
  const [pendingAnchor, setPendingAnchor] = useState<{ lessonId: string; headingId: string } | null>(null);
  const lessonContentRef = useRef<HTMLDivElement | null>(null);
  const { params: searchParams, anchor } = useHashRoute();
  const activeLesson = useMemo(
    () => lessonRegistry.find((lesson) => lesson.id === activeLessonId) ?? lessonRegistry[0],
    [activeLessonId]
  );
  const activeLessonHtml = useMemo(
    () => activeLesson ? renderMarkdown(lessonMarkdown[activeLesson.id]) : "",
    [activeLesson]
  );
  const isPlatformLessonActive = activeLesson ? isPlatformReferenceLesson(activeLesson) : false;
  const trimmedSearchQuery = searchQuery.trim();
  const searchResults = useMemo(
    () => searchLessonSections(searchSections, trimmedSearchQuery),
    [searchSections, trimmedSearchQuery]
  );

  useEffect(() => {
    const requestedLessonId = searchParams.get("lesson");
    if (!requestedLessonId) {
      return;
    }

    if (lessonRegistry.some((lesson) => lesson.id === requestedLessonId)) {
      setActiveLessonId(requestedLessonId);
      if (anchor) {
        setPendingAnchor({ lessonId: requestedLessonId, headingId: anchor });
      }
    }
  }, [anchor, searchParams]);

  useEffect(() => {
    if (activeLesson && isPlatformReferenceLesson(activeLesson)) {
      setIsPlatformReferenceOpen(true);
    }
  }, [activeLesson]);

  useEffect(() => {
    const root = lessonContentRef.current;
    if (!root || !activeLessonHtml || !activeLesson) {
      setWidgetSlots([]);
      return;
    }

    const slots = Array.from(root.querySelectorAll<HTMLElement>("[data-widget]")).map((element, index) => ({
      slotId: `${activeLesson.id}-${index}`,
      widgetId: element.dataset.widget ?? "",
      element
    }));

    setWidgetSlots(slots);
  }, [activeLesson, activeLessonHtml]);

  useEffect(() => {
    if (!pendingAnchor || !activeLesson || pendingAnchor.lessonId !== activeLesson.id || !activeLessonHtml) {
      return;
    }

    const timerId = window.setTimeout(() => {
      const heading = document.getElementById(pendingAnchor.headingId);
      heading?.scrollIntoView({ behavior: "smooth", block: "start" });
      setPendingAnchor(null);
    }, 50);

    return () => window.clearTimeout(timerId);
  }, [activeLesson, activeLessonHtml, pendingAnchor]);

  const openSearchResult = (result: (typeof searchResults)[number]) => {
    setActiveLessonId(result.lessonId);
    setPendingAnchor({ lessonId: result.lessonId, headingId: result.headingId });
    if (platformReferenceLessons.some((lesson) => lesson.id === result.lessonId)) {
      setIsPlatformReferenceOpen(true);
    }
  };

  const renderLessonButton = (lesson: Lesson) => (
    <button
      key={lesson.id}
      className={`nav-link${lesson.id === activeLesson?.id ? " active" : ""}`}
      onClick={() => setActiveLessonId(lesson.id)}
    >
      <strong>{lesson.title}</strong>
      <span>{lesson.file.split("/").pop()}</span>
    </button>
  );

  return (
    <main className="page-stack">
      <section className="page-card">
        <p className="eyebrow">Documentation</p>
        <h2>Migrated BAS Training Content</h2>
        <p>
          The legacy markdown help system now sits beside newer playbooks on data-driven tuning, anti-overshoot
          structure, feedforward, and motion-control safeguards so the simulator and the learning material can live in
          one product shell.
        </p>
      </section>

      <section className="panel-grid">
        <article className="panel">
          <p className="eyebrow">Lessons</p>
          <h2>Reference Topics</h2>
          <div className="learn-search">
            <label className="field">
              <span className="label">Search Lessons</span>
              <input
                type="search"
                value={searchQuery}
                placeholder="Try deadtime, duct pressure, windup, cascade..."
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>
            <div className="learn-search-meta">
              {trimmedSearchQuery.length < 2 ? "Search by keyword, model name, or technical detail." : null}
              {trimmedSearchQuery.length >= 2 ? `${searchResults.length} result${searchResults.length === 1 ? "" : "s"}` : null}
            </div>
            {trimmedSearchQuery.length >= 2 ? (
              <div className="learn-search-results" aria-label="Lesson search results">
                {searchResults.length ? searchResults.map((result) => (
                  <button
                    key={`${result.lessonId}-${result.headingId}`}
                    type="button"
                    className="learn-search-result"
                    onClick={() => openSearchResult(result)}
                  >
                    <strong>{result.heading}</strong>
                    <span>{result.lessonTitle}</span>
                    <p>{result.snippet}</p>
                  </button>
                )) : <p className="muted">No matching lesson sections found.</p>}
              </div>
            ) : null}
          </div>
          <div className="nav-group lesson-nav">
            <div className="lesson-dropdown">
              <button
                type="button"
                className={`nav-link lesson-dropdown-toggle${isPlatformLessonActive ? " active" : ""}`}
                onClick={() => setIsPlatformReferenceOpen((current) => !current)}
                aria-expanded={isPlatformReferenceOpen}
                aria-controls="platform-reference-lessons"
              >
                <span className="nav-link-inner">
                  <strong>0.x Platform & Operator Reference</strong>
                  <span>
                    {isPlatformLessonActive && activeLesson
                      ? `Selected: ${activeLesson.title}`
                      : `${platformReferenceLessons.length} lessons`}
                  </span>
                </span>
                <span className="lesson-dropdown-caret" aria-hidden="true">
                  {isPlatformReferenceOpen ? "-" : "+"}
                </span>
              </button>

              {isPlatformReferenceOpen ? (
                <div id="platform-reference-lessons" className="lesson-dropdown-content">
                  {platformReferenceLessons.map(renderLessonButton)}
                </div>
              ) : null}
            </div>

            {advancedLessons.map(renderLessonButton)}
          </div>
        </article>

        <article className="lesson-card">
          <p className="eyebrow">Selected Lesson</p>
          <h2>{activeLesson?.title}</h2>
          {/* HTML comes from renderMarkdown(), which HTML-escapes all text and
              emits no script tags. Source is same-origin static lesson files only. */}
          <div
            ref={lessonContentRef}
            className="lesson-markdown"
            dangerouslySetInnerHTML={{ __html: activeLesson ? activeLessonHtml ?? "<p>Loading lesson...</p>" : "<p>No lesson selected.</p>" }}
          />
          <WidgetHost slots={widgetSlots} />
        </article>
      </section>
    </main>
  );
}
