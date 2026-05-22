import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { getTrainerId } from "../../bookexpert/lib/trainerUtils";
import {
  addFavoriteTrainer,
  fetchFavoriteTrainers,
  removeFavoriteTrainer,
} from "../api/favoriteTrainersApi";

export function useFavoriteTrainers() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.trainee.favorites,
    queryFn: fetchFavoriteTrainers,
    staleTime: 60_000,
  });

  const favoriteIds = new Set(
    (query.data ?? []).map((t) => getTrainerId(t)).filter(Boolean)
  );

  const addMutation = useMutation({
    mutationFn: ({ trainerId }: { trainerId: string; trainer?: Record<string, unknown> }) =>
      addFavoriteTrainer(trainerId),
    onMutate: async ({
      trainerId,
      trainer,
    }: {
      trainerId: string;
      trainer?: Record<string, unknown>;
    }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.trainee.favorites });
      const previous = queryClient.getQueryData<Record<string, unknown>[]>(
        queryKeys.trainee.favorites
      );
      queryClient.setQueryData<Record<string, unknown>[]>(
        queryKeys.trainee.favorites,
        (old = []) => {
          if (old.some((t) => getTrainerId(t) === trainerId)) return old;
          const row = trainer ? { ...trainer, _id: trainerId } : { _id: trainerId };
          return [row, ...old];
        }
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.trainee.favorites, context.previous);
      }
    },
  });

  const removeMutation = useMutation({
    mutationFn: removeFavoriteTrainer,
    onMutate: async (trainerId: string) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.trainee.favorites });
      const previous = queryClient.getQueryData<Record<string, unknown>[]>(
        queryKeys.trainee.favorites
      );
      queryClient.setQueryData<Record<string, unknown>[]>(
        queryKeys.trainee.favorites,
        (old = []) => old.filter((t) => getTrainerId(t) !== trainerId)
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.trainee.favorites, context.previous);
      }
    },
  });

  const toggleFavorite = (trainer: Record<string, unknown>) => {
    const id = getTrainerId(trainer);
    if (!id) return;
    if (favoriteIds.has(id)) {
      removeMutation.mutate(id);
    } else {
      addMutation.mutate({ trainerId: id, trainer });
    }
  };

  const isFavorite = (trainer: Record<string, unknown>) =>
    favoriteIds.has(getTrainerId(trainer));

  return {
    favorites: query.data ?? [],
    isLoading: query.isLoading,
    isFavorite,
    toggleFavorite,
    isPending: addMutation.isPending || removeMutation.isPending,
  };
}
