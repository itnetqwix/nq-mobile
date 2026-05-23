import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { AccountType } from "../../../constants/accountType";
import { queryKeys } from "../../../lib/queryKeys";
import { dedupeTrainersById } from "../../../lib/lists/trainerListUtils";
import { useAuth } from "../../auth/context/AuthContext";
import { getTrainerId } from "../../bookexpert/lib/trainerUtils";
import {
  addFavoriteTrainer,
  fetchFavoriteTrainers,
  removeFavoriteTrainer,
} from "../api/favoriteTrainersApi";

export function useFavoriteTrainers(enabled = true) {
  const queryClient = useQueryClient();
  const { accountType } = useAuth();
  const isTrainee = accountType === AccountType.TRAINEE;

  const query = useQuery({
    queryKey: queryKeys.trainee.favorites,
    queryFn: fetchFavoriteTrainers,
    staleTime: 60_000,
    enabled: enabled && isTrainee,
    retry: (failureCount, error) => {
      if (isAxiosError(error) && error.response?.status === 401) return false;
      return failureCount < 1;
    },
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
          return dedupeTrainersById([row, ...old]);
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
    favorites: dedupeTrainersById(query.data ?? []),
    isLoading: query.isLoading,
    isFavorite,
    toggleFavorite,
    isPending: addMutation.isPending || removeMutation.isPending,
  };
}
