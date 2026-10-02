import type { Metadata } from "next";
import { ScoreTracker } from "../components/ScoreTracker";

export const metadata: Metadata = {
  title: "Skor Tablosu · Kingdom Builder",
  description: "Kim kaç kez kazandı, rekor farklar ve oyun gecesi istatistikleri.",
};

export default function ScorePage() {
  return <ScoreTracker />;
}
