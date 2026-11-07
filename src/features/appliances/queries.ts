import { appliancesResponseSchema } from '@family/shared';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../api/client';

export const applianceKeys = {
  all: ['appliances'] as const,
};

/**
 * Уредите на домакинството (GLOSSARY на family: Уред) по реда на добавяне. Рецептурникът само ги чете; управлението им
 * е в Настройки на family.
 */
export function useAppliances() {
  return useQuery({
    queryKey: applianceKeys.all,
    queryFn: () =>
      apiFetch('/appliances', appliancesResponseSchema).then(
        (body) => body.appliances,
      ),
  });
}
