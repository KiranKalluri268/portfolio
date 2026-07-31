"use client";

import { useCallback, useEffect, useState } from "react";
import Tooltip from "./Tooltip";
import { SECTION_IDS, useActiveSection, useScrollActions } from "@/context/SmoothScrollContext";

export default function NavigationControls() {
    const activeSection = useActiveSection();
    const { scrollNext, scrollPrev } = useScrollActions();
    const activeIndex = SECTION_IDS.indexOf(activeSection);
    const [hoveredButton, setHoveredButton] = useState<string | null>(null);

    const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());

    const handlePress = useCallback((key: string) => {
        const forward = key === "ArrowDown" || key === "ArrowRight";
        if (forward) scrollNext();
        else scrollPrev();

        setPressedKeys((previous) => new Set(previous).add(key));
        window.setTimeout(() => {
            setPressedKeys((previous) => {
                const next = new Set(previous);
                next.delete(key);
                return next;
            });
        }, 150);
    }, [scrollNext, scrollPrev]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            let key = e.key;

            if (key === "w" || key === "W") key = "ArrowUp";
            if (key === "s" || key === "S") key = "ArrowDown";
            if (key === "a" || key === "A") key = "ArrowLeft";
            if (key === "d" || key === "D") key = "ArrowRight";

            const target = e.target;
            const isEditing = target instanceof HTMLElement && (
                target.isContentEditable ||
                target.tagName === "INPUT" ||
                target.tagName === "TEXTAREA" ||
                target.tagName === "SELECT"
            );
            const isHorizontal = key === "ArrowLeft" || key === "ArrowRight";
            const isEnabled = isHorizontal
                ? activeSection === "projects"
                : key === "ArrowUp"
                    ? activeIndex > 0
                    : activeIndex < SECTION_IDS.length - 1;
            if (
                isEditing ||
                e.repeat ||
                e.altKey ||
                e.ctrlKey ||
                e.metaKey ||
                !isEnabled ||
                !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key)
            ) return;

            e.preventDefault();
            handlePress(key);
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [activeIndex, activeSection, handlePress]);

    // Define allowed keys per scene
    const isUpEnabled = activeIndex > 0;
    const isDownEnabled = activeIndex < SECTION_IDS.length - 1;

    const isLeftEnabled = activeSection === "projects";
    const isRightEnabled = activeSection === "projects";

    return (
        <>
            <div
                className="fixed bottom-8 right-8 w-[180px] h-[90px] z-50 hidden sm:block"
            >
                {/* Up */}
                <ArrowButton
                    direction="ArrowUp"
                    enabled={isUpEnabled}
                    iconPath="M5 10l7-7m0 0l7 7m-7-7v18"
                    className="top-0 left-1/2 -translate-x-1/2" // Top center
                    isPressed={pressedKeys.has("ArrowUp")}
                    onPress={handlePress}
                    onMouseEnter={() => setHoveredButton("Up/Previous")}
                    onMouseLeave={() => setHoveredButton(null)}
                />

                {/* Left */}
                <ArrowButton
                    direction="ArrowLeft"
                    enabled={isLeftEnabled}
                    iconPath="M10 19l-7-7m0 0l7-7m-7 7h18"
                    className="bottom-0 left-0" // Bottom left
                    isPressed={pressedKeys.has("ArrowLeft")}
                    onPress={handlePress}
                    onMouseEnter={() => setHoveredButton("Left/Previous")}
                    onMouseLeave={() => setHoveredButton(null)}
                />

                {/* Down */}
                <ArrowButton
                    direction="ArrowDown"
                    enabled={isDownEnabled}
                    iconPath="M19 14l-7 7m0 0l-7-7m7 7V3"
                    className="bottom-0 left-1/2 -translate-x-1/2" // Bottom center
                    isPressed={pressedKeys.has("ArrowDown")}
                    onPress={handlePress}
                    onMouseEnter={() => setHoveredButton("Down/Next")}
                    onMouseLeave={() => setHoveredButton(null)}
                />

                {/* Right */}
                <ArrowButton
                    direction="ArrowRight"
                    enabled={isRightEnabled}
                    iconPath="M14 5l7 7m0 0l-7 7m7-7H3"
                    className="bottom-0 right-0" // Bottom right
                    isPressed={pressedKeys.has("ArrowRight")}
                    onPress={handlePress}
                    onMouseEnter={() => setHoveredButton("Right/Next")}
                    onMouseLeave={() => setHoveredButton(null)}
                />
            </div>
            <Tooltip text={hoveredButton || ""} isVisible={!!hoveredButton} />
        </>
    );
}

interface ArrowButtonProps {
    direction: string;
    enabled: boolean;
    iconPath: string;
    className?: string;
    isPressed: boolean;
    onPress: (direction: string) => void;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
}

const ArrowButton = ({
    direction,
    enabled,
    iconPath,
    className = "",
    isPressed,
    onPress,
    onMouseEnter,
    onMouseLeave,
}: ArrowButtonProps) => {
    return (
        <button
            className={`absolute w-14 h-10 rounded-md flex items-center justify-center border ${enabled
                ? "cursor-pointer"
                : "opacity-30 cursor-not-allowed"
                } ${isPressed
                    ? "bg-white border-white shadow-[0_0_15px_rgba(255,255,255,0.8)] scale-90"
                    : "bg-black/50 border-white/30 shadow-lg hover:bg-white/20 active:bg-white/20"
                } ${className}`}
            onClick={() => enabled && onPress(direction)}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            aria-label={`Navigate ${direction.replace("Arrow", "")}`}
            disabled={!enabled}
        >
            <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={iconPath}
                />
            </svg>
        </button>
    );
};
