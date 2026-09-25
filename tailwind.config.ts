import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

const token = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Figtree", ...defaultTheme.fontFamily.sans],
        display: ['"Bricolage Grotesque"', "Figtree", ...defaultTheme.fontFamily.sans],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 6px)",
        xl: "1.125rem",
        "2xl": "1.375rem",
      },
      colors: {
        background: token("background"),
        foreground: token("foreground"),
        card: { DEFAULT: token("card"), foreground: token("card-foreground") },
        elevated: token("elevated"),
        popover: { DEFAULT: token("popover"), foreground: token("popover-foreground") },
        primary: {
          DEFAULT: token("primary"),
          foreground: token("primary-foreground"),
          hover: token("primary-hover"),
        },
        secondary: { DEFAULT: token("secondary"), foreground: token("secondary-foreground") },
        muted: { DEFAULT: token("muted"), foreground: token("muted-foreground") },
        accent: { DEFAULT: token("accent"), foreground: token("accent-foreground") },
        destructive: { DEFAULT: token("destructive"), foreground: token("destructive-foreground") },
        warn: token("warn"),
        success: { DEFAULT: token("success"), foreground: token("success-foreground") },
        score: { high: token("score-high"), mid: token("score-mid"), low: token("score-low") },
        hero: {
          DEFAULT: token("hero"),
          muted: token("hero-muted"),
          foreground: token("hero-foreground"),
          soft: token("hero-soft"),
        },
        border: token("border"),
        input: token("input"),
        ring: token("ring"),
        chart: {
          "1": token("chart-1"),
          "2": token("chart-2"),
          "3": token("chart-3"),
          "4": token("chart-4"),
          "5": token("chart-5"),
        },
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-up": "fade-up 0.35s cubic-bezier(0.2, 0.8, 0.2, 1) both",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
