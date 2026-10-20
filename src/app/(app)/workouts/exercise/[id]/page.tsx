import { ExerciseHistoryView } from "@/modules/workouts/components/exercise-history-view";

export default async function ExercisePage({ params }: PageProps<"/workouts/exercise/[id]">) {
  const { id } = await params;
  return <ExerciseHistoryView exerciseId={id} />;
}
