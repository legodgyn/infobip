export function cleanPhone(value?: string | null) {
  return String(value || "").replace(/\D/g, "");
}

export function buildMessageWhere(input: {
  clientId?: string;
  number?: string;
  numbers?: string[];
  start?: string | null;
  end?: string | null;
  status?: string;
}): any {
  const number = cleanPhone(input.number);
  const numbers = (input.numbers || []).map(cleanPhone).filter(Boolean);

  const dateWhere =
    input.start || input.end
      ? {
          createdAt: {
            ...(input.start && { gte: new Date(`${input.start}T00:00:00`) }),
            ...(input.end && { lte: new Date(`${input.end}T23:59:59`) }),
          },
        }
      : {};

  const statusWhere =
    input.status && input.status !== "all"
      ? {
          status: { contains: input.status, mode: "insensitive" },
        }
      : {};

  const phoneWhere = (value: string) => ({
    OR: [{ from: { contains: value } }, { to: { contains: value } }],
  });

  const selectedNumberWhere = number ? phoneWhere(number) : {};
  const importedNumbersWhere = numbers.length
    ? { OR: numbers.flatMap((value) => phoneWhere(value).OR) }
    : {};

  const scopeWhere =
    input.clientId && numbers.length
      ? { OR: [{ clientId: input.clientId }, importedNumbersWhere] }
      : input.clientId
        ? { clientId: input.clientId }
        : importedNumbersWhere;

  const filters = [dateWhere, statusWhere, scopeWhere, selectedNumberWhere].filter(
    (item) => Object.keys(item).length > 0
  );

  return filters.length ? { AND: filters } : {};
}
