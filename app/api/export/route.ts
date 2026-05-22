import ExcelJS from "exceljs";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type ExportRow = {
  clientName: string | null;
  businessNumber: string | null;
  direction: string;
  from: string;
  to: string;
  status: string | null;
  text: string | null;
  createdAt: Date | null;
  sentAt: Date | null;
  receivedAt: Date | null;
  deliveredAt: Date | null;
  seenAt: Date | null;
  failedAt: Date | null;
  failureReason: string | null;
};

type Summary = {
  total: number;
  outbound: number;
  inbound: number;
  delivered: number;
  seen: number;
  failed: number;
};

const HEADER_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } } as const;
const HEADER_FONT = { color: { argb: "FFFFFFFF" }, bold: true } as const;
const BLUE_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } } as const;

function businessNumberExpression() {
  return `regexp_replace(
    CASE
      WHEN lower(m."direction"::text) = 'inbound' THEN m."to"
      ELSE m."from"
    END,
    '\\D',
    '',
    'g'
  )`;
}

function addScopedFilters(
  filters: string[],
  values: unknown[],
  options: {
    clientId?: string;
    number?: string;
    status?: string;
    start?: string | null;
    end?: string | null;
  }
) {
  const businessNumber = businessNumberExpression();

  if (options.clientId) {
    values.push(options.clientId);
    const index = values.length;
    filters.push(`
      EXISTS (
        SELECT 1
        FROM "ClientNumber" cn
        WHERE cn."clientId" = $${index}
          AND (
            ${businessNumber} = regexp_replace(cn."number", '\\D', '', 'g')
            OR ${businessNumber} LIKE '%' || regexp_replace(cn."number", '\\D', '', 'g')
            OR regexp_replace(cn."number", '\\D', '', 'g') LIKE '%' || ${businessNumber}
          )
      )
    `);
  } else {
    filters.push(`
      EXISTS (
        SELECT 1
        FROM "ClientNumber" cn
        WHERE ${businessNumber} = regexp_replace(cn."number", '\\D', '', 'g')
          OR ${businessNumber} LIKE '%' || regexp_replace(cn."number", '\\D', '', 'g')
          OR regexp_replace(cn."number", '\\D', '', 'g') LIKE '%' || ${businessNumber}
      )
    `);
  }

  const cleanNumber = options.number?.replace(/\D/g, "");
  if (cleanNumber) {
    values.push(cleanNumber);
    const index = values.length;
    filters.push(`${businessNumber} LIKE '%' || $${index} || '%'`);
  }

  if (options.status && options.status !== "all") {
    values.push(options.status.toLowerCase());
    const index = values.length;
    filters.push(`lower(COALESCE(m."status", '')) LIKE '%' || $${index} || '%'`);
  }

  if (options.start) {
    values.push(new Date(`${options.start}T00:00:00`));
    filters.push(`m."createdAt" >= $${values.length}`);
  }

  if (options.end) {
    values.push(new Date(`${options.end}T23:59:59`));
    filters.push(`m."createdAt" <= $${values.length}`);
  }
}

function statusLabel(row: Pick<ExportRow, "status" | "deliveredAt" | "seenAt" | "failedAt">) {
  const status = String(row.status || "").toLowerCase();

  if (row.failedAt || status.includes("failed") || status.includes("rejected")) {
    return "Falha";
  }

  if (row.seenAt || status.includes("seen") || status.includes("read")) {
    return "Lida";
  }

  if (row.deliveredAt || status.includes("delivered")) {
    return "Entregue";
  }

  if (status.includes("sent")) {
    return "Enviada";
  }

  return row.status || "Pendente";
}

function formatDate(value?: Date | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function pct(value: number, total: number) {
  return total ? value / total : 0;
}

function summarize(rows: ExportRow[]): Summary {
  return rows.reduce(
    (acc, row) => {
      const direction = String(row.direction || "").toLowerCase();
      const status = statusLabel(row);

      acc.total += 1;
      if (direction === "outbound") acc.outbound += 1;
      if (direction === "inbound") acc.inbound += 1;
      if (status === "Entregue") acc.delivered += 1;
      if (status === "Lida") acc.seen += 1;
      if (status === "Falha") acc.failed += 1;

      return acc;
    },
    { total: 0, outbound: 0, inbound: 0, delivered: 0, seen: 0, failed: 0 }
  );
}

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      top: { style: "thin", color: { argb: "FFE2E8F0" } },
      bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
    };
  });
}

function setupSheet(sheet: ExcelJS.Worksheet) {
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.properties.defaultRowHeight = 22;
}

function addSummarySheet(workbook: ExcelJS.Workbook, rows: ExportRow[]) {
  const sheet = workbook.addWorksheet("Resumo");
  const data = summarize(rows);

  sheet.mergeCells("A1:D1");
  sheet.getCell("A1").value = "Relatorio Infobip";
  sheet.getCell("A1").font = { bold: true, size: 18, color: { argb: "FF0F172A" } };
  sheet.getCell("A1").alignment = { vertical: "middle" };
  sheet.getRow(1).height = 32;

  sheet.addRow([]);
  const header = sheet.addRow(["Indicador", "Valor", "Percentual sobre envios", "Observacao"]);
  styleHeader(header);

  const rowsToAdd = [
    ["Total monitorado", data.total, "", "Mensagens no periodo filtrado"],
    ["Enviadas", data.outbound, "", "Disparos/broadcasts"],
    ["Entregues", data.delivered, pct(data.delivered, data.outbound), "Confirmacao de entrega"],
    ["Lidas", data.seen, pct(data.seen, data.outbound), "Confirmacao de leitura"],
    ["Falhas", data.failed, pct(data.failed, data.outbound), "Falhas ou rejeicoes"],
    ["Mensagens recebidas", data.inbound, "", "Respostas dos contatos"],
  ];

  for (const item of rowsToAdd) {
    sheet.addRow(item);
  }

  sheet.getColumn(1).width = 26;
  sheet.getColumn(2).width = 14;
  sheet.getColumn(3).width = 24;
  sheet.getColumn(4).width = 36;
  sheet.getColumn(3).numFmt = "0.00%";

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 3) {
      row.eachCell((cell) => {
        cell.border = { bottom: { style: "thin", color: { argb: "FFE2E8F0" } } };
      });
    }
  });
}

function addGroupedSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  rows: ExportRow[],
  keyGetter: (row: ExportRow) => string
) {
  const sheet = workbook.addWorksheet(name);
  setupSheet(sheet);

  const header = sheet.addRow([
    name,
    "Total",
    "Enviadas",
    "Recebidas",
    "Entregues",
    "Lidas",
    "Falhas",
    "Taxa entrega",
    "Taxa leitura",
    "Taxa falha",
  ]);
  styleHeader(header);

  const groups = new Map<string, ExportRow[]>();
  for (const row of rows) {
    const key = keyGetter(row) || "Sem identificacao";
    groups.set(key, [...(groups.get(key) || []), row]);
  }

  for (const [key, groupRows] of groups.entries()) {
    const data = summarize(groupRows);
    sheet.addRow([
      key,
      data.total,
      data.outbound,
      data.inbound,
      data.delivered,
      data.seen,
      data.failed,
      pct(data.delivered, data.outbound),
      pct(data.seen, data.outbound),
      pct(data.failed, data.outbound),
    ]);
  }

  sheet.columns.forEach((column, index) => {
    column.width = index === 0 ? 32 : 15;
  });
  [8, 9, 10].forEach((columnNumber) => {
    sheet.getColumn(columnNumber).numFmt = "0.00%";
  });
  sheet.autoFilter = {
    from: "A1",
    to: "J1",
  };
}

function addDetailsSheet(workbook: ExcelJS.Workbook, rows: ExportRow[]) {
  const sheet = workbook.addWorksheet("Detalhado");
  setupSheet(sheet);

  const header = sheet.addRow([
    "Cliente",
    "Numero oficial",
    "Direcao",
    "Contato",
    "De",
    "Para",
    "Status",
    "Mensagem",
    "Criado em",
    "Enviado em",
    "Recebido em",
    "Entregue em",
    "Lido em",
    "Falhou em",
    "Motivo da falha",
  ]);
  styleHeader(header);

  for (const row of rows) {
    const direction = String(row.direction || "").toLowerCase();
    sheet.addRow([
      row.clientName || "Sem cliente",
      row.businessNumber || "",
      direction === "inbound" ? "Entrada" : "Saida",
      direction === "inbound" ? row.from : row.to,
      row.from,
      row.to,
      statusLabel(row),
      row.text || "",
      formatDate(row.createdAt),
      formatDate(row.sentAt),
      formatDate(row.receivedAt),
      formatDate(row.deliveredAt),
      formatDate(row.seenAt),
      formatDate(row.failedAt),
      row.failureReason || "",
    ]);
  }

  sheet.columns = [
    { width: 22 },
    { width: 18 },
    { width: 12 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 14 },
    { width: 60 },
    { width: 21 },
    { width: 21 },
    { width: 21 },
    { width: 21 },
    { width: 21 },
    { width: 21 },
    { width: 34 },
  ];
  sheet.autoFilter = {
    from: "A1",
    to: "O1",
  };

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.getCell(8).alignment = { wrapText: true, vertical: "top" };
    row.eachCell((cell) => {
      cell.border = { bottom: { style: "thin", color: { argb: "FFF1F5F9" } } };
    });
  });
}

export async function GET(req: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const clientIdParam = searchParams.get("clientId") || undefined;
  const number = searchParams.get("number") || undefined;
  const status = searchParams.get("status") || undefined;
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  const clientId =
    user.role === "admin" ? clientIdParam : user.clientId || undefined;

  const filters: string[] = [];
  const values: unknown[] = [];
  addScopedFilters(filters, values, { clientId, number, status, start, end });

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const businessNumber = businessNumberExpression();

  const rows = await prisma.$queryRawUnsafe<ExportRow[]>(
    `
      SELECT
        c."name" AS "clientName",
        ${businessNumber} AS "businessNumber",
        m."direction"::text AS "direction",
        m."from",
        m."to",
        m."status",
        m."text",
        m."createdAt",
        m."sentAt",
        m."receivedAt",
        m."deliveredAt",
        m."seenAt",
        m."failedAt",
        m."failureReason"
      FROM "Message" m
      LEFT JOIN "Client" c ON c."id" = m."clientId"
      ${where}
      ORDER BY m."createdAt" DESC
      LIMIT 10000
    `,
    ...values
  );

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Infobip Monitor";
  workbook.created = new Date();
  workbook.modified = new Date();

  addSummarySheet(workbook, rows);
  addGroupedSheet(workbook, "Por numero", rows, (row) => row.businessNumber || "");
  addGroupedSheet(workbook, "Por cliente", rows, (row) => row.clientName || "Sem cliente");
  addDetailsSheet(workbook, rows);

  for (const sheet of workbook.worksheets) {
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.alignment = { ...cell.alignment, vertical: "middle" };
      });
    });
    sheet.getRow(1).height = Math.max(sheet.getRow(1).height || 0, 24);
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=relatorio-infobip.xlsx`,
    },
  });
}
