export function cleanPhone(value?: string | null) {
  return String(value || "").replace(/\D/g, "");
}

export function buildMessageWhere(input: {
  clientId?: string;
  number?: string;
  start?: string | null;
  end?: string | null;
  status?: string;
}): any {
  const number = cleanPhone(input.number);

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

  const numberWhere = number
    ? {
        OR: [{ from: { contains: number } }, { to: { contains: number } }],
      }
    : {};

  if (input.clientId && number) {
    return {
      AND: [
        dateWhere,
        statusWhere,
        {
          OR: [{ clientId: input.clientId }, numberWhere],
        },
      ],
    };
  }

  return {
    ...(input.clientId && { clientId: input.clientId }),
    ...dateWhere,
    ...statusWhere,
    ...numberWhere,
  };
}
