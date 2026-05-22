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
    mutationFn: addFavoriteTrainer,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.trainee.favorites });
    },
  });

  const removeMutation = useMutation({
    mutationFn: removeFavoriteTrainer,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.trainee.favorites });
    },
  });

  const toggleFavorite = (trainer: Record<string, unknown>) => {
    const id = getTrainerId(trainer);
    if (!id) return;
    if (favoriteIds.has(id)) {
      removeMutation.mutate(id);
    } else {
      addMutation.mutate(id);
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
