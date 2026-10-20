import type { Metadata } from "next";
import { WorkoutDay } from "@/modules/workouts/components/workout-day";

export const metadata: Metadata = { title: "Workout" };

export default function WorkoutsPage() {
  return <WorkoutDay />;
}
