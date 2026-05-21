export function cleanPhone(value?: string | null) {
  return String(value || "").replace(/\D/g, "");
}

function phoneVariants(value?: string | null) {
  const cleaned = cleanPhone(value);
  const variants = new Set<string>();

  if (!cleaned) return [];

  variants.add(cleaned);

  const withoutCountry = cleaned.startsWith("55") ? cleaned.slice(2) : cleaned;
  if (withoutCountry) variants.add(withoutCountry);
  if (!cleaned.startsWith("55") && cleaned.length >= 10) variants.add(`55${cleaned}`);

  if (withoutCountry.length === 11) {
    const area = withoutCountry.slice(0, 2);
    const subscriber = withoutCountry.slice(2);

    if (subscriber.startsWith("9")) {
      const withoutNinthDigit = `${area}${subscriber.slice(1)}`;
      variants.add(withoutNinthDigit);
      variants.add(`55${withoutNinthDigit}`);
    }
  }

  if (withoutCountry.length === 10) {
    const area = withoutCountry.slice(0, 2);
    const subscriber = withoutCountry.slice(2);
    const withNinthDigit = `${area}9${subscriber}`;

    variants.add(withNinthDigit);
    variants.add(`55${withNinthDigit}`);
  }

  return Array.from(variants).filter((item) => item.length >= 8);
}

export function buildMessageWhere(input: {
  clientId?: string;
  number?: string;
  numbers?: string[];
  start?: string | null;
  end?: string | null;
  status?: string;
}): any {
  const numberVariants = phoneVariants(input.number);
  const numbers = (input.numbers || []).flatMap(phoneVariants);

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

  const phoneWhere = (values: string[]) => {
    const uniqueValues = Array.from(new Set(values));

    return uniqueValues.length
      ? {
          OR: uniqueValues.flatMap((value) => [
            { from: { contains: value } },
            { to: { contains: value } },
            { from: { endsWith: value } },
            { to: { endsWith: value } },
          ]),
        }
      : {};
  };

  const selectedNumberWhere = phoneWhere(numberVariants);
  const importedNumbersWhere = numbers.length
    ? phoneWhere(numbers)
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
