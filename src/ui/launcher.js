// ────────────────────────────────────────────────────────────────────────────
// The floating launcher button and the character banner on the settings modal.
// ────────────────────────────────────────────────────────────────────────────

import { getContext } from "../st.js";
import { extensionFolderPath } from "../core/constants.js";

export let defaultImageCount = 0;

export async function discoverDefaultImages() {
    if (defaultImageCount > 0) return;
    let count = 0;
    for (let i = 1; i <= 20; i++) {
        try {
            const res = await fetch(`${extensionFolderPath}/img/default${i}.png`, { method: 'HEAD' });
            if (res.ok) count = i;
            else break;
        } catch { break; }
    }
    defaultImageCount = count;
}

export function getRandomDefaultImage() {
    if (defaultImageCount <= 0) return `${extensionFolderPath}/img/default.png`;
    const pick = Math.floor(Math.random() * defaultImageCount) + 1;
    return `${extensionFolderPath}/img/default${pick}.png`;
}

export function updateCharacterDisplay() {
    const context = getContext();
    const bannerElement = $("#ps_hero_banner");
    let imgUrl = getRandomDefaultImage();

    if (context.groupId !== undefined && context.groupId !== null) {
        imgUrl = `${extensionFolderPath}/img/group.png`;
    } else if (context.characterId !== undefined && context.characterId !== null && context.characters[context.characterId]) {
        imgUrl = `/characters/${context.characters[context.characterId].avatar}`;
    }

    // Set the full-width background image smoothly
    bannerElement.css("background-image", `url('${imgUrl}')`);
}

export function initDraggableButton() {
    const $btn = $('#prompt-slot-fixed-btn');
    if (!$btn.length) return;

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;
    let hasMoved = false;

    // Load saved position
    let savedPos = null;
    try {
        const stored = localStorage.getItem('megumin_btn_position');
        if (stored) savedPos = JSON.parse(stored);
    } catch (e) {
        console.error('Failed to parse megumin_btn_position', e);
    }

    // Apply saved position or defaults
    function applyPosition(pos) {
        // Reset positioning styles
        $btn.css({ left: '', right: '', top: '', bottom: '' });

        if (pos) {
            const topPx = Math.max(10, Math.min($(window).height() - $btn.outerHeight() - 10, (pos.topPercent / 100) * $(window).height()));
            $btn.css('top', `${topPx}px`);

            const gutter = $(window).width() <= 768 ? 12 : 20;
            if (pos.side === 'left') {
                $btn.css('left', `${gutter}px`);
            } else {
                $btn.css('right', `${gutter}px`);
            }
        } else {
            // Default position
            $btn.css({
                top: '60px',
                right: $(window).width() <= 768 ? '12px' : '20px'
            });
        }
    }

    applyPosition(savedPos);

    // Dynamic resize handler
    $(window).off('resize.megumin_btn').on('resize.megumin_btn', function () {
        applyPosition(savedPos);
    });

    // Start drag handler
    function dragStart(e) {
        // Only left click
        if (e.type === 'mousedown' && e.which !== 1) return;

        const event = e.originalEvent.touches ? e.originalEvent.touches[0] : e;
        startX = event.clientX;
        startY = event.clientY;

        // Since the button is fixed, let's use client coordinates instead of offset() relative to page
        const bounding = $btn[0].getBoundingClientRect();
        initialLeft = bounding.left;
        initialTop = bounding.top;

        hasMoved = false;
        isDragging = true;

        // Remove transitions during drag for immediate tracking
        $btn.removeClass('ps-btn-transition');

        // Bind document level listeners
        $(document).on('mousemove.megumin_drag touchmove.megumin_drag', dragMove);
        $(document).on('mouseup.megumin_drag touchend.megumin_drag', dragEnd);

        // Prevent default actions to stop scrolling/text selection ONLY on mouse events
        if (e.type === 'mousedown') {
            e.preventDefault();
        }
    }

    // Drag move handler
    function dragMove(e) {
        if (!isDragging) return;

        const event = e.originalEvent.touches ? e.originalEvent.touches[0] : e;
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;

        // Set movement threshold to avoid clicking issues
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            hasMoved = true;
        }

        if (hasMoved && e.cancelable) {
            e.preventDefault(); // Prevent scrolling while dragging
        }

        let newLeft = initialLeft + dx;
        let newTop = initialTop + dy;

        // Keep it in bounds
        const btnWidth = $btn.outerWidth();
        const btnHeight = $btn.outerHeight();
        newLeft = Math.max(0, Math.min($(window).width() - btnWidth, newLeft));
        newTop = Math.max(10, Math.min($(window).height() - btnHeight - 10, newTop));

        $btn.css({
            left: `${newLeft}px`,
            right: 'auto',
            top: `${newTop}px`
        });
    }

    // Drag end handler
    function dragEnd(e) {
        if (!isDragging) return;
        isDragging = false;

        // Unbind move/up events
        $(document).off('.megumin_drag');

        if (hasMoved) {
            // Apply snap transition
            $btn.addClass('ps-btn-transition');

            const btnWidth = $btn.outerWidth();
            const btnHeight = $btn.outerHeight();
            const bounding = $btn[0].getBoundingClientRect();
            const currentLeft = bounding.left;
            const currentTop = bounding.top;

            const midPoint = $(window).width() / 2;
            const gutter = $(window).width() <= 768 ? 12 : 20;

            let side = 'right';
            let targetLeft = 0;

            if (currentLeft + btnWidth / 2 < midPoint) {
                side = 'left';
                targetLeft = gutter;
                $btn.css({
                    left: `${targetLeft}px`,
                    right: 'auto'
                });
            } else {
                side = 'right';
                targetLeft = $(window).width() - btnWidth - gutter;
                $btn.css({
                    left: 'auto',
                    right: `${gutter}px`
                });
            }

            // Calculate vertical percentage
            const topPercent = (currentTop / $(window).height()) * 100;

            savedPos = { side, topPercent };
            localStorage.setItem('megumin_btn_position', JSON.stringify(savedPos));

            // Prevent the subsequent click event from bubbling or executing handlers
            $btn.one('click', function (clickEvent) {
                clickEvent.stopImmediatePropagation();
                clickEvent.preventDefault();
            });
        }
    }

    // Attach start listeners
    $btn.off('mousedown.megumin_drag touchstart.megumin_drag').on('mousedown.megumin_drag touchstart.megumin_drag', dragStart);
}
