import { Bebas_Neue, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

/**
 * Display face for headlines and tag/label components, at large sizes only.
 * Never used for body copy.
 */
export const displayFont = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display-family",
  display: "swap",
});

/** Body face for all running text and UI labels. */
export const bodyFont = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body-family",
  display: "swap",
});

/**
 * Utility face reserved for serial-number-style data: agreement IDs, deposit
 * amounts, timestamps, contract addresses. Never used for anything else.
 */
export const monoFont = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono-family",
  display: "swap",
});
