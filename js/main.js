document.addEventListener("DOMContentLoaded", () => {
    // ============================================================
    // Constants & Configuration
    // ============================================================

    const SITE_NAME = "David Wang";
    const FADE_DURATION = 150;
    const DEBOUNCE_DELAY = 10;
    const COPY_FEEDBACK_DURATION = 1000;
    const ENGAGEMENT_DELAY = 500;
    const LONG_PRESS_DURATION = 250;

    const ROUTES = {
        "/": { fragment: "_content/home.html", documentTitle: SITE_NAME },
        "/projects": { fragment: "_content/projects.html", documentTitle: `Projects - ${SITE_NAME}` },
        "/writing": { fragment: "_content/writing.html", documentTitle: `Writing - ${SITE_NAME}` },
        "/index.html": { fragment: "_content/home.html", documentTitle: SITE_NAME }
    };

    // ============================================================
    // DOM References
    // ============================================================

    const contentEl = document.getElementById("content");
    if (!contentEl) return;

    const headerTitleEl = document.querySelector(".container > h1");
    const subtitlePrimaryEl = document.querySelector(".subtitle > span:first-child");
    const subtitleContainerEl = subtitlePrimaryEl?.closest(".subtitle");
    const footerEl = document.querySelector("footer");

    // ============================================================
    // Utility Functions
    // ============================================================

    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const debounce = (fn, wait) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn(...args), wait);
        };
    };

    const normalizePath = (path) => {
        if (!path) return "/";
        let normalized = path.split("?")[0].split("#")[0];
        if (!normalized.startsWith("/")) normalized = `/${normalized}`;
        if (normalized.length > 1 && normalized.endsWith("/")) {
            normalized = normalized.slice(0, -1);
        }
        return normalized || "/";
    };

    const slugify = (text) => {
        return (text || "")
            .toLowerCase()
            .trim()
            .replace(/["'`~!@#$%^&*()=+\[\]{}|;:\\<>,.?/]+/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "");
    };

    const resolveLineHeight = (styles) => {
        const raw = parseFloat(styles.lineHeight);
        if (Number.isFinite(raw)) return raw;
        const fallback = parseFloat(styles.fontSize);
        return Number.isFinite(fallback) ? fallback * 1.2 : 16;
    };

    const copyToClipboard = async (text) => {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
        // Fallback for older browsers
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.cssText = "position:absolute;left:-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        try {
            return document.execCommand("copy");
        } finally {
            document.body.removeChild(textarea);
        }
    };

    // ============================================================
    // Engagement Tracking Helpers
    // ============================================================

    const createEngagementTracker = (sources, onUpdate) => {
        const state = Object.fromEntries(sources.map(s => [s, false]));
        const timers = Object.fromEntries(sources.map(s => [s, null]));

        const isEngaged = () => Object.values(state).some(Boolean);

        const engage = (source) => {
            clearTimeout(timers[source]);
            state[source] = true;
            onUpdate(isEngaged());
        };

        const disengage = (source, immediate = false) => {
            clearTimeout(timers[source]);
            if (immediate) {
                state[source] = false;
                onUpdate(isEngaged());
            } else {
                timers[source] = setTimeout(() => {
                    state[source] = false;
                    onUpdate(isEngaged());
                }, ENGAGEMENT_DELAY);
            }
        };

        const cancel = (source) => clearTimeout(timers[source]);

        return { state, isEngaged, engage, disengage, cancel };
    };

    const setupHoverEngagement = (container, tracker, source = "hover") => {
        let ignoreMouseEnter = false;

        container.addEventListener("mouseenter", () => {
            if (ignoreMouseEnter) { ignoreMouseEnter = false; return; }
            tracker.engage(source);
        });

        container.addEventListener("mouseleave", () => tracker.disengage(source));

        container.addEventListener("touchstart", () => {
            ignoreMouseEnter = true;
        }, { passive: true });
    };

    const setupScrollEngagement = (scrollEl, tracker, scrollSource = "scroll", touchSource = "touch") => {
        let isTouching = false;

        scrollEl.addEventListener("scroll", () => {
            tracker.engage(scrollSource);
            if (isTouching && touchSource) tracker.engage(touchSource);
            tracker.disengage(scrollSource);
        }, { passive: true });

        if (touchSource) {
            scrollEl.addEventListener("touchstart", () => {
                tracker.cancel(touchSource);
                isTouching = true;
            }, { passive: true });

            const onTouchEnd = () => {
                isTouching = false;
                tracker.disengage(touchSource);
            };
            scrollEl.addEventListener("touchend", onTouchEnd);
            scrollEl.addEventListener("touchcancel", onTouchEnd);
        }
    };

    // ============================================================
    // Header & Subtitle Management
    // ============================================================

    const collectSubtitleVariants = (element) => {
        if (!element) return [];
        const variants = [];
        let index = 0;
        while (element.hasAttribute(`data-subtitle-${index}`)) {
            const value = (element.getAttribute(`data-subtitle-${index}`) || "").trim();
            if (value) variants.push(value);
            index++;
        }
        if (!variants.length) {
            const fallback = (element.textContent || "").trim();
            if (fallback) variants.push(fallback);
        }
        return variants;
    };

    const defaultSubtitleVariants = collectSubtitleVariants(subtitlePrimaryEl);
    const defaultHeader = {
        title: headerTitleEl?.textContent.trim() || SITE_NAME,
        subtitle: subtitlePrimaryEl?.textContent.trim() || "",
        subtitleVariants: defaultSubtitleVariants
    };

    const getFallbackSubtitleVariants = () => {
        if (defaultHeader.subtitleVariants.length > 0) {
            return [...defaultHeader.subtitleVariants];
        }
        const fallback = (defaultHeader.subtitle || "").trim();
        return fallback ? [fallback] : [];
    };

    const normalizeSubtitleVariants = (value) => {
        if (Array.isArray(value)) {
            const normalized = value.map((v) => (v || "").trim()).filter(Boolean);
            return normalized.length ? normalized : getFallbackSubtitleVariants();
        }
        if (typeof value === "string") {
            const trimmed = value.trim();
            return trimmed ? [trimmed] : getFallbackSubtitleVariants();
        }
        return getFallbackSubtitleVariants();
    };

    const setHeader = (title, subtitles) => {
        if (headerTitleEl) {
            headerTitleEl.textContent = title || defaultHeader.title;
            headerTitleEl.classList.add("loaded");
        }
        if (subtitlePrimaryEl) {
            const variants = normalizeSubtitleVariants(subtitles);
            subtitlePrimaryEl.textContent = variants[0] || defaultHeader.subtitle || "";

            // Clear old data-subtitle-* attributes
            let i = 0;
            while (subtitlePrimaryEl.hasAttribute(`data-subtitle-${i}`)) {
                subtitlePrimaryEl.removeAttribute(`data-subtitle-${i++}`);
            }
            // Set new attributes
            variants.forEach((variant, idx) => {
                subtitlePrimaryEl.setAttribute(`data-subtitle-${idx}`, variant);
            });

            subtitleContainerEl?.classList.add("loaded");
        }
        footerEl?.classList.add("loaded");
    };

    // ============================================================
    // Responsive Menu Handling
    // ============================================================

    let menuMeasureSpan = null;

    const getMenuMeasureSpan = (menuEl) => {
        if (!menuEl) return null;
        if (!menuMeasureSpan) {
            menuMeasureSpan = document.createElement("span");
            menuMeasureSpan.id = "menu-measure";
            menuMeasureSpan.style.cssText = "visibility:hidden;position:absolute;white-space:nowrap";
            document.body.appendChild(menuMeasureSpan);
        }
        const computed = window.getComputedStyle(menuEl);
        menuMeasureSpan.style.fontSize = computed.fontSize;
        menuMeasureSpan.style.fontFamily = computed.fontFamily;
        menuMeasureSpan.style.fontWeight = computed.fontWeight;
        menuMeasureSpan.style.fontStretch = computed.fontStretch;
        return menuMeasureSpan;
    };

    const handleResponsiveMenu = (menuEl) => {
        if (!menuEl) return;

        const container = menuEl.closest(".subtitle") || menuEl.closest("footer");
        if (!container) return;

        const measureSpan = getMenuMeasureSpan(menuEl);
        if (!measureSpan) return;

        const containerWidth = container.offsetWidth;

        // Calculate 1ch in pixels
        measureSpan.textContent = "0";
        const oneChWidth = measureSpan.offsetWidth;

        // Ensure horizontal layout for measurement
        menuEl.classList.remove("menu--stacked");
        void menuEl.offsetWidth; // Force reflow

        // Calculate menu width
        const menuItems = menuEl.querySelectorAll(".item, a");
        let menuItemsWidth = 0;
        menuItems.forEach((item) => menuItemsWidth += item.offsetWidth);
        const menuWidth = menuItemsWidth + oneChWidth * (menuItems.length - 1);

        // Get subtitle variants if applicable
        const subtitleContainer = container.classList.contains("subtitle") ? container : null;
        const subtitleTextEl = subtitleContainer?.querySelector("span:first-child");
        const variants = [];

        if (subtitleTextEl) {
            let i = 0;
            while (subtitleTextEl.hasAttribute(`data-subtitle-${i}`)) {
                variants.push(subtitleTextEl.getAttribute(`data-subtitle-${i++}`));
            }
        }

        // If menu alone is wider than container, stack it
        if (menuWidth > containerWidth) {
            if (subtitleTextEl && variants.length > 0) {
                subtitleTextEl.textContent = variants[variants.length - 1];
                subtitleContainer.classList.add("subtitle--stacked");
            }
            menuEl.classList.add("menu--stacked");
            return;
        }

        // Try progressive degradation for subtitle containers
        if (subtitleContainer && subtitleTextEl && variants.length > 0) {
            const gap = oneChWidth * 4;

            for (const variant of variants) {
                measureSpan.textContent = variant;
                if (measureSpan.offsetWidth + gap + menuWidth <= containerWidth) {
                    subtitleTextEl.textContent = variant;
                    subtitleContainer.classList.remove("subtitle--stacked");
                    return;
                }
            }

            // No variant fits - use stacked layout
            subtitleTextEl.textContent = variants[variants.length - 1];
            subtitleContainer.classList.add("subtitle--stacked");
        }
    };

    const handleAllMenus = () => {
        document.querySelectorAll(".menu").forEach(handleResponsiveMenu);
    };

    const debouncedMenuHandler = debounce(handleAllMenus, DEBOUNCE_DELAY);
    handleAllMenus();
    window.addEventListener("resize", debouncedMenuHandler);

    // ============================================================
    // Custom Scrollbar with Visibility State Machine
    // ============================================================

    const createCodeBlockScrollbar = (container, scrollEl) => {
        if (!container || !scrollEl) return;

        // Create scrollbar elements
        const scrollbar = document.createElement("div");
        scrollbar.className = "code-block__custom-scrollbar";
        scrollbar.innerHTML = `
            <div class="code-block__scrollbar-track">
                <div class="code-block__scrollbar-thumb"></div>
            </div>
        `;
        container.appendChild(scrollbar);

        const track = scrollbar.querySelector(".code-block__scrollbar-track");
        const thumb = scrollbar.querySelector(".code-block__scrollbar-thumb");

        // Update thumb size and position
        const updateThumb = () => {
            const { scrollWidth, clientWidth, scrollLeft } = scrollEl;
            if (scrollWidth <= clientWidth) {
                scrollbar.style.display = "none";
                return;
            }
            scrollbar.style.display = "";
            const thumbWidth = (clientWidth / scrollWidth) * track.offsetWidth;
            const maxScroll = scrollWidth - clientWidth;
            const thumbPosition = (scrollLeft / maxScroll) * (track.offsetWidth - thumbWidth);
            thumb.style.width = `${thumbWidth}px`;
            thumb.style.left = `${thumbPosition}px`;
        };

        scrollEl.addEventListener("scroll", updateThumb, { passive: true });
        updateThumb();
        new ResizeObserver(updateThumb).observe(scrollEl);

        // ──────────────────────────────────────────────────────────
        // Visibility State Machine
        // Sources: hover, scroll, touch, drag
        // ──────────────────────────────────────────────────────────

        let isDragging = false;
        const tracker = createEngagementTracker(["hover", "scroll", "touch"], (engaged) => {
            container.classList.toggle("code-block--scrollbar-visible", engaged || isDragging);
        });

        setupHoverEngagement(container, tracker);
        setupScrollEngagement(scrollEl, tracker);

        // Drag: pointerdown/pointerup on thumb (immediate, no delay)
        let dragPointerId = null;

        thumb.addEventListener("pointerdown", (e) => {
            isDragging = true;
            dragPointerId = e.pointerId;
            thumb.setPointerCapture(e.pointerId);
            container.classList.add("code-block--scrollbar-visible");
            e.preventDefault();
        });

        const endDrag = (e) => {
            if (e.pointerId !== dragPointerId) return;
            isDragging = false;
            dragPointerId = null;
            thumb.releasePointerCapture(e.pointerId);
            if (!tracker.isEngaged()) {
                container.classList.remove("code-block--scrollbar-visible");
            }
        };
        thumb.addEventListener("pointerup", endDrag);
        thumb.addEventListener("pointercancel", endDrag);

        // ──────────────────────────────────────────────────────────
        // Drag to scroll functionality
        // ──────────────────────────────────────────────────────────

        let startX = 0;
        let startScrollLeft = 0;

        thumb.addEventListener("pointerdown", (e) => {
            startX = e.clientX;
            startScrollLeft = scrollEl.scrollLeft;
        });

        thumb.addEventListener("pointermove", (e) => {
            if (!isDragging) return;
            const deltaX = e.clientX - startX;
            const maxScroll = scrollEl.scrollWidth - scrollEl.clientWidth;
            const maxThumbPos = track.offsetWidth - thumb.offsetWidth;
            scrollEl.scrollLeft = startScrollLeft + (deltaX / maxThumbPos) * maxScroll;
        });

        // Click on track to jump
        track.addEventListener("click", (e) => {
            if (e.target === thumb) return;
            const rect = track.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / track.offsetWidth;
            scrollEl.scrollLeft = ratio * (scrollEl.scrollWidth - scrollEl.clientWidth);
        });
    };

    // ============================================================
    // Code Block Enhancement
    // ============================================================

    const enhanceCodeBlocks = (root = document) => {
        root.querySelectorAll(".code-block").forEach((container) => {
            if (container.dataset.enhanced === "true") return;
            container.dataset.enhanced = "true";

            const codeScroll = container.querySelector(".code-scroll");
            const languageTag = container.querySelector(".code-language-tag");
            const pre = container.querySelector("pre");
            const code = pre?.querySelector("code");

            // Create scrollbar with visibility state machine
            if (codeScroll) {
                createCodeBlockScrollbar(container, codeScroll);
            }

            // Set up language tag state machine
            if (languageTag && code) {
                setupLanguageTag(languageTag, container, code);
            }
        });
    };

    // ============================================================
    // Language Tag State Machine
    // ============================================================
    // States: idle | ready | copied | error
    // Engagement sources: hover (desktop), scroll (mobile)
    // Labels: idle → language, ready → "copy", copied → "copied!", error → "error"

    const setupLanguageTag = (tag, container, code) => {
        if (tag.dataset.enhanced === "true") return;
        tag.dataset.enhanced = "true";

        const originalLabel = (tag.textContent || "code").trim().toLowerCase();
        const scrollEl = container.querySelector(".code-scroll");

        // ──────────────────────────────────────────────────────────
        // State
        // ──────────────────────────────────────────────────────────

        let state = "idle"; // idle | ready | copied | error
        let labelTimer = null;
        let feedbackTimer = null;

        const labels = { idle: originalLabel, ready: "copy", copied: "copied!", error: "error" };

        const setLabel = (label) => {
            clearTimeout(labelTimer);
            if (tag.textContent.toLowerCase() === label) {
                tag.style.opacity = "1";
                return;
            }
            tag.style.transition = "opacity 0.08s ease";
            tag.style.opacity = "0";
            labelTimer = setTimeout(() => {
                tag.textContent = label;
                tag.style.transition = "opacity 0.17s ease";
                tag.style.opacity = "1";
            }, 80);
        };

        const setState = (newState) => {
            if (state === newState) return;
            state = newState;
            setLabel(labels[newState] || originalLabel);
        };

        // ──────────────────────────────────────────────────────────
        // Engagement tracking
        // ──────────────────────────────────────────────────────────

        const updateFromEngagement = (engaged) => {
            if (state === "copied" || state === "error") return;
            setState(engaged ? "ready" : "idle");
        };

        const tracker = createEngagementTracker(["hover", "scroll", "touch"], updateFromEngagement);
        setupHoverEngagement(container, tracker);
        if (scrollEl) setupScrollEngagement(scrollEl, tracker);

        // ──────────────────────────────────────────────────────────
        // Copy action
        // ──────────────────────────────────────────────────────────

        let longPressTimer = null;
        let longPressState = { start: 0, moved: false, copied: false };

        const doCopy = async (silent = false) => {
            const text = code.innerText || code.textContent || "";
            if (!text) return silent || handleCopyResult(false);
            try {
                const success = await copyToClipboard(text);
                if (success) {
                    longPressState.copied = true;
                    handleCopyResult(true);
                } else if (!silent) {
                    handleCopyResult(false);
                }
            } catch (e) {
                if (!silent) {
                    console.error("Copy failed:", e);
                    handleCopyResult(false);
                }
            }
        };

        const handleCopyResult = (success) => {
            clearTimeout(feedbackTimer);
            setState(success ? "copied" : "error");
            feedbackTimer = setTimeout(() => {
                setState(tracker.isEngaged() ? "ready" : "idle");
            }, COPY_FEEDBACK_DURATION);
        };

        // Prevent native context menu (enables long-press on Android Firefox)
        container.addEventListener("contextmenu", (e) => e.preventDefault());

        // Long-press to copy (hybrid: timer for Android, touchend fallback for iOS)
        container.addEventListener("touchstart", () => {
            longPressState = { start: Date.now(), moved: false, copied: false };
            clearTimeout(longPressTimer);
            longPressTimer = setTimeout(() => doCopy(true), LONG_PRESS_DURATION);
        }, { passive: true });

        container.addEventListener("touchmove", () => {
            longPressState.moved = true;
            clearTimeout(longPressTimer);
        }, { passive: true });

        container.addEventListener("touchend", () => {
            clearTimeout(longPressTimer);
            const { start, moved, copied } = longPressState;
            if (!moved && !copied && Date.now() - start >= LONG_PRESS_DURATION) {
                doCopy();
            }
        });

        container.addEventListener("touchcancel", () => clearTimeout(longPressTimer));

        // Tap on tag: copy immediately (mobile)
        tag.addEventListener("touchend", (e) => {
            e.preventDefault();
            doCopy();
        });

        // Click on tag (desktop)
        tag.addEventListener("click", (e) => {
            e.preventDefault();
            doCopy();
        });
    };

    // ============================================================
    // Table Enhancement
    // ============================================================

    const enhanceTables = (root = document) => {
        root.querySelectorAll(".writing-post table").forEach((table) => {
            if (table.parentElement?.classList.contains("table-wrapper")) return;

            const wrapper = document.createElement("div");
            wrapper.className = "table-wrapper";

            const scrollContainer = document.createElement("div");
            scrollContainer.className = "table-scroll";

            table.parentNode.insertBefore(wrapper, table);
            scrollContainer.appendChild(table);
            wrapper.appendChild(scrollContainer);
        });
    };

    // ============================================================
    // Heading Enhancement & TOC
    // ============================================================

    const ensureElementId = (element, preferredId) => {
        if (!element) return null;
        const existing = (element.getAttribute("id") || "").trim();
        if (existing) return existing;

        let candidate = preferredId || "section";
        let counter = 2;
        while (document.getElementById(candidate)) {
            candidate = `${preferredId || "section"}-${counter++}`;
        }
        element.setAttribute("id", candidate);
        return candidate;
    };

    const renderTableOfContents = (root, headings) => {
        const toc = root.querySelector("[data-toc]");
        if (!toc) return;

        const items = [];
        const introId = headerTitleEl ? ensureElementId(headerTitleEl, "introduction") : null;
        if (introId) items.push({ level: 1, id: introId, label: "Introduction" });

        headings.forEach((h) => {
            const level = parseInt((h.tagName || "").slice(1), 10);
            if (!h.id || isNaN(level) || level < 2 || level > 3) return;

            let label = h.dataset.headingLabel;
            if (!label) {
                label = (h.textContent || "").trim().replace(/^#\s*/, "");
                h.dataset.headingLabel = label;
            }
            items.push({ level, id: h.id, label });
        });

        if (!items.length) {
            toc.innerHTML = "";
            toc.classList.add("is-empty");
            return;
        }

        toc.classList.remove("is-empty");
        const list = document.createElement("ol");
        list.className = "writing-toc__list";
        toc.innerHTML = "";
        toc.appendChild(list);

        let currentSection = null;

        items.forEach((item) => {
            const li = document.createElement("li");
            li.className = `writing-toc__item writing-toc__item--level-${item.level}`;

            const link = document.createElement("a");
            link.href = `#${item.id}`;
            link.textContent = item.label;
            li.appendChild(link);

            if (item.level <= 2) {
                list.appendChild(li);
                currentSection = item.level === 2 ? li : null;
            } else if (item.level === 3) {
                if (!currentSection) {
                    list.appendChild(li);
                    currentSection = li;
                } else {
                    let sublist = currentSection.querySelector("ol");
                    if (!sublist) {
                        sublist = document.createElement("ol");
                        sublist.className = "writing-toc__sublist";
                        currentSection.appendChild(sublist);
                    }
                    sublist.appendChild(li);
                }
            }
        });
    };

    const enhanceHeadings = (root = document) => {
        const headings = root.querySelectorAll("h2, h3");
        if (!headings.length) {
            renderTableOfContents(root, headings);
            return;
        }

        const existingIds = new Set(
            Array.from(document.querySelectorAll("[id]")).map((el) => el.id)
        );

        headings.forEach((heading) => {
            let label = heading.dataset.headingLabel;
            if (!label) {
                label = (heading.textContent || "section").trim().replace(/^#\s*/, "");
                heading.dataset.headingLabel = label;
            }

            if (heading.dataset.headingEnhanced === "true") return;

            // Ensure ID
            let id = (heading.getAttribute("id") || "").trim();
            if (!id) {
                const baseSlug = slugify(label) || "section";
                let candidate = baseSlug;
                let counter = 2;
                while (existingIds.has(candidate)) {
                    candidate = `${baseSlug}-${counter++}`;
                }
                id = candidate;
                heading.setAttribute("id", id);
                existingIds.add(id);
            }

            // Add anchor link
            if (!heading.querySelector(".heading-anchor")) {
                const anchor = document.createElement("a");
                anchor.className = "heading-anchor";
                anchor.href = `#${id}`;
                anchor.textContent = "#";

                // Find last text node and wrap with anchor
                const textNodes = [];
                const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
                let node;
                while ((node = walker.nextNode())) {
                    if (node.textContent.trim()) textNodes.push(node);
                }

                if (textNodes.length > 0) {
                    const lastNode = textNodes[textNodes.length - 1];
                    const text = lastNode.textContent.trimEnd();
                    const lastSpaceIdx = text.lastIndexOf(" ");
                    const beforeLast = text.slice(0, lastSpaceIdx + 1);
                    const lastWord = text.slice(lastSpaceIdx + 1);

                    if (lastWord) {
                        const wrapper = document.createElement("span");
                        wrapper.style.whiteSpace = "nowrap";
                        wrapper.textContent = lastWord;
                        wrapper.appendChild(anchor);
                        lastNode.textContent = beforeLast;
                        lastNode.parentNode.insertBefore(wrapper, lastNode.nextSibling);
                    } else {
                        heading.appendChild(anchor);
                    }
                } else {
                    heading.appendChild(anchor);
                }
            }

            heading.dataset.headingEnhanced = "true";
        });

        renderTableOfContents(root, headings);
        positionSidenotes(root);
    };

    // ============================================================
    // Sidenote Positioning
    // ============================================================

    const positionSidenotes = (root = document) => {
        const rail = root.querySelector(".writing-post__rail-right");
        const content = root.querySelector(".writing-post__content");
        if (!rail || !content) return;

        // Check if sidenotes are displayed (desktop only)
        const testNote = rail.querySelector(".sidenote--rail");
        if (testNote && window.getComputedStyle(testNote).display === "none") return;

        const labels = Array.from(content.querySelectorAll("label.sidenote-number"));
        if (!labels.length) return;

        const contentRect = content.getBoundingClientRect();
        const positions = [];

        labels.forEach((label) => {
            const labelId = label.getAttribute("for");
            if (!labelId) return;

            const sidenote = rail.querySelector(`.sidenote--rail[data-sidenote-ref="${labelId}"]`);
            if (!sidenote) return;

            const labelParent = label.parentElement;
            if (!labelParent) return;

            const parentRect = labelParent.getBoundingClientRect();
            const parentStyles = window.getComputedStyle(labelParent);
            const lineHeight = resolveLineHeight(parentStyles);

            const labelRect = label.getBoundingClientRect();
            const lineIndex = Math.round((labelRect.top - parentRect.top) / lineHeight);
            const relativeTop = parentRect.top - contentRect.top + lineIndex * lineHeight;

            positions.push({ sidenote, idealTop: relativeTop, height: 0 });
        });

        // Position with stacking
        positions.forEach((pos, idx) => {
            pos.sidenote.style.top = `${pos.idealTop}px`;
            pos.height = pos.sidenote.getBoundingClientRect().height;

            const styles = window.getComputedStyle(pos.sidenote);
            const gap = resolveLineHeight(styles) * 0.5;

            for (let i = 0; i < idx; i++) {
                const prev = positions[i];
                const prevTop = parseFloat(prev.sidenote.style.top) || 0;
                const prevBottom = prevTop + prev.height;
                const currentTop = parseFloat(pos.sidenote.style.top) || 0;

                if (currentTop < prevBottom + gap) {
                    const adjusted = prevBottom + gap;
                    pos.sidenote.style.top = `${adjusted}px`;
                    pos.idealTop = adjusted;
                }
            }
        });
    };

    const debouncedSidenotePosition = debounce(() => positionSidenotes(document), DEBOUNCE_DELAY);
    window.addEventListener("resize", debouncedSidenotePosition);

    // ============================================================
    // Selection Context Management
    // ============================================================

    let activeSelectionContainer = null;
    let selectionPointerDown = false;

    const findSelectionContainer = (target) => {
        if (!target || !(target instanceof Node)) return null;
        if (target.nodeType === Node.TEXT_NODE) target = target.parentNode;
        if (!target || !(target instanceof Element)) return null;

        return target.closest(".sidenote") ||
               target.closest(".math-display") ||
               target.closest("table") ||
               target.closest(".writing-post__content") ||
               null;
    };

    const activateSelectionContainer = (container) => {
        if (activeSelectionContainer === container) return;
        activeSelectionContainer?.removeAttribute("data-selection-active");
        activeSelectionContainer = container || null;

        if (!activeSelectionContainer) {
            document.body.removeAttribute("data-selection-lock");
            return;
        }
        activeSelectionContainer.setAttribute("data-selection-active", "true");
        document.body.setAttribute("data-selection-lock", "true");
    };

    const resetSelectionContext = () => {
        activeSelectionContainer?.removeAttribute("data-selection-active");
        activeSelectionContainer = null;
        document.body.removeAttribute("data-selection-lock");
        selectionPointerDown = false;
    };

    document.addEventListener("pointerdown", (e) => {
        const container = findSelectionContainer(e.target);
        if (container) {
            activateSelectionContainer(container);
            selectionPointerDown = true;
        } else {
            resetSelectionContext();
        }
    }, { capture: true });

    document.addEventListener("pointerup", () => {
        selectionPointerDown = false;
        const selection = document.getSelection?.();
        if (!selection || selection.isCollapsed) resetSelectionContext();
    });

    document.addEventListener("pointercancel", resetSelectionContext);
    window.addEventListener("blur", resetSelectionContext);

    document.addEventListener("selectionchange", () => {
        const selection = document.getSelection?.();
        if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
            if (!selectionPointerDown) resetSelectionContext();
            return;
        }
        const container = findSelectionContainer(selection.anchorNode) ||
                          findSelectionContainer(selection.focusNode);
        if (container) {
            activateSelectionContainer(container);
        } else if (!selectionPointerDown) {
            resetSelectionContext();
        }
    });

    // Prevent image dragging
    document.addEventListener("dragstart", (e) => {
        if (e.target.tagName === "IMG") {
            e.preventDefault();
            return false;
        }
    });

    // ============================================================
    // Routing
    // ============================================================

    let currentLoadedPath = null;

    const resolveRoute = (rawPath) => {
        const path = normalizePath(rawPath);
        if (ROUTES[path]) return ROUTES[path];

        if (path.startsWith("/writing/") && path.length > "/writing/".length) {
            const slug = path.slice("/writing/".length).replace(/\/+/g, "").replace(/\.html$/i, "");
            if (slug) {
                return {
                    fragment: `_content/writing/${slug}.html`,
                    documentTitle: null,
                    canonicalPath: `/writing/${slug}`
                };
            }
        }
        return null;
    };

    const applyHeaderFromContent = (route) => {
        const meta = contentEl.querySelector("[data-page-title]");
        if (meta) {
            const title = (meta.getAttribute("data-page-title") || "").trim();
            const variants = [];
            let i = 0;
            while (meta.hasAttribute(`data-page-subtitle-${i}`)) {
                const v = (meta.getAttribute(`data-page-subtitle-${i++}`) || "").trim();
                if (v) variants.push(v);
            }
            if (!variants.length) {
                const single = (meta.getAttribute("data-page-subtitle") || "").trim();
                if (single) variants.push(single);
            }

            setHeader(
                title || defaultHeader.title,
                variants.length ? variants : defaultHeader.subtitleVariants
            );
            if (!route.documentTitle && title) {
                document.title = `${title} - ${SITE_NAME}`;
            }
            handleAllMenus();
            return;
        }

        if (route?.heading) {
            setHeader(route.heading.title, route.heading.subtitle);
            handleAllMenus();
            return;
        }

        setHeader(defaultHeader.title, defaultHeader.subtitleVariants);
        handleAllMenus();
    };

    const scrollToHeadingById = (id, animate = true) => {
        if (!id) return false;
        const target = document.getElementById(id);
        if (!target) return false;
        target.scrollIntoView({
            behavior: animate ? "smooth" : "auto",
            block: "start",
            inline: "nearest"
        });
        return true;
    };

    const loadRoute = async (targetPath, pushState = true) => {
        const path = normalizePath(targetPath);
        const route = resolveRoute(path);

        if (!route?.fragment) {
            console.error(`No route found for: ${path}`);
            contentEl.innerHTML = "<p>Page not found.</p>";
            document.title = `Not Found - ${SITE_NAME}`;
            setHeader(defaultHeader.title, defaultHeader.subtitleVariants);
            return null;
        }

        const canonicalPath = route.canonicalPath || path;
        const fragmentPath = route.fragment.startsWith("/") ? route.fragment : `/${route.fragment}`;

        try {
            const response = await fetch(fragmentPath);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const html = await response.text();
            contentEl.style.opacity = "0";
            await delay(FADE_DURATION);

            contentEl.innerHTML = html;
            resetSelectionContext();
            enhanceTables(contentEl);
            enhanceCodeBlocks(contentEl);
            enhanceHeadings(contentEl);
            applyHeaderFromContent(route);

            if (route.documentTitle) document.title = route.documentTitle;

            if (pushState) {
                history.pushState({ path: canonicalPath, hash: null }, document.title, canonicalPath);
                window.scrollTo(0, 0);
            }

            currentLoadedPath = canonicalPath;
            contentEl.style.opacity = "1";
            return canonicalPath;
        } catch (error) {
            console.error("Error loading content:", error);

            if (path.startsWith("/writing/") && path !== "/writing") {
                console.log("Writing page not found, redirecting to /writing");
                return loadRoute("/writing", pushState);
            }

            contentEl.innerHTML = `<p>Error loading page: ${error.message}</p>`;
            document.title = `Error - ${SITE_NAME}`;
            setHeader(defaultHeader.title, defaultHeader.subtitleVariants);
            contentEl.style.opacity = "1";
            return null;
        }
    };

    // ============================================================
    // Event Handlers
    // ============================================================

    // Content link clicks
    contentEl.addEventListener("click", (e) => {
        const anchor = e.target.closest("a");
        if (!anchor) return;
        if (anchor.target && anchor.target !== "_self") return;
        if (anchor.hasAttribute("download") || anchor.getAttribute("rel") === "external") return;

        const href = anchor.getAttribute("href");
        if (!href) return;

        // Hash links
        if (href.startsWith("#")) {
            const targetId = href.slice(1);
            if (!targetId) return;
            e.preventDefault();
            const canonicalPath = normalizePath(window.location.pathname);
            history.pushState({ path: canonicalPath, hash: targetId }, document.title, `${window.location.pathname}#${targetId}`);
            scrollToHeadingById(targetId);
            return;
        }

        // Internal links
        const url = new URL(anchor.href, window.location.origin);
        if (url.origin !== window.location.origin) return;

        const path = normalizePath(url.pathname);
        if (!resolveRoute(path)) return;

        e.preventDefault();
        const hash = url.hash ? url.hash.slice(1) : null;
        loadRoute(path).then((canonicalPath) => {
            if (hash) {
                const finalPath = canonicalPath || path;
                history.replaceState({ path: finalPath, hash }, document.title, `${finalPath}#${hash}`);
                scrollToHeadingById(hash);
            }
        });
    });

    // Browser navigation
    window.addEventListener("popstate", (e) => {
        const targetPath = e.state?.path || normalizePath(window.location.pathname);
        const targetHash = e.state?.hash || (window.location.hash ? window.location.hash.slice(1) : null);

        if (targetPath === currentLoadedPath) {
            if (targetHash) {
                scrollToHeadingById(targetHash);
            } else {
                window.scrollTo({ top: 0, behavior: "smooth" });
            }
            return;
        }

        loadRoute(targetPath, false).then(() => {
            if (targetHash) {
                requestAnimationFrame(() => scrollToHeadingById(targetHash));
            } else {
                window.scrollTo({ top: 0, behavior: "smooth" });
            }
        });
    });

    window.addEventListener("hashchange", () => {
        const hash = window.location.hash ? window.location.hash.slice(1) : null;
        if (hash) {
            requestAnimationFrame(() => scrollToHeadingById(hash));
        } else {
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    });

    // ============================================================
    // Vim-Style Navigation
    // ============================================================

    const navOverlay = document.getElementById("navOverlay");
    const navItemsContainer = document.getElementById("navItems");
    const keyBufferEl = document.getElementById("keyBuffer");
    const navInput = document.getElementById("navInput");

    // Static shortcut items (in HTML)
    const shortcutItems = Array.from(document.querySelectorAll(".nav-item[data-shortcut]"));
    const searchActionItem = document.querySelector(".nav-item[data-action='search']");

    // State
    let navMode = "shortcut"; // "shortcut" | "search"
    let keyBuffer = "";
    let cursorPos = 0;
    let searchQuery = "";
    let searchCursorPos = 0;
    let navSelectedIndex = 0;
    let searchIndex = null;
    let searchResultElements = [];

    // Fetch search index
    fetch("/_content/search-index.json")
        .then(r => r.json())
        .then(data => { searchIndex = data; })
        .catch(() => { searchIndex = []; });

    const getVisibleItems = () => {
        if (navMode === "search") {
            return searchResultElements.filter(el => !el.classList.contains("nav-item--hidden"));
        }
        return [searchActionItem, ...shortcutItems].filter(Boolean);
    };

    // Truncate text to fit container, trimming trailing spaces before ellipsis
    const truncateLabel = (el) => {
        const fullText = el.dataset.fullText || el.textContent;
        el.dataset.fullText = fullText;
        el.textContent = fullText;

        if (el.scrollWidth <= el.clientWidth) return;

        // Binary search for the right length
        let lo = 0, hi = fullText.length;
        while (lo < hi) {
            const mid = Math.ceil((lo + hi) / 2);
            el.textContent = fullText.slice(0, mid).trimEnd() + "…";
            if (el.scrollWidth <= el.clientWidth) {
                lo = mid;
            } else {
                hi = mid - 1;
            }
        }
        el.textContent = fullText.slice(0, lo).trimEnd() + "…";
    };

    // Fuzzy match: returns score (higher = better) or -1 if no match
    const fuzzyMatch = (query, target) => {
        const q = query.toLowerCase();
        const t = target.toLowerCase();
        if (!q) return 0;

        let qi = 0;
        let score = 0;
        let lastMatchIdx = -1;
        let consecutiveBonus = 0;

        for (let ti = 0; ti < t.length && qi < q.length; ti++) {
            if (t[ti] === q[qi]) {
                // Base score for match
                score += 1;
                // Bonus for consecutive matches
                if (lastMatchIdx === ti - 1) {
                    consecutiveBonus += 2;
                    score += consecutiveBonus;
                } else {
                    consecutiveBonus = 0;
                }
                // Bonus for match at start or after word boundary
                if (ti === 0 || /[\s\-_.]/.test(t[ti - 1])) {
                    score += 5;
                }
                lastMatchIdx = ti;
                qi++;
            }
        }

        // All query chars must match
        return qi === q.length ? score : -1;
    };

    const renderSearchResults = () => {
        // Clear previous search results
        searchResultElements.forEach(el => el.remove());
        searchResultElements = [];

        if (!searchIndex) return;

        const query = searchQuery.toLowerCase();

        // Fuzzy filter and score
        const scored = query
            ? searchIndex
                .map(entry => ({ entry, score: fuzzyMatch(query, entry.title) }))
                .filter(x => x.score >= 0)
            : searchIndex.map(entry => ({ entry, score: 0 }));

        // Sort: by score descending, then pages first, then alphabetically
        const sorted = scored.sort((a, b) => {
            if (a.score !== b.score) return b.score - a.score;
            if (a.entry.type !== b.entry.type) {
                return a.entry.type === "page" ? -1 : 1;
            }
            return a.entry.title.toLowerCase().localeCompare(b.entry.title.toLowerCase());
        });

        // Handle no results
        if (query && sorted.length === 0) {
            const div = document.createElement("div");
            div.className = "nav-item nav-item--empty";
            div.innerHTML = '<span class="nav-label">No results</span>';
            navItemsContainer.appendChild(div);
            searchResultElements.push(div);
            return;
        }

        sorted.forEach(({ entry }) => {
            const div = document.createElement("div");
            div.className = "nav-item nav-item--search-result";
            if (entry.type === "header") {
                div.classList.add("nav-item--header");
            }
            div.dataset.href = entry.path;

            const label = document.createElement("span");
            label.className = "nav-label";
            label.textContent = entry.title;
            div.appendChild(label);

            if (entry.type === "header" && entry.page) {
                const pageHint = document.createElement("span");
                pageHint.className = "nav-page-hint";
                pageHint.textContent = entry.page;
                div.appendChild(pageHint);
            }

            div.addEventListener("click", () => navigateTo(entry.path));
            div.addEventListener("mouseenter", () => {
                const idx = getVisibleItems().indexOf(div);
                if (idx !== -1) {
                    navSelectedIndex = idx;
                    updateSelection();
                }
            });

            navItemsContainer.appendChild(div);
            searchResultElements.push(div);
        });

        // Truncate labels after they're in the DOM
        searchResultElements.forEach(el => {
            const label = el.querySelector(".nav-label");
            const pageHint = el.querySelector(".nav-page-hint");
            if (label) truncateLabel(label);
            if (pageHint) truncateLabel(pageHint);
        });
    };

    const updateSelection = () => {
        const allItems = [...shortcutItems, searchActionItem, ...searchResultElements].filter(Boolean);
        allItems.forEach(item => item.classList.remove("selected"));

        const visible = getVisibleItems();
        if (visible[navSelectedIndex]) {
            visible[navSelectedIndex].classList.add("selected");
            visible[navSelectedIndex].scrollIntoView({ block: "nearest" });
        }
    };

    const updateDisplay = () => {
        // Update buffer display with cursor
        if (keyBufferEl) {
            const text = navMode === "search" ? "/" + searchQuery : keyBuffer;
            const pos = navMode === "search" ? searchCursorPos + 1 : cursorPos; // +1 for "/" prefix
            const before = text.slice(0, pos);
            const cursorChar = text[pos] || "";
            const after = text.slice(pos + 1);

            keyBufferEl.innerHTML = "";
            keyBufferEl.classList.toggle("typing", text.length > 0);

            if (before) {
                keyBufferEl.appendChild(document.createTextNode(before));
            }
            const cursorSpan = document.createElement("span");
            cursorSpan.className = "key-cursor";
            cursorSpan.textContent = cursorChar;
            keyBufferEl.appendChild(cursorSpan);
            if (after) {
                keyBufferEl.appendChild(document.createTextNode(after));
            }

            // Scroll to keep cursor visible
            const scrollContainer = keyBufferEl.parentElement;
            if (scrollContainer && cursorSpan) {
                const containerRect = scrollContainer.getBoundingClientRect();
                const cursorRect = cursorSpan.getBoundingClientRect();
                if (cursorRect.right > containerRect.right) {
                    scrollContainer.scrollLeft += cursorRect.right - containerRect.right;
                } else if (cursorRect.left < containerRect.left) {
                    scrollContainer.scrollLeft -= containerRect.left - cursorRect.left;
                }
            }
        }

        // Toggle visibility of shortcut items vs search results
        const inSearch = navMode === "search";
        shortcutItems.forEach(item => item.classList.toggle("nav-item--hidden", inSearch));
        if (searchActionItem) searchActionItem.classList.toggle("nav-item--hidden", inSearch);

        if (inSearch) {
            renderSearchResults();
        } else {
            searchResultElements.forEach(el => el.remove());
            searchResultElements = [];
        }

        // Clamp selection
        const visible = getVisibleItems();
        if (navSelectedIndex >= visible.length) {
            navSelectedIndex = Math.max(0, visible.length - 1);
        }

        updateSelection();
    };

    const syncInputToState = () => {
        if (navInput) {
            navInput.value = searchQuery;
            navInput.setSelectionRange(searchCursorPos, searchCursorPos);
        }
    };

    const enterSearchMode = () => {
        navMode = "search";
        searchQuery = "";
        searchCursorPos = 0;
        navSelectedIndex = 0;
        navOverlay?.classList.add("search-mode");
        syncInputToState();
        navInput?.focus();
        updateDisplay();
    };

    const exitSearchMode = () => {
        navMode = "shortcut";
        searchQuery = "";
        searchCursorPos = 0;
        navSelectedIndex = 0;
        navOverlay?.classList.remove("search-mode");
        navInput?.blur();
        updateDisplay();
    };

    const resetState = () => {
        navMode = "shortcut";
        keyBuffer = "";
        cursorPos = 0;
        searchQuery = "";
        searchCursorPos = 0;
        navSelectedIndex = 0;
        if (navInput) navInput.value = "";
        updateDisplay();
    };

    const openNav = () => {
        if (!navOverlay) return;
        resetState();
        navOverlay.classList.add("active");
    };

    const closeNav = () => {
        if (!navOverlay) return;
        navOverlay.classList.remove("active", "search-mode");
        navInput?.blur();
        resetState();
    };

    const navigateTo = (path) => {
        closeNav();
        const currentPath = normalizePath(window.location.pathname);
        const currentHash = window.location.hash;
        const [targetPath, targetHash] = path.split("#");
        const normalizedTarget = normalizePath(targetPath);

        if (normalizedTarget !== currentPath) {
            loadRoute(normalizedTarget).then(() => {
                if (targetHash) {
                    requestAnimationFrame(() => scrollToHeadingById(targetHash));
                }
            });
        } else if (targetHash) {
            scrollToHeadingById(targetHash);
        }
    };

    // Click handlers for shortcut items
    shortcutItems.forEach((item) => {
        item.addEventListener("click", () => navigateTo(item.dataset.href));
        item.addEventListener("mouseenter", () => {
            const idx = getVisibleItems().indexOf(item);
            if (idx !== -1) {
                navSelectedIndex = idx;
                updateSelection();
            }
        });
    });

    // Search action item click
    if (searchActionItem) {
        searchActionItem.addEventListener("click", enterSearchMode);
        searchActionItem.addEventListener("mouseenter", () => {
            const idx = getVisibleItems().indexOf(searchActionItem);
            if (idx !== -1) {
                navSelectedIndex = idx;
                updateSelection();
            }
        });
    }

    // Nav trigger click
    const navTrigger = document.getElementById("navTrigger");
    if (navTrigger) {
        navTrigger.addEventListener("click", openNav);
    }

    // Click outside to close
    if (navOverlay) {
        navOverlay.addEventListener("click", (e) => {
            if (e.target === navOverlay) closeNav();
        });
    }

    // Handle input events for mobile keyboard support
    if (navInput) {
        navInput.addEventListener("input", () => {
            if (navMode !== "search") return;
            searchQuery = navInput.value;
            searchCursorPos = navInput.selectionStart || searchQuery.length;
            navSelectedIndex = 0;
            updateDisplay();
        });

        navInput.addEventListener("keydown", (e) => {
            if (navMode !== "search") return;

            // Handle special keys that shouldn't go through normal input
            if (e.key === "Escape") {
                e.preventDefault();
                exitSearchMode();
                return;
            }
            if (e.key === "Enter") {
                e.preventDefault();
                const visible = getVisibleItems();
                if (visible[navSelectedIndex]?.dataset.href) {
                    navigateTo(visible[navSelectedIndex].dataset.href);
                }
                return;
            }
            if (e.key === "ArrowDown") {
                e.preventDefault();
                const visible = getVisibleItems();
                if (visible.length > 0) {
                    navSelectedIndex = (navSelectedIndex + 1) % visible.length;
                    updateSelection();
                }
                return;
            }
            if (e.key === "ArrowUp") {
                e.preventDefault();
                const visible = getVisibleItems();
                if (visible.length > 0) {
                    navSelectedIndex = (navSelectedIndex - 1 + visible.length) % visible.length;
                    updateSelection();
                }
                return;
            }
        });

        // Sync cursor position on selection change
        navInput.addEventListener("selectionchange", () => {
            if (navMode === "search" && document.activeElement === navInput) {
                searchCursorPos = navInput.selectionStart || 0;
                updateDisplay();
            }
        });
    }

    // Keyboard handling
    document.addEventListener("keydown", (e) => {
        // Don't trigger when typing in inputs (except our nav input which is handled above)
        if (e.target.matches("input, textarea, [contenteditable]") && e.target !== navInput) return;
        if (e.target === navInput) return; // Handled by navInput's own keydown listener

        const isNavOpen = navOverlay?.classList.contains("active");

        // Open with : or ?
        if ((e.key === ":" || e.key === "?") && !isNavOpen) {
            e.preventDefault();
            openNav();
            return;
        }

        // Escape handling
        if (e.key === "Escape") {
            if (!isNavOpen) return;
            e.preventDefault();
            if (navMode === "search") {
                exitSearchMode();
            } else {
                closeNav();
            }
            return;
        }

        // Ignore modifier keys
        if (["Control", "Alt", "Meta", "Shift", "CapsLock", "Tab"].includes(e.key)) return;
        if (e.ctrlKey || e.altKey || e.metaKey) return;

        if (isNavOpen) {
            // Enter search mode with /
            if (e.key === "/" && navMode === "shortcut") {
                e.preventDefault();
                enterSearchMode();
                return;
            }

            const visible = getVisibleItems();

            if (navMode === "search") {
                e.preventDefault();

                // Backspace in search mode - delete before cursor
                if (e.key === "Backspace") {
                    if (searchCursorPos > 0) {
                        searchQuery = searchQuery.slice(0, searchCursorPos - 1) + searchQuery.slice(searchCursorPos);
                        searchCursorPos--;
                        navSelectedIndex = 0;
                        updateDisplay();
                    } else if (searchQuery.length === 0) {
                        exitSearchMode();
                    }
                    return;
                }

                // Delete key - delete at cursor
                if (e.key === "Delete") {
                    if (searchCursorPos < searchQuery.length) {
                        searchQuery = searchQuery.slice(0, searchCursorPos) + searchQuery.slice(searchCursorPos + 1);
                        navSelectedIndex = 0;
                        updateDisplay();
                    }
                    return;
                }

                // Left/right arrow for cursor movement
                if (e.key === "ArrowLeft") {
                    if (searchCursorPos > 0) {
                        searchCursorPos--;
                        updateDisplay();
                    }
                    return;
                }
                if (e.key === "ArrowRight") {
                    if (searchCursorPos < searchQuery.length) {
                        searchCursorPos++;
                        updateDisplay();
                    }
                    return;
                }

                // Up/down arrow for list navigation
                if (e.key === "ArrowDown") {
                    if (visible.length > 0) {
                        navSelectedIndex = (navSelectedIndex + 1) % visible.length;
                        updateSelection();
                    }
                    return;
                }
                if (e.key === "ArrowUp") {
                    if (visible.length > 0) {
                        navSelectedIndex = (navSelectedIndex - 1 + visible.length) % visible.length;
                        updateSelection();
                    }
                    return;
                }

                // Enter to select
                if (e.key === "Enter") {
                    if (visible[navSelectedIndex]?.dataset.href) {
                        navigateTo(visible[navSelectedIndex].dataset.href);
                    }
                    return;
                }

                // Insert character at cursor position
                if (e.key.length === 1) {
                    searchQuery = searchQuery.slice(0, searchCursorPos) + e.key + searchQuery.slice(searchCursorPos);
                    searchCursorPos++;
                    navSelectedIndex = 0;
                    updateDisplay();
                }
                return;
            }

            // Shortcut mode

            // j/k navigation
            if (e.key === "j" || e.key === "ArrowDown") {
                e.preventDefault();
                if (visible.length > 0) {
                    navSelectedIndex = (navSelectedIndex + 1) % visible.length;
                    keyBuffer = "";
                    cursorPos = 0;
                    updateDisplay();
                }
                return;
            }
            if (e.key === "k" || e.key === "ArrowUp") {
                e.preventDefault();
                if (visible.length > 0) {
                    navSelectedIndex = (navSelectedIndex - 1 + visible.length) % visible.length;
                    keyBuffer = "";
                    cursorPos = 0;
                    updateDisplay();
                }
                return;
            }

            // Left/right arrow for cursor movement
            if (e.key === "ArrowLeft") {
                e.preventDefault();
                if (cursorPos > 0) {
                    cursorPos--;
                    updateDisplay();
                }
                return;
            }
            if (e.key === "ArrowRight") {
                e.preventDefault();
                if (cursorPos < keyBuffer.length) {
                    cursorPos++;
                    updateDisplay();
                }
                return;
            }

            if (e.key === "Enter") {
                e.preventDefault();
                const selected = visible[navSelectedIndex];
                if (selected?.dataset.href) {
                    navigateTo(selected.dataset.href);
                } else if (selected?.dataset.action === "search") {
                    enterSearchMode();
                }
                return;
            }

            // Backspace - delete before cursor
            if (e.key === "Backspace") {
                e.preventDefault();
                if (cursorPos > 0) {
                    keyBuffer = keyBuffer.slice(0, cursorPos - 1) + keyBuffer.slice(cursorPos);
                    cursorPos--;
                    updateDisplay();
                }
                return;
            }

            // Delete - delete at cursor
            if (e.key === "Delete") {
                e.preventDefault();
                if (cursorPos < keyBuffer.length) {
                    keyBuffer = keyBuffer.slice(0, cursorPos) + keyBuffer.slice(cursorPos + 1);
                    updateDisplay();
                }
                return;
            }

            // Only add printable characters to buffer
            if (e.key.length !== 1) return;

            // Insert at cursor position
            keyBuffer = keyBuffer.slice(0, cursorPos) + e.key + keyBuffer.slice(cursorPos);
            cursorPos++;
            updateDisplay();

            // Check for shortcut matches
            for (const item of shortcutItems) {
                if (item.dataset.shortcut === keyBuffer) {
                    navigateTo(item.dataset.href);
                    return;
                }
            }
        } else {
            // Direct shortcuts when overlay is closed
            keyBuffer += e.key;

            if (keyBuffer === "gh") {
                navigateTo("/");
                keyBuffer = "";
            } else if (keyBuffer === "gp") {
                navigateTo("/projects");
                keyBuffer = "";
            } else if (keyBuffer === "gw") {
                navigateTo("/writing");
                keyBuffer = "";
            } else if (keyBuffer === "gg") {
                window.scrollTo({ top: 0, behavior: "smooth" });
                keyBuffer = "";
            } else if (e.key === "G") {
                window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
                keyBuffer = "";
            } else if (e.key === "j") {
                window.scrollBy({ top: 100, behavior: "smooth" });
                keyBuffer = "";
            } else if (e.key === "k") {
                window.scrollBy({ top: -100, behavior: "smooth" });
                keyBuffer = "";
            } else if (e.key === "/") {
                e.preventDefault();
                openNav();
                enterSearchMode();
                keyBuffer = "";
            }
        }
    });

    // ============================================================
    // Initial Load
    // ============================================================

    const initialPath = normalizePath(window.location.pathname);
    const initialRoute = resolveRoute(initialPath);

    if (!initialRoute) {
        loadRoute("/", false).then(() => {
            history.replaceState({ path: "/", hash: null }, SITE_NAME, "/");
        });
        return;
    }

    const initialHash = window.location.hash ? window.location.hash.slice(1) : null;
    loadRoute(initialPath, false).then((canonicalPath) => {
        const pathForState = canonicalPath || normalizePath(initialPath);
        history.replaceState(
            { path: pathForState, hash: initialHash },
            document.title,
            initialHash ? `${pathForState}#${initialHash}` : pathForState
        );
        if (initialHash) {
            requestAnimationFrame(() => scrollToHeadingById(initialHash, false));
        }
    });
});
