document.addEventListener("DOMContentLoaded", () => {
    const contentEl = document.getElementById("content");
    if (!contentEl) {
        return;
    }

    const siteName = "David Wang";
    const navLinks = Array.from(document.querySelectorAll(".subtitle .menu a.item"));
    const headerTitleEl = document.querySelector(".container > h1");
    const subtitlePrimaryEl = document.querySelector(".subtitle > span:first-child");
    const subtitleContainerEl = subtitlePrimaryEl ? subtitlePrimaryEl.closest(".subtitle") : null;
    const footerEl = document.querySelector("footer");

    const runtimeState = {
        menuMeasureSpan: null
    };

    const collectSubtitleVariants = (element) => {
        if (!element) {
            return [];
        }
        const variants = [];
        let index = 0;
        while (element.hasAttribute(`data-subtitle-${index}`)) {
            const value = (element.getAttribute(`data-subtitle-${index}`) || "").trim();
            if (value) {
                variants.push(value);
            }
            index++;
        }
        if (!variants.length) {
            const fallbackText = (element.textContent || "").trim();
            if (fallbackText) {
                variants.push(fallbackText);
            }
        }
        return variants;
    };

    const getMenuMeasureSpan = (menuEl) => {
        if (!menuEl) {
            return null;
        }
        if (!runtimeState.menuMeasureSpan) {
            const span = document.createElement("span");
            span.id = "menu-measure";
            span.style.visibility = "hidden";
            span.style.position = "absolute";
            span.style.whiteSpace = "nowrap";
            document.body.appendChild(span);
            runtimeState.menuMeasureSpan = span;
        }
        const measureSpan = runtimeState.menuMeasureSpan;
        const computed = window.getComputedStyle(menuEl);
        measureSpan.style.fontSize = computed.fontSize;
        measureSpan.style.fontFamily = computed.fontFamily;
        measureSpan.style.fontWeight = computed.fontWeight;
        measureSpan.style.fontStretch = computed.fontStretch;
        return measureSpan;
    };

    const resolveLineHeight = (styles) => {
        const raw = parseFloat(styles.lineHeight);
        if (Number.isFinite(raw)) {
            return raw;
        }
        const fallback = parseFloat(styles.fontSize);
        return Number.isFinite(fallback) ? fallback * 1.2 : 16;
    };

    // Generic menu responsive handler
    const handleResponsiveMenu = (menuEl) => {
        if (!menuEl) {
            return;
        }

        const container = menuEl.closest(".subtitle") || menuEl.closest("footer");
        if (!container) {
            return;
        }

        const measureSpan = getMenuMeasureSpan(menuEl);
        if (!measureSpan) {
            return;
        }

        const containerWidth = container.offsetWidth;

        // Calculate 1ch in pixels
        measureSpan.textContent = "0";
        const oneChWidth = measureSpan.offsetWidth;

        // Temporarily ensure menu is in horizontal layout for accurate measurement
        menuEl.classList.remove("menu--stacked");

        // Force reflow to get accurate measurements
        void menuEl.offsetWidth;

        // Calculate menu width: sum of items + 1ch * (items - 1)
        const menuItems = menuEl.querySelectorAll(".item, a");
        let menuItemsWidth = 0;
        menuItems.forEach((item) => {
            menuItemsWidth += item.offsetWidth;
        });
        const menuWidth = menuItemsWidth + oneChWidth * (menuItems.length - 1);

        // Special handling for subtitle container with variants
        const subtitleContainer = container.classList.contains("subtitle") ? container : null;
        const subtitleTextEl = subtitleContainer ? subtitleContainer.querySelector("span:first-child") : null;
        const variants = [];

        if (subtitleTextEl) {
            let index = 0;
            while (subtitleTextEl.hasAttribute(`data-subtitle-${index}`)) {
                variants.push(subtitleTextEl.getAttribute(`data-subtitle-${index}`));
                index++;
            }
        }

        // Edge case: if menu alone is wider than container, stack the menu
        if (menuWidth > containerWidth) {
            if (subtitleTextEl && variants.length > 0) {
                subtitleTextEl.textContent = variants[variants.length - 1];
                subtitleContainer.classList.add("subtitle--stacked");
            }
            menuEl.classList.add("menu--stacked");
            return;
        }

        // For subtitle containers with variants, try progressive degradation
        if (subtitleContainer && subtitleTextEl && variants.length > 0) {
            // Gap between subtitle and menu (4ch)
            const gap = oneChWidth * 4;

            // Try each variant
            let selectedVariant = null;
            for (const variant of variants) {
                measureSpan.textContent = variant;
                const subtitleWidth = measureSpan.offsetWidth;
                const totalWidth = subtitleWidth + gap + menuWidth;

                if (totalWidth <= containerWidth) {
                    selectedVariant = variant;
                    break;
                }
            }

            if (selectedVariant) {
                // Found a variant that fits - use horizontal layout
                subtitleTextEl.textContent = selectedVariant;
                subtitleContainer.classList.remove("subtitle--stacked");
            } else {
                // No variant fits - use stacked layout with the last (shortest) variant
                subtitleTextEl.textContent = variants[variants.length - 1];
                subtitleContainer.classList.add("subtitle--stacked");
            }
        }
    };

    // Handle all menus
    const handleAllMenus = () => {
        document.querySelectorAll(".menu").forEach(handleResponsiveMenu);
    };

    // Debounced resize handler to prevent flickering
    let resizeTimeout;
    const debouncedMenuHandler = () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(handleAllMenus, 10);
    };

    // Run on load and resize
    handleAllMenus();
    window.addEventListener("resize", debouncedMenuHandler);

    const defaultSubtitleVariants = collectSubtitleVariants(subtitlePrimaryEl);

    const defaultHeader = {
        title: headerTitleEl ? headerTitleEl.textContent.trim() : siteName,
        subtitle: subtitlePrimaryEl ? subtitlePrimaryEl.textContent.trim() : "",
        subtitleVariants: defaultSubtitleVariants
    };

    const routes = {
        "/": { fragment: "_content/home.html", documentTitle: siteName },
        "/projects": { fragment: "_content/projects.html", documentTitle: `Projects - ${siteName}` },
        "/writing": { fragment: "_content/writing.html", documentTitle: `Writing - ${siteName}` },
        "/index.html": { fragment: "_content/home.html", documentTitle: siteName }
    };

    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const appendStylesheet = (href, attributes = {}) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        Object.entries(attributes).forEach(([key, value]) => {
            if (value !== undefined) {
                link[key] = value;
            }
        });
        document.head.appendChild(link);
        return link;
    };

    const appendScript = (src, attributes = {}) => {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            Object.entries(attributes).forEach(([key, value]) => {
                if (value !== undefined) {
                    script[key] = value;
                }
            });
            script.onload = () => resolve(script);
            script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
            document.body.appendChild(script);
        });
    };

    const createCustomScrollbar = (container, codeScroll) => {
        if (!container || !codeScroll) {
            return;
        }

        // Create custom scrollbar elements
        const customScrollbar = document.createElement('div');
        customScrollbar.className = 'code-block__custom-scrollbar';

        const track = document.createElement('div');
        track.className = 'code-block__scrollbar-track';

        const thumb = document.createElement('div');
        thumb.className = 'code-block__scrollbar-thumb';

        track.appendChild(thumb);
        customScrollbar.appendChild(track);
        container.appendChild(customScrollbar);

        const updateScrollbar = () => {
            const scrollWidth = codeScroll.scrollWidth;
            const clientWidth = codeScroll.clientWidth;

            if (scrollWidth <= clientWidth) {
                customScrollbar.style.display = 'none';
                return;
            }

            customScrollbar.style.display = 'block';

            const thumbWidth = (clientWidth / scrollWidth) * track.offsetWidth;
            const maxScroll = scrollWidth - clientWidth;
            const scrollRatio = codeScroll.scrollLeft / maxScroll;
            const maxThumbPosition = track.offsetWidth - thumbWidth;
            const thumbPosition = scrollRatio * maxThumbPosition;

            thumb.style.width = `${thumbWidth}px`;
            thumb.style.left = `${thumbPosition}px`;
        };

        // Update on scroll
        codeScroll.addEventListener('scroll', updateScrollbar, { passive: true });

        // Drag functionality
        let isDragging = false;
        let startX = 0;
        let startScrollLeft = 0;

        thumb.addEventListener('pointerdown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startScrollLeft = codeScroll.scrollLeft;
            thumb.setPointerCapture(e.pointerId);
            e.preventDefault();
        });

        thumb.addEventListener('pointermove', (e) => {
            if (!isDragging) return;

            const deltaX = e.clientX - startX;
            const scrollWidth = codeScroll.scrollWidth;
            const clientWidth = codeScroll.clientWidth;
            const maxScroll = scrollWidth - clientWidth;
            const maxThumbPosition = track.offsetWidth - thumb.offsetWidth;
            const scrollDelta = (deltaX / maxThumbPosition) * maxScroll;

            codeScroll.scrollLeft = startScrollLeft + scrollDelta;
        });

        thumb.addEventListener('pointerup', (e) => {
            isDragging = false;
            thumb.releasePointerCapture(e.pointerId);
        });

        thumb.addEventListener('pointercancel', (e) => {
            isDragging = false;
            thumb.releasePointerCapture(e.pointerId);
        });

        // Click on track to jump
        track.addEventListener('click', (e) => {
            if (e.target === thumb) return;

            const rect = track.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const scrollWidth = codeScroll.scrollWidth;
            const clientWidth = codeScroll.clientWidth;
            const maxScroll = scrollWidth - clientWidth;
            const scrollRatio = clickX / track.offsetWidth;

            codeScroll.scrollLeft = scrollRatio * maxScroll;
        });

        // Initial update and on resize
        updateScrollbar();
        const resizeObserver = new ResizeObserver(updateScrollbar);
        resizeObserver.observe(codeScroll);
    };

    // Prevent image dragging
    document.addEventListener("dragstart", (event) => {
        if (event.target.tagName === "IMG") {
            event.preventDefault();
            return false;
        }
    });

    const enhanceTables = (root = document) => {
        const tables = root.querySelectorAll(".writing-post table");
        tables.forEach((table) => {
            // Skip if already wrapped
            if (table.parentElement && table.parentElement.classList.contains("table-wrapper")) {
                return;
            }

            // Create wrapper structure similar to code blocks
            const wrapper = document.createElement("div");
            wrapper.className = "table-wrapper";

            const scrollContainer = document.createElement("div");
            scrollContainer.className = "table-scroll";

            // Insert wrapper before table and move table into it
            table.parentNode.insertBefore(wrapper, table);
            scrollContainer.appendChild(table);
            wrapper.appendChild(scrollContainer);

            // Create custom scrollbar for the table
            createCustomScrollbar(wrapper, scrollContainer);
        });
    };

    const enhanceCodeBlocks = (root = document) => {
        // Create custom scrollbars for code blocks
        root.querySelectorAll('.code-block').forEach((container) => {
            const codeScroll = container.querySelector('.code-scroll');
            if (codeScroll && !container.querySelector('.code-block__custom-scrollbar')) {
                createCustomScrollbar(container, codeScroll);
            }
        });

        const tags = root.querySelectorAll(".code-language-tag");
        tags.forEach((tag) => {
            if (tag.dataset.enhanced === "true") {
                return;
            }
            const container = tag.closest(".code-block");
            const pre = container ? container.querySelector("pre") : tag.closest("pre");
            const code = pre ? pre.querySelector("code") : null;
            if (!pre || !code) {
                return;
            }
            const hoverTarget = container || pre;
            const codeScroll = container ? container.querySelector(".code-scroll") : null;

            const pointerIsInside = () => {
                // Don't trust :hover on touch devices during/after touch
                if (container && container._touchActive !== undefined && !container._touchActive) {
                    return false;
                }
                return hoverTarget ? hoverTarget.matches(":hover") : false;
            };

            const ensureHoverClass = (delay = 100) => {
                if (!container) {
                    return;
                }
                // Cancel any pending removal
                if (container._hoverRemovalTimer) {
                    clearTimeout(container._hoverRemovalTimer);
                    container._hoverRemovalTimer = null;
                }
                // If already visible, keep it visible
                if (container.classList.contains("code-block--hover")) {
                    return;
                }
                // Cancel any pending addition
                if (container._hoverAdditionTimer) {
                    clearTimeout(container._hoverAdditionTimer);
                    container._hoverAdditionTimer = null;
                }
                // Schedule addition with delay
                container._hoverAdditionTimer = setTimeout(() => {
                    container.classList.add("code-block--hover");
                    container._hoverAdditionTimer = null;
                }, delay);
            };

            const scheduleHoverClassRemoval = (delay = 900) => {
                if (!container) {
                    return;
                }
                // Cancel any pending addition
                if (container._hoverAdditionTimer) {
                    clearTimeout(container._hoverAdditionTimer);
                    container._hoverAdditionTimer = null;
                }
                // Cancel any existing removal timer
                if (container._hoverRemovalTimer) {
                    clearTimeout(container._hoverRemovalTimer);
                }
                container._hoverRemovalTimer = setTimeout(() => {
                    if (container._hoverPointerActive || container._hoverFocusActive || pointerIsInside()) {
                        container._hoverRemovalTimer = null;
                        return;
                    }
                    resetLabelIfIdle();
                    container.classList.remove("code-block--hover");
                    container._hoverRemovalTimer = null;
                }, delay);
            };

            const setPointerHoverActive = (active) => {
                if (!container) {
                    return;
                }
                container._hoverPointerActive = !!active;
                if (active) {
                    ensureHoverClass();
                }
            };

            const setFocusHoverActive = (active) => {
                if (!container) {
                    return;
                }
                container._hoverFocusActive = !!active;
                if (active) {
                    ensureHoverClass();
                }
            };

            const isHoverActive = () => {
                if (container && (container._hoverPointerActive || container._hoverFocusActive)) {
                    return true;
                }
                return pointerIsInside();
            };

            const clearLabelAnimation = () => {
                if (!tag._labelAnimation) {
                    return;
                }
                if (tag._labelAnimation.fadeOutTimer) {
                    clearTimeout(tag._labelAnimation.fadeOutTimer);
                }
                if (tag._labelAnimation.fadeInTimer) {
                    clearTimeout(tag._labelAnimation.fadeInTimer);
                }
                tag._labelAnimation = null;
                tag._pendingLabel = null;
                tag.style.transition = "";
                tag.style.opacity = "1";
            };

            const setLabel = (label, { immediate = false } = {}) => {
                const normalized = (label || "").toLowerCase();
                if (!normalized) {
                    return;
                }

                const currentMatches = tag._currentLabel === normalized;
                const pendingMatches = tag._pendingLabel === normalized;

                if (!immediate) {
                    if (pendingMatches) {
                        return;
                    }
                    if (currentMatches && !tag._pendingLabel) {
                        return;
                    }
                }

                const applyLabel = () => {
                    tag.textContent = normalized;
                    tag._currentLabel = normalized;
                    tag._pendingLabel = null;
                };

                if (immediate) {
                    clearLabelAnimation();
                    applyLabel();
                    tag.style.transition = "";
                    tag.style.opacity = "1";
                    return;
                }

                clearLabelAnimation();
                tag._pendingLabel = normalized;

                const fadeOutDuration = 120;
                const fadeInDuration = 220;

                tag.style.transition = "opacity 0.12s ease";
                tag.style.opacity = "0";
                const fadeOutTimer = setTimeout(() => {
                    applyLabel();
                    tag.style.transition = "opacity 0.22s ease";
                    tag.style.opacity = "1";
                    const fadeInTimer = setTimeout(() => {
                        clearLabelAnimation();
                    }, fadeInDuration);
                    tag._labelAnimation = { fadeOutTimer, fadeInTimer };
                }, fadeOutDuration);

                tag._labelAnimation = { fadeOutTimer, fadeInTimer: null };
            };

            const resetLabelIfIdle = () => {
                if (tag.dataset.state === "copied" || tag.dataset.state === "error") {
                    return;
                }
                if (tag._currentLabel && tag._currentLabel !== tag.dataset.originalLabel) {
                    setLabel(tag.dataset.originalLabel);
                }
            };

            const copyLabel = "copy";
            const originalLabel = (tag.textContent || "").trim().toLowerCase() || "code";
            tag.dataset.originalLabel = originalLabel;
            tag.dataset.enhanced = "true";
            setLabel(originalLabel, { immediate: true });

            const resetLabel = () => {
                tag.dataset.state = "";
                // Only show copy if pointer is actually hovering, not just focused
                if (container && container._hoverPointerActive) {
                    setLabel(copyLabel);
                } else {
                    setLabel(tag.dataset.originalLabel);
                }
            };

            const showCopyLabel = () => {
                if (tag.dataset.state === "copied" || tag.dataset.state === "error") {
                    return;
                }
                setLabel(copyLabel);
            };

            const showOriginalLabel = () => {
                if (tag.dataset.state === "copied" || tag.dataset.state === "error") {
                    return;
                }
                setLabel(tag.dataset.originalLabel);
            };

            const handleCopyFailure = () => {
                tag.dataset.state = "error";
                setLabel("error");
                tag.blur();
                if (tag._copyTimer) {
                    clearTimeout(tag._copyTimer);
                }
                tag._copyTimer = setTimeout(resetLabel, 1500);
            };

            const handleCopySuccess = () => {
                tag.dataset.state = "copied";
                setLabel("copied!");
                tag.blur();
                if (tag._copyTimer) {
                    clearTimeout(tag._copyTimer);
                }
                tag._copyTimer = setTimeout(resetLabel, 1500);
            };

            const copyTextToClipboard = async (text) => {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(text);
                    return true;
                }
                const textarea = document.createElement("textarea");
                textarea.value = text;
                textarea.setAttribute("readonly", "");
                textarea.style.position = "absolute";
                textarea.style.left = "-9999px";
                document.body.appendChild(textarea);
                textarea.select();
                let success = false;
                try {
                    success = document.execCommand("copy");
                } finally {
                    document.body.removeChild(textarea);
                }
                return success;
            };

            const copyCodeToClipboard = async () => {
                const codeText = code.innerText || code.textContent || "";
                if (!codeText) {
                    handleCopyFailure();
                    return;
                }
                try {
                    const success = await copyTextToClipboard(codeText);
                    if (success) {
                        handleCopySuccess();
                    } else {
                        handleCopyFailure();
                    }
                } catch (error) {
                    console.error("Unable to copy code block:", error);
                    handleCopyFailure();
                }
            };

            const handleHoverStart = () => {
                setPointerHoverActive(true);
                showCopyLabel();
            };

            const handleHoverEnd = () => {
                setPointerHoverActive(false);
                // Don't interrupt copied!/error states - let user see the feedback
                if (tag.dataset.state === "copied" || tag.dataset.state === "error") {
                    scheduleHoverClassRemoval(0);
                    return;
                }
                // Otherwise force label to original when mouse leaves
                setLabel(tag.dataset.originalLabel);
                scheduleHoverClassRemoval(0);
            };

            const handleTouchStart = () => {
                if (container) {
                    container._touchActive = true;
                }
                setPointerHoverActive(true);
                showCopyLabel();
            };

            const handleTouchEnd = () => {
                if (container) {
                    container._touchActive = false;
                }
                setPointerHoverActive(false);
                const feedbackActive = tag.dataset.state === "copied" || tag.dataset.state === "error";
                if (!feedbackActive) {
                    scheduleHoverClassRemoval(350);
                } else {
                    scheduleHoverClassRemoval();
                }
            };

            if (hoverTarget) {
                hoverTarget.addEventListener("mouseenter", handleHoverStart);
                hoverTarget.addEventListener("mouseleave", handleHoverEnd);
                hoverTarget.addEventListener("touchstart", handleTouchStart, { passive: true });
                hoverTarget.addEventListener("touchend", handleTouchEnd);
                hoverTarget.addEventListener("touchcancel", handleTouchEnd);
            }

            if (codeScroll) {
                codeScroll.addEventListener("scroll", () => {
                    // Keep scrollbar visible while scrolling
                    ensureHoverClass(0);

                    // Clear any existing scroll end timer
                    if (container && container._scrollEndTimer) {
                        clearTimeout(container._scrollEndTimer);
                    }

                    // Only update label state if not in a touch interaction
                    if (container && container._touchActive) {
                        // During touch scrolling, keep current state
                        return;
                    }

                    const pointerWithin = pointerIsInside();
                    if (pointerWithin) {
                        setPointerHoverActive(true);
                        showCopyLabel();
                    } else if (!(container && container._hoverFocusActive)) {
                        // Detect when scrolling (including momentum) has ended
                        if (container) {
                            container._scrollEndTimer = setTimeout(() => {
                                // Scrolling has stopped, hide scrollbar
                                scheduleHoverClassRemoval(300);
                                container._scrollEndTimer = null;
                            }, 150);
                        }
                    }
                }, { passive: true });
            }

            tag.addEventListener("focus", () => {
                setFocusHoverActive(true);
                showCopyLabel();
            });

            tag.addEventListener("blur", () => {
                setFocusHoverActive(false);
                if (container && container._hoverPointerActive) {
                    showCopyLabel();
                } else {
                    // Don't interrupt copied!/error states - let user see the feedback
                    if (tag.dataset.state === "copied" || tag.dataset.state === "error") {
                        scheduleHoverClassRemoval(0);
                        return;
                    }
                    // Otherwise force label to original when focus is lost
                    setLabel(tag.dataset.originalLabel);
                    scheduleHoverClassRemoval(0);
                }
            });

            tag.addEventListener("click", (event) => {
                event.preventDefault();
                setFocusHoverActive(true);
                showCopyLabel();
                copyCodeToClipboard();
            });

            tag.addEventListener("keydown", (event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setFocusHoverActive(true);
                    showCopyLabel();
                    copyCodeToClipboard();
                }
            });
        });
    };

    const slugifyHeadingText = (text) => {
        return (text || "")
            .toLowerCase()
            .trim()
            .replace(/["'`~!@#$%^&*()=+\[\]{}|;:\\<>,.?/]+/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "");
    };

    const ensureElementId = (element, preferredId) => {
        if (!element) {
            return null;
        }
        let id = (element.getAttribute("id") || "").trim();
        if (id) {
            return id;
        }
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
        if (!toc) {
            return;
        }

        const headingItems = [];
        const introId = headerTitleEl ? ensureElementId(headerTitleEl, "introduction") : null;
        if (introId) {
            headingItems.push({ level: 1, id: introId, label: "Introduction" });
        }

        headings.forEach((heading) => {
            const level = parseInt((heading.tagName || "").slice(1), 10);
            if (!heading.id || Number.isNaN(level) || level < 2 || level > 3) {
                return;
            }
            let label = heading.dataset.headingLabel;
            if (!label) {
                label = (heading.textContent || "").trim().replace(/^#\s*/, "");
                heading.dataset.headingLabel = label;
            }
            headingItems.push({ level, id: heading.id, label });
        });

        if (!headingItems.length) {
            toc.innerHTML = "";
            toc.classList.add("is-empty");
            return;
        }

        toc.classList.remove("is-empty");
        toc.innerHTML = "";

        const list = document.createElement("ol");
        list.className = "writing-toc__list";
        toc.appendChild(list);

        let currentSection = null;

        headingItems.forEach((item) => {
            if (item.level === 1) {
                const li = document.createElement("li");
                li.className = "writing-toc__item writing-toc__item--level-1";
                const link = document.createElement("a");
                link.href = `#${item.id}`;
                link.textContent = item.label;
                li.appendChild(link);
                list.appendChild(li);
                currentSection = null;
                return;
            }

            if (item.level === 2) {
                const li = document.createElement("li");
                li.className = "writing-toc__item writing-toc__item--level-2";
                const link = document.createElement("a");
                link.href = `#${item.id}`;
                link.textContent = item.label;
                li.appendChild(link);
                list.appendChild(li);
                currentSection = li;
                return;
            }

            if (item.level === 3) {
                if (!currentSection) {
                    const fallback = document.createElement("li");
                    fallback.className = "writing-toc__item writing-toc__item--level-2";
                    const fallbackLink = document.createElement("a");
                    fallbackLink.href = `#${item.id}`;
                    fallbackLink.textContent = item.label;
                    fallback.appendChild(fallbackLink);
                    list.appendChild(fallback);
                    currentSection = fallback;
                    return;
                }
                let sublist = currentSection.querySelector("ol");
                if (!sublist) {
                    sublist = document.createElement("ol");
                    sublist.className = "writing-toc__sublist";
                    currentSection.appendChild(sublist);
                }
                const li = document.createElement("li");
                li.className = "writing-toc__item writing-toc__item--level-3";
                const link = document.createElement("a");
                link.href = `#${item.id}`;
                link.textContent = item.label;
                li.appendChild(link);
                sublist.appendChild(li);
            }
        });
    };

    const positionSidenotes = (root = document) => {
        const rail = root.querySelector(".writing-post__rail-right");
        if (!rail) {
            return;
        }

        const content = root.querySelector(".writing-post__content");
        if (!content) {
            return;
        }

        // Only position on desktop viewports (154ch+)
        // Check if rail sidenotes are actually displayed
        const testSidenote = rail.querySelector(".sidenote--rail");
        if (testSidenote && window.getComputedStyle(testSidenote).display === "none") {
            return;
        }

        // Get all sidenote labels in the content
        const labels = Array.from(content.querySelectorAll("label.sidenote-number"));
        if (!labels.length) {
            return;
        }

        // Get content position for relative offsets
        const contentRect = content.getBoundingClientRect();

        // Calculate positions for each sidenote
        const positions = [];
        labels.forEach((label) => {
            const labelId = label.getAttribute("for");
            if (!labelId) {
                return;
            }

            const sidenote = rail.querySelector(`.sidenote--rail[data-sidenote-ref="${labelId}"]`);
            if (!sidenote) {
                return;
            }

            // Ignore the superscripts - just align the line boxes
            // Find which line the label is on by looking at its parent paragraph
            const labelParent = label.parentElement;
            if (!labelParent) {
                return;
            }
            const parentRect = labelParent.getBoundingClientRect();
            const parentStyles = window.getComputedStyle(labelParent);
            const parentLineHeight = resolveLineHeight(parentStyles);

            // Get a non-superscript element position to find the actual line
            // Use the parent paragraph's top as reference
            const labelRect = label.getBoundingClientRect();
            const labelOffsetInParent = labelRect.top - parentRect.top;

            // Round to find which line box this is on
            const lineIndex = Math.round(labelOffsetInParent / parentLineHeight);
            const lineTop = lineIndex * parentLineHeight;

            const relativeTop = parentRect.top - contentRect.top + lineTop;

            positions.push({
                sidenote,
                idealTop: relativeTop,
                height: 0  // Will be calculated after initial positioning
            });
        });

        // Position sidenotes and handle stacking
        positions.forEach((pos, index) => {
            // Set initial position
            pos.sidenote.style.top = `${pos.idealTop}px`;

            // Get actual height after positioning
            pos.height = pos.sidenote.getBoundingClientRect().height;

            // Get sidenote line-height for spacing calculation (use half-line gap between stacked notes)
            const sidenoteStyles = window.getComputedStyle(pos.sidenote);
            const sidenoteLineHeight = resolveLineHeight(sidenoteStyles);
            const stackingGap = sidenoteLineHeight * 0.5;

            // Check for overlaps with previous sidenotes and adjust if needed
            for (let i = 0; i < index; i++) {
                const prev = positions[i];
                const prevTop = parseFloat(prev.sidenote.style.top) || 0;
                const prevBottom = prevTop + prev.height;
                let currentTop = parseFloat(pos.sidenote.style.top) || 0;

                // If there's an overlap, push this sidenote down with additional spacing
                if (currentTop < prevBottom + stackingGap) {
                    const adjustedTop = prevBottom + stackingGap;
                    pos.sidenote.style.top = `${adjustedTop}px`;
                    pos.idealTop = adjustedTop;
                }
            }
        });
    };

    // Debounced resize handler for sidenote positioning
    let sidenoteResizeTimeout;
    const debouncedSidenotePosition = () => {
        clearTimeout(sidenoteResizeTimeout);
        sidenoteResizeTimeout = setTimeout(() => {
            positionSidenotes(document);
        }, 10);
    };
    window.addEventListener("resize", debouncedSidenotePosition);

    const enhanceHeadings = (root = document) => {
        const headings = root.querySelectorAll("h2, h3");
        if (!headings.length) {
            renderTableOfContents(root, headings);
            return;
        }

        const existingIds = new Set(Array.from(document.querySelectorAll("[id]")).map((el) => el.id));

        headings.forEach((heading) => {
            let headingLabel = heading.dataset.headingLabel;
            if (!headingLabel) {
                headingLabel = (heading.textContent || "section").trim().replace(/^#\s*/, "");
                heading.dataset.headingLabel = headingLabel;
            }

            if (heading.dataset.headingEnhanced === "true") {
                return;
            }

            const currentId = (heading.getAttribute("id") || "").trim();
            let id = currentId;
            if (!id) {
                const baseSlug = slugifyHeadingText(headingLabel) || "section";
                let candidate = baseSlug;
                let counter = 2;
                while (existingIds.has(candidate)) {
                    candidate = `${baseSlug}-${counter++}`;
                }
                id = candidate;
                heading.setAttribute("id", id);
                existingIds.add(id);
            }

            let anchor = heading.querySelector(".heading-anchor");
            if (!anchor) {
                anchor = document.createElement("a");
                anchor.className = "heading-anchor";
                anchor.href = `#${id}`;
                anchor.textContent = "#";

                // Find the last text node and wrap the last word + anchor together
                const textNodes = [];
                const walk = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT, null, false);
                let node;
                while (node = walk.nextNode()) {
                    if (node.textContent.trim()) {
                        textNodes.push(node);
                    }
                }

                if (textNodes.length > 0) {
                    const lastTextNode = textNodes[textNodes.length - 1];
                    const text = lastTextNode.textContent;
                    const trimmedText = text.trimEnd();
                    const trailingSpace = text.slice(trimmedText.length);

                    // Find the last word
                    const lastSpaceIndex = trimmedText.lastIndexOf(' ');
                    const beforeLastWord = trimmedText.slice(0, lastSpaceIndex + 1);
                    const lastWord = trimmedText.slice(lastSpaceIndex + 1);

                    if (lastWord) {
                        // Create a non-breaking wrapper for last word + anchor
                        const wrapper = document.createElement("span");
                        wrapper.style.whiteSpace = "nowrap";
                        wrapper.textContent = lastWord;
                        wrapper.appendChild(anchor);

                        // Replace the last text node
                        lastTextNode.textContent = beforeLastWord + trailingSpace;
                        lastTextNode.parentNode.insertBefore(wrapper, lastTextNode.nextSibling);
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

    const scrollToHeadingById = (id, { animate = true } = {}) => {
        if (!id) {
            return false;
        }
        const target = document.getElementById(id);
        if (!target) {
            return false;
        }
        target.scrollIntoView({
            behavior: animate ? "smooth" : "auto",
            block: "start",
            inline: "nearest"
        });
        return true;
    };

    let activeSelectionContainer = null;
    let selectionPointerDown = false;

    const activateSelectionContainer = (container) => {
        if (activeSelectionContainer === container) {
            return;
        }
        if (activeSelectionContainer) {
            activeSelectionContainer.removeAttribute("data-selection-active");
        }
        activeSelectionContainer = container || null;
        if (!activeSelectionContainer) {
            document.body.removeAttribute("data-selection-lock");
            return;
        }
        activeSelectionContainer.setAttribute("data-selection-active", "true");
        document.body.setAttribute("data-selection-lock", "true");
    };

    const resetSelectionContext = () => {
        if (activeSelectionContainer) {
            activeSelectionContainer.removeAttribute("data-selection-active");
            activeSelectionContainer = null;
        }
        document.body.removeAttribute("data-selection-lock");
        selectionPointerDown = false;
    };

    const findSelectionContainer = (target) => {
        if (!target || !(target instanceof Node)) {
            return null;
        }
        if (target.nodeType === Node.TEXT_NODE) {
            target = target.parentNode;
        }
        if (!target || !(target instanceof Element)) {
            return null;
        }

        const sidenote = target.closest(".sidenote");
        if (sidenote) {
            return sidenote;
        }

        const mathBlock = target.closest(".math-display");
        if (mathBlock) {
            return mathBlock;
        }

        const table = target.closest("table");
        if (table) {
            return table;
        }

        const contentSection = target.closest(".writing-post__content");
        if (contentSection) {
            return contentSection;
        }

        return null;
    };

    document.addEventListener("pointerdown", (event) => {
        const container = findSelectionContainer(event.target);
        if (container) {
            activateSelectionContainer(container);
            selectionPointerDown = true;
        } else {
            resetSelectionContext();
        }
    }, { capture: true });

    const handlePointerRelease = () => {
        selectionPointerDown = false;
        if (!document.getSelection) {
            resetSelectionContext();
            return;
        }
        const selection = document.getSelection();
        if (!selection || selection.isCollapsed) {
            resetSelectionContext();
        }
    };

    document.addEventListener("pointerup", handlePointerRelease);
    document.addEventListener("pointercancel", resetSelectionContext);
    window.addEventListener("blur", resetSelectionContext);

    document.addEventListener("selectionchange", () => {
        const selection = document.getSelection ? document.getSelection() : null;
        if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
            if (!selectionPointerDown) {
                resetSelectionContext();
            }
            return;
        }

        const containerFromSelection =
            findSelectionContainer(selection.anchorNode) ||
            findSelectionContainer(selection.focusNode);
        if (containerFromSelection) {
            activateSelectionContainer(containerFromSelection);
        } else if (!selectionPointerDown) {
            resetSelectionContext();
        }
    });

    const normalizePath = (path) => {
        if (!path) {
            return "/";
        }
        let normalized = path.split("?")[0].split("#")[0];
        if (!normalized.startsWith("/")) {
            normalized = `/${normalized}`;
        }
        if (normalized.length > 1 && normalized.endsWith("/")) {
            normalized = normalized.slice(0, -1);
        }
        return normalized || "/";
    };

    const resolveRoute = (rawPath) => {
        const path = normalizePath(rawPath);
        if (routes[path]) {
            return routes[path];
        }
        if (path.startsWith("/writing/") && path.length > "/writing/".length) {
            const slug = path.slice("/writing/".length);
            if (!slug) {
                return null;
            }
            const sanitizedSlug = slug.replace(/\/+/g, "").replace(/\.html$/i, "");
            if (!sanitizedSlug) {
                return null;
            }
            return {
                fragment: `_content/writing/${sanitizedSlug}.html`,
                documentTitle: null,
                canonicalPath: `/writing/${sanitizedSlug}`
            };
        }
        return null;
    };

    const getFallbackSubtitleVariants = () => {
        if (defaultHeader.subtitleVariants && defaultHeader.subtitleVariants.length > 0) {
            return [...defaultHeader.subtitleVariants];
        }
        const fallback = (defaultHeader.subtitle || "").trim();
        return fallback ? [fallback] : [];
    };

    const normalizeSubtitleVariants = (value) => {
        if (Array.isArray(value)) {
            const normalized = value.map((variant) => (variant || "").trim()).filter(Boolean);
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
            const subtitleVariants = normalizeSubtitleVariants(subtitles);
            const firstVariant = subtitleVariants[0] || defaultHeader.subtitle || "";
            subtitlePrimaryEl.textContent = firstVariant;

            // Clear old data-subtitle-* attributes
            let index = 0;
            while (subtitlePrimaryEl.hasAttribute(`data-subtitle-${index}`)) {
                subtitlePrimaryEl.removeAttribute(`data-subtitle-${index}`);
                index++;
            }

            // Set new data-subtitle-* attributes for responsive behavior
            subtitleVariants.forEach((variant, idx) => {
                subtitlePrimaryEl.setAttribute(`data-subtitle-${idx}`, variant);
            });

            if (subtitleContainerEl) {
                subtitleContainerEl.classList.add("loaded");
            }
        }
        if (footerEl) {
            footerEl.classList.add("loaded");
        }
    };

    const applyHeaderFromContent = (route) => {
        const metaSource = contentEl.querySelector("[data-page-title]");
        if (metaSource) {
            const title = (metaSource.getAttribute("data-page-title") || "").trim();

            // Check for multiple subtitle variants (data-page-subtitle-0, data-page-subtitle-1, etc.)
            const subtitleVariants = [];
            let index = 0;
            while (metaSource.hasAttribute(`data-page-subtitle-${index}`)) {
                const variant = (metaSource.getAttribute(`data-page-subtitle-${index}`) || "").trim();
                if (variant) {
                    subtitleVariants.push(variant);
                }
                index++;
            }

            // Fall back to single data-page-subtitle attribute if no variants found
            if (subtitleVariants.length === 0) {
                const subtitle = (metaSource.getAttribute("data-page-subtitle") || "").trim();
                if (subtitle) {
                    subtitleVariants.push(subtitle);
                }
            }

            setHeader(
                title || defaultHeader.title,
                subtitleVariants.length > 0 ? subtitleVariants : defaultHeader.subtitleVariants
            );
            if (!route.documentTitle && title) {
                document.title = `${title} - ${siteName}`;
            }
            handleAllMenus();
            return;
        }
        if (route && route.heading) {
            const { title, subtitle } = route.heading;
            setHeader(title, subtitle);
            handleAllMenus();
            return;
        }
        setHeader(defaultHeader.title, defaultHeader.subtitleVariants);
        handleAllMenus();
    };

    const setActiveNav = (path) => {
        const normalizedPath = normalizePath(path);
        const activeKey = normalizedPath.startsWith("/writing/") ? "/writing" : normalizedPath;
        navLinks.forEach((link) => {
            const href = normalizePath(link.getAttribute("href"));
            if (href === activeKey) {
                link.classList.add("active");
            } else {
                link.classList.remove("active");
            }
        });
    };

    const loadRoute = async (targetPath, pushState = true) => {
        const normalizedPath = normalizePath(targetPath);
        const route = resolveRoute(normalizedPath);
        if (!route || !route.fragment) {
            console.error(`No route found for path: ${normalizedPath}`);
            contentEl.innerHTML = "<p>Page not found.</p>";
            document.title = `Not Found - ${siteName}`;
            setHeader(defaultHeader.title, defaultHeader.subtitleVariants);
            return null;
        }

        const canonicalPath = route.canonicalPath || normalizedPath;
        const fragmentPath = route.fragment.startsWith("/") ? route.fragment : `/${route.fragment}`;

        try {
            const response = await fetch(fragmentPath);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const html = await response.text();
            contentEl.style.opacity = "0";
            await delay(150);
            contentEl.innerHTML = html;
            resetSelectionContext();
            enhanceTables(contentEl);
            enhanceCodeBlocks(contentEl);
            enhanceHeadings(contentEl);
            applyHeaderFromContent(route);
            if (route.documentTitle) {
                document.title = route.documentTitle;
            }
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
            // If this is a writing subpage that failed to load, redirect to /writing
            if (normalizedPath.startsWith("/writing/") && normalizedPath !== "/writing") {
                console.log("Writing page not found, redirecting to /writing");
                return loadRoute("/writing", pushState);
            }
            contentEl.innerHTML = `<p>Error loading page: ${error.message}</p>`;
            document.title = `Error - ${siteName}`;
            setHeader(defaultHeader.title, defaultHeader.subtitleVariants);
            contentEl.style.opacity = "1";
            return null;
        }
    };

    navLinks.forEach((link) => {
        link.addEventListener("click", (event) => {
            event.preventDefault();
            const href = link.getAttribute("href");
            const path = normalizePath(href);
            if (path === normalizePath(window.location.pathname)) {
                return;
            }
            loadRoute(path);
        });
    });

    let currentLoadedPath = null;
    const getCurrentCanonicalPath = () => normalizePath(window.location.pathname);

    contentEl.addEventListener("click", (event) => {
        const anchor = event.target.closest("a");
        if (!anchor) {
            return;
        }
        if (anchor.target && anchor.target !== "_self") {
            return;
        }
        if (anchor.hasAttribute("download") || anchor.getAttribute("rel") === "external") {
            return;
        }
        const href = anchor.getAttribute("href");
        if (!href) {
            return;
        }

        if (href.startsWith("#")) {
            const targetId = href.slice(1);
            if (!targetId) {
                return;
            }
            event.preventDefault();
            const canonicalPath = getCurrentCanonicalPath();
            history.pushState({ path: canonicalPath, hash: targetId }, document.title, `${window.location.pathname}#${targetId}`);
            scrollToHeadingById(targetId, { animate: true });
            return;
        }

        const url = new URL(anchor.href, window.location.origin);
        if (url.origin !== window.location.origin) {
            return;
        }
        const path = normalizePath(url.pathname);
        const route = resolveRoute(path);
        if (!route) {
            return;
        }
        event.preventDefault();
        const hash = url.hash ? url.hash.slice(1) : null;
        loadRoute(path).then((canonicalPath) => {
            if (hash) {
                const finalPath = canonicalPath || path;
                history.replaceState({ path: finalPath, hash }, document.title, `${finalPath}#${hash}`);
                scrollToHeadingById(hash, { animate: true });
            }
        });
    });

    window.addEventListener("popstate", (event) => {
        const targetPath = event.state && event.state.path ? event.state.path : getCurrentCanonicalPath();
        const targetHash = event.state && typeof event.state.hash === "string" ? event.state.hash : (window.location.hash ? window.location.hash.slice(1) : null);

        if (targetPath === currentLoadedPath) {
            if (targetHash) {
                scrollToHeadingById(targetHash, { animate: true });
            } else {
                window.scrollTo({ top: 0, behavior: "smooth" });
            }
            return;
        }

        loadRoute(targetPath, false).then(() => {
            if (targetHash) {
                requestAnimationFrame(() => {
                    scrollToHeadingById(targetHash, { animate: true });
                });
            } else {
                window.scrollTo({ top: 0, behavior: "smooth" });
            }
        });
    });

    window.addEventListener("hashchange", () => {
        const hash = window.location.hash ? window.location.hash.slice(1) : null;
        if (hash) {
            requestAnimationFrame(() => {
                scrollToHeadingById(hash, { animate: true });
            });
        } else {
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    });

    const initialPath = normalizePath(window.location.pathname);
    const initialRoute = resolveRoute(initialPath);
    if (!initialRoute) {
        loadRoute("/", false).then(() => {
            history.replaceState({ path: "/", hash: null }, siteName, "/");
        });
        return;
    }

    const initialHash = window.location.hash ? window.location.hash.slice(1) : null;
    loadRoute(initialPath, false).then((canonicalPath) => {
        const pathForState = canonicalPath || normalizePath(initialPath);
        history.replaceState({ path: pathForState, hash: initialHash }, document.title, initialHash ? `${pathForState}#${initialHash}` : pathForState);
        if (initialHash) {
            requestAnimationFrame(() => {
                scrollToHeadingById(initialHash, { animate: false });
            });
        }
    });
});
