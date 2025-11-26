document.addEventListener("DOMContentLoaded", () => {
    // ============================================================
    // Constants & Configuration
    // ============================================================

    const SITE_NAME = "David Wang";
    const FADE_DURATION = 150;
    const DEBOUNCE_DELAY = 10;
    const COPY_FEEDBACK_DURATION = 1500;
    const HOVER_REMOVAL_DELAY = 900;

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

    const navLinks = Array.from(document.querySelectorAll(".subtitle .menu a.item"));
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
    // Custom Scrollbar
    // ============================================================

    const createCustomScrollbar = (container, scrollEl) => {
        if (!container || !scrollEl) return;

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

        const updateScrollbar = () => {
            const { scrollWidth, clientWidth, scrollLeft } = scrollEl;
            if (scrollWidth <= clientWidth) {
                scrollbar.style.display = "none";
                return;
            }

            scrollbar.style.display = "block";
            const thumbWidth = (clientWidth / scrollWidth) * track.offsetWidth;
            const maxScroll = scrollWidth - clientWidth;
            const thumbPosition = (scrollLeft / maxScroll) * (track.offsetWidth - thumbWidth);

            thumb.style.width = `${thumbWidth}px`;
            thumb.style.left = `${thumbPosition}px`;
        };

        scrollEl.addEventListener("scroll", updateScrollbar, { passive: true });

        // Drag functionality
        let isDragging = false;
        let startX = 0;
        let startScrollLeft = 0;

        thumb.addEventListener("pointerdown", (e) => {
            isDragging = true;
            startX = e.clientX;
            startScrollLeft = scrollEl.scrollLeft;
            thumb.setPointerCapture(e.pointerId);
            e.preventDefault();
        });

        thumb.addEventListener("pointermove", (e) => {
            if (!isDragging) return;
            const deltaX = e.clientX - startX;
            const maxScroll = scrollEl.scrollWidth - scrollEl.clientWidth;
            const maxThumbPos = track.offsetWidth - thumb.offsetWidth;
            scrollEl.scrollLeft = startScrollLeft + (deltaX / maxThumbPos) * maxScroll;
        });

        const endDrag = (e) => {
            if (!isDragging) return;
            isDragging = false;
            thumb.releasePointerCapture(e.pointerId);
        };
        thumb.addEventListener("pointerup", endDrag);
        thumb.addEventListener("pointercancel", endDrag);

        // Click on track to jump
        track.addEventListener("click", (e) => {
            if (e.target === thumb) return;
            const rect = track.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / track.offsetWidth;
            scrollEl.scrollLeft = ratio * (scrollEl.scrollWidth - scrollEl.clientWidth);
        });

        updateScrollbar();
        new ResizeObserver(updateScrollbar).observe(scrollEl);
    };

    // ============================================================
    // Code Block Enhancement
    // ============================================================

    const enhanceCodeBlocks = (root = document) => {
        // Create scrollbars for code blocks
        root.querySelectorAll(".code-block").forEach((container) => {
            const codeScroll = container.querySelector(".code-scroll");
            if (codeScroll && !container.querySelector(".code-block__custom-scrollbar")) {
                createCustomScrollbar(container, codeScroll);
            }
        });

        // Enhance language tags with copy functionality
        root.querySelectorAll(".code-language-tag").forEach((tag) => {
            if (tag.dataset.enhanced === "true") return;

            const container = tag.closest(".code-block");
            const pre = container?.querySelector("pre") || tag.closest("pre");
            const code = pre?.querySelector("code");
            if (!pre || !code) return;

            tag.tabIndex = tag.tabIndex ?? 0;
            tag.setAttribute("role", "button");

            const originalLabel = (tag.textContent || "code").trim().toLowerCase();
            tag.dataset.originalLabel = originalLabel;
            tag.dataset.enhanced = "true";

            const codeScroll = container?.querySelector(".code-scroll");
            const hoverTarget = container || pre;

            // State
            let state = { hover: false, focus: false, touch: false, feedbackTimer: null };
            let hoverTimer = null;
            let labelTimer = null;

            const setHoverClass = (show, delay = 0) => {
                clearTimeout(hoverTimer);
                if (show) {
                    hoverTimer = setTimeout(() => container?.classList.add("code-block--hover"), delay);
                } else {
                    hoverTimer = setTimeout(() => {
                        if (!state.hover && !state.focus) {
                            container?.classList.remove("code-block--hover");
                        }
                    }, delay || HOVER_REMOVAL_DELAY);
                }
            };

            const setLabel = (label, immediate = false) => {
                const normalized = (label || "").toLowerCase();
                if (!normalized || tag.textContent.toLowerCase() === normalized) return;

                clearTimeout(labelTimer);
                if (immediate) {
                    tag.textContent = normalized;
                    tag.style.transition = "";
                    tag.style.opacity = "1";
                    return;
                }

                tag.style.transition = "opacity 0.12s ease";
                tag.style.opacity = "0";
                labelTimer = setTimeout(() => {
                    tag.textContent = normalized;
                    tag.style.transition = "opacity 0.22s ease";
                    tag.style.opacity = "1";
                }, 120);
            };

            const showCopyLabel = () => {
                if (tag.dataset.state === "copied" || tag.dataset.state === "error") return;
                setLabel("copy");
            };

            const showOriginalLabel = () => {
                if (tag.dataset.state === "copied" || tag.dataset.state === "error") return;
                setLabel(originalLabel);
            };

            const handleCopyResult = (success) => {
                clearTimeout(state.feedbackTimer);
                tag.dataset.state = success ? "copied" : "error";
                setLabel(success ? "copied!" : "error");
                tag.blur();
                state.feedbackTimer = setTimeout(() => {
                    tag.dataset.state = "";
                    if (state.hover) showCopyLabel();
                    else showOriginalLabel();
                }, COPY_FEEDBACK_DURATION);
            };

            const doCopy = async () => {
                const text = code.innerText || code.textContent || "";
                if (!text) {
                    handleCopyResult(false);
                    return;
                }
                try {
                    handleCopyResult(await copyToClipboard(text));
                } catch (e) {
                    console.error("Copy failed:", e);
                    handleCopyResult(false);
                }
            };

            // Event handlers
            if (hoverTarget) {
                hoverTarget.addEventListener("mouseenter", () => {
                    state.hover = true;
                    setHoverClass(true, 100);
                    showCopyLabel();
                });

                hoverTarget.addEventListener("mouseleave", () => {
                    state.hover = false;
                    showOriginalLabel();
                    setHoverClass(false, 0);
                });

                hoverTarget.addEventListener("touchstart", () => {
                    state.touch = true;
                    state.hover = true;
                    setHoverClass(true, 100);
                    showCopyLabel();
                }, { passive: true });

                hoverTarget.addEventListener("touchend", () => {
                    state.touch = false;
                    state.hover = false;
                    setHoverClass(false, 350);
                });

                hoverTarget.addEventListener("touchcancel", () => {
                    state.touch = false;
                    state.hover = false;
                    setHoverClass(false, 350);
                });
            }

            if (codeScroll) {
                let scrollEndTimer = null;
                codeScroll.addEventListener("scroll", () => {
                    setHoverClass(true, 0);
                    clearTimeout(scrollEndTimer);
                    if (!state.touch && !state.hover && !state.focus) {
                        scrollEndTimer = setTimeout(() => setHoverClass(false, 300), 150);
                    }
                }, { passive: true });
            }

            tag.addEventListener("focus", () => {
                state.focus = true;
                setHoverClass(true, 100);
                showCopyLabel();
            });

            tag.addEventListener("blur", () => {
                state.focus = false;
                if (!state.hover) {
                    showOriginalLabel();
                    setHoverClass(false, 0);
                }
            });

            tag.addEventListener("click", (e) => {
                e.preventDefault();
                doCopy();
            });

            tag.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    doCopy();
                }
            });
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

            createCustomScrollbar(wrapper, scrollContainer);
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

    const setActiveNav = (path) => {
        const normalized = normalizePath(path);
        const activeKey = normalized.startsWith("/writing/") ? "/writing" : normalized;
        navLinks.forEach((link) => {
            const href = normalizePath(link.getAttribute("href"));
            link.classList.toggle("active", href === activeKey);
        });
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
            setActiveNav(canonicalPath);

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

    // Nav link clicks
    navLinks.forEach((link) => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const path = normalizePath(link.getAttribute("href"));
            if (path !== normalizePath(window.location.pathname)) {
                loadRoute(path);
            }
        });
    });

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
