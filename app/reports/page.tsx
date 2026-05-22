"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  Chip,
  CssBaseline,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  ThemeProvider,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  DataGrid,
  GridColDef,
  GridToolbarContainer,
} from "@mui/x-data-grid";
import {
  Download,
  FilterAlt,
  Refresh,
  CheckCircle,
  Visibility,
  Error,
  Send,
  Forum,
} from "@mui/icons-material";
import AppShell from "@/components/AppShell";
import { theme } from "@/theme";

function statusText(row: any) {
  const s = String(row?.status || "").toLowerCase();

  if (row?.failedAt || s.includes("failed") || s.includes("rejected")) {
    return "failed";
  }

  if (row?.seenAt || s.includes("seen") || s.includes("read")) {
    return "seen";
  }

  if (row?.deliveredAt || s.includes("delivered")) {
    return "delivered";
  }

  if (s.includes("sent")) {
    return "sent";
  }

  return s || "pending";
}

function statusChip(row: any) {
  const status = statusText(row);

  if (status === "seen") {
    return (
      <Chip
        size="small"
        icon={<Visibility />}
        label="Lida"
        color="primary"
      />
    );
  }

  if (status === "delivered") {
    return (
      <Chip
        size="small"
        icon={<CheckCircle />}
        label="Entregue"
        color="success"
      />
    );
  }

  if (status === "failed") {
    return (
      <Chip
        size="small"
        icon={<Error />}
        label="Falhou"
        color="error"
      />
    );
  }

  if (status === "sent") {
    return (
      <Chip
        size="small"
        icon={<Send />}
        label="Enviada"
        color="info"
      />
    );
  }

  return <Chip size="small" label={row?.status || "Pendente"} variant="outlined" />;
}

function formatPhone(phone?: string) {
  if (!phone) return "-";

  const clean = String(phone).replace(/\D/g, "");

  if (clean.startsWith("55") && clean.length >= 12) {
    return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(
      4,
      9
    )}-${clean.slice(9, 13)}`;
  }

  return phone;
}

function TruncatedText({ value }: { value?: string | null }) {
  const text = value || "-";

  return (
    <Tooltip title={text} disableHoverListener={text.length < 42}>
      <Typography
        component="span"
        sx={{
          display: "block",
          maxWidth: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontSize: 14,
        }}
      >
        {text}
      </Typography>
    </Tooltip>
  );
}

function buildQuery(filters: any) {
  const params = new URLSearchParams();

  if (filters.clientId) params.set("clientId", filters.clientId);
  if (filters.number) params.set("number", filters.number);
  if (filters.status && filters.status !== "all") {
    params.set("status", filters.status);
  }
  if (filters.start) params.set("start", filters.start);
  if (filters.end) params.set("end", filters.end);

  return params.toString();
}

function CustomToolbar({
  onRefresh,
  exportUrl,
}: {
  onRefresh: () => void;
  exportUrl: string;
}) {
  return (
    <GridToolbarContainer
      sx={{
        px: 2,
        py: 1.5,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 2,
        borderBottom: "1px solid #eef2f6",
      }}
    >
     <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <FilterAlt fontSize="small" />
        <Typography sx={{ fontWeight: 900 }}>Dados monitorados</Typography>
      </Stack>

      <Stack direction="row" spacing={1}>
        <Button size="small" startIcon={<Refresh />} onClick={onRefresh}>
          Atualizar
        </Button>

        <Button size="small" variant="contained" startIcon={<Download />} href={exportUrl}>
          Exportar XLSX
        </Button>
      </Stack>
    </GridToolbarContainer>
  );
}

export default function ReportsPage() {
  const [user, setUser] = useState<any>(undefined);
  const [rows, setRows] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState({
    clientId: "",
    number: "",
    status: "all",
    start: "",
    end: "",
  });

  const isAdmin = user?.role === "admin";
  const selectedClient = isAdmin
    ? clients.find((client) => client.id === filters.clientId)
    : clients.find((client) => client.id === user?.clientId);
  const clientNumbers = selectedClient?.numbers || [];

  const query = useMemo(() => buildQuery(filters), [filters]);

  async function loadUser() {
    const res = await fetch("/api/auth/me");

    if (!res.ok) {
      setUser(null);
      return;
    }

    const data = await res.json();
    setUser(data?.user || null);
  }

  async function loadReports() {
    setLoading(true);

    try {
      const res = await fetch(`/api/reports?${query}`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  async function loadClients() {
    const res = await fetch("/api/clients");

    if (!res.ok) return;

    const data = await res.json();
    setClients(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    loadUser();
    loadClients();
  }, []);

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const total = rows.length;

  const delivered = rows.filter((r) => statusText(r) === "delivered").length;
  const seen = rows.filter((r) => statusText(r) === "seen").length;
  const failed = rows.filter((r) => statusText(r) === "failed").length;

  const inbound = rows.filter((r) => r.direction === "inbound").length;

  const columns: GridColDef[] = [
    {
      field: "client",
      headerName: "Cliente",
      minWidth: 130,
      flex: 0.8,
      valueGetter: (_value, row: any) => row.client?.name || "Sem cliente",
      renderCell: (params) => <TruncatedText value={params.value} />,
    },
    {
      field: "direction",
      headerName: "Direção",
      width: 116,
      renderCell: (params) => (
        <Chip
          size="small"
          icon={params.value === "inbound" ? <Forum /> : <Send />}
          label={params.value === "inbound" ? "Entrada" : "Saída"}
          variant="outlined"
        />
      ),
    },
    {
      field: "from",
      headerName: "De",
      minWidth: 140,
      flex: 0.75,
      valueFormatter: (value) => formatPhone(String(value || "")),
    },
    {
      field: "to",
      headerName: "Para",
      minWidth: 140,
      flex: 0.75,
      valueFormatter: (value) => formatPhone(String(value || "")),
    },
    {
      field: "status",
      headerName: "Status",
      width: 132,
      renderCell: (params) => statusChip(params.row),
    },
    {
      field: "text",
      headerName: "Mensagem",
      flex: 1.4,
      minWidth: 220,
      valueGetter: (_value, row: any) => row.text || "-",
      renderCell: (params) => <TruncatedText value={params.value} />,
    },
    {
      field: "createdAt",
      headerName: "Data",
      width: 158,
      valueFormatter: (value) =>
        value ? new Date(String(value)).toLocaleString("pt-BR") : "-",
    },
    {
      field: "failureReason",
      headerName: "Motivo da falha",
      minWidth: 180,
      flex: 1,
      valueGetter: (_value, row: any) => row.failureReason || "-",
      renderCell: (params) => <TruncatedText value={params.value} />,
    },
  ];

  const exportUrl = `/api/export?${query}`;

  function clearFilters() {
    setFilters({
      clientId: "",
      number: "",
      status: "all",
      start: "",
      end: "",
    });
  }

  const summaryCards = [
    { label: "Total", value: total, color: "#2563eb" },
    { label: "Entregues", value: delivered, color: "#22c55e" },
    { label: "Lidas", value: seen, color: "#7c3aed" },
    { label: "Falhas", value: failed, color: "#f97316" },
    { label: "Respostas", value: inbound, color: "#06b6d4" },
  ];

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppShell>
        <Box
          sx={{
            p: 3,
            minHeight: "100vh",
            width: "100%",
            maxWidth: "100%",
            overflowX: "hidden",
            background:
              "radial-gradient(circle at 12% 0%, rgba(37,99,235,.10), transparent 30%), radial-gradient(circle at 90% 0%, rgba(124,58,237,.10), transparent 30%), #f8fafc",
          }}
        >
          <Box sx={{ width: "100%", maxWidth: "100%", mx: "auto", minWidth: 0 }}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              sx={{
                justifyContent: "space-between",
                alignItems: { xs: "flex-start", md: "center" },
                gap: 2,
                mb: 3,
              }}
            >
              <Box>
                <Typography sx={{ fontSize: 34, fontWeight: 950, color: "#0f172a" }}>
                  Relatórios
                </Typography>
                <Typography color="text.secondary">
                  Filtre, analise e exporte os eventos recebidos da Infobip
                </Typography>
              </Box>

              <Button
                variant="contained"
                startIcon={<Download />}
                href={exportUrl}
                sx={{
                  px: 3,
                  height: 46,
                  background: "linear-gradient(135deg,#2563eb,#6d28d9)",
                  boxShadow: "0 16px 35px rgba(37,99,235,.24)",
                }}
              >
                Exportar XLSX
              </Button>
            </Stack>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2,1fr)",
                  lg: "repeat(5,1fr)",
                },
                gap: 2,
                mb: 3,
              }}
            >
              {summaryCards.map((item) => (
                <Card
                  key={item.label}
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    border: "1px solid #eef2f6",
                    boxShadow: "0 18px 45px rgba(15,23,42,.06)",
                    background: "#fff",
                    minWidth: 0,
                  }}
                >
                 <Typography color="text.secondary" sx={{ fontSize: 13 }}>
                    {item.label}
                  </Typography>
                  <Typography sx={{ fontSize: 30, fontWeight: 950, color: "#0f172a" }}>
                    {item.value}
                  </Typography>
                  <Box
                    sx={{
                      mt: 1,
                      width: 42,
                      height: 5,
                      borderRadius: 99,
                      bgcolor: item.color,
                    }}
                  />
                </Card>
              ))}
            </Box>

            <Card
              sx={{
                p: { xs: 2, lg: 2.5 },
                mb: 3,
                borderRadius: 3,
                border: "1px solid #e2e8f0",
                boxShadow: "0 20px 50px rgba(15,23,42,.05)",
                background: "linear-gradient(135deg,#ffffff,#f8fafc)",
              }}
            >
              <Stack spacing={2.2}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <FilterAlt />
                  <Box>
                    <Typography sx={{ fontWeight: 950 }}>Filtros</Typography>
                    <Typography color="text.secondary" sx={{ fontSize: 13 }}>
                      Refine os eventos por cliente, status e período
                    </Typography>
                  </Box>
                </Stack>

                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      md: "repeat(2, minmax(0, 1fr))",
                      xl: "minmax(220px, 1.1fr) minmax(180px, .9fr) minmax(180px, .9fr) minmax(180px, .9fr) auto",
                    },
                    gap: 2,
                    alignItems: "end",
                  }}
                >
                  {isAdmin && (
                    <FormControl fullWidth>
                      <InputLabel>Cliente</InputLabel>
                      <Select
                        label="Cliente"
                        value={filters.clientId}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            clientId: e.target.value,
                            number: "",
                          }))
                        }
                      >
                        <MenuItem value="">Todos os clientes</MenuItem>
                        {clients.map((client) => (
                          <MenuItem key={client.id} value={client.id}>
                            {client.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}

                  <FormControl fullWidth>
                    <InputLabel>Número</InputLabel>
                    <Select
                      label="Número"
                      value={filters.number}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          number: e.target.value,
                        }))
                      }
                      disabled={!clientNumbers.length}
                    >
                      <MenuItem value="">Todos os números</MenuItem>
                      {clientNumbers.map((item: any) => (
                        <MenuItem key={item.id} value={item.number}>
                          {item.label ? `${item.label} • ${item.number}` : item.number}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select
                      label="Status"
                      value={filters.status}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          status: e.target.value,
                        }))
                      }
                    >
                      <MenuItem value="all">Todos</MenuItem>
                      <MenuItem value="sent">Enviadas</MenuItem>
                      <MenuItem value="delivered">Entregues</MenuItem>
                      <MenuItem value="seen">Lidas</MenuItem>
                      <MenuItem value="failed">Falhas</MenuItem>
                      <MenuItem value="rejected">Rejeitadas</MenuItem>
                    </Select>
                  </FormControl>

                  <Box>
                    <Typography sx={{ fontSize: 12, color: "text.secondary", mb: 0.5 }}>
                      Data inicial
                    </Typography>

                    <TextField
                      fullWidth
                      type="date"
                      value={filters.start}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          start: e.target.value,
                        }))
                      }
                    />
                  </Box>

                  <Box>
                    <Typography sx={{ fontSize: 12, color: "text.secondary", mb: 0.5 }}>
                      Data final
                    </Typography>

                    <TextField
                      fullWidth
                      type="date"
                      value={filters.end}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          end: e.target.value,
                        }))
                      }
                    />
                  </Box>

                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="outlined"
                      startIcon={<Refresh />}
                      onClick={loadReports}
                      sx={{ height: 56, whiteSpace: "nowrap" }}
                    >
                      Atualizar
                    </Button>

                    <Button
                      variant="text"
                      onClick={clearFilters}
                      sx={{ height: 56, whiteSpace: "nowrap" }}
                    >
                      Limpar
                    </Button>
                  </Stack>
                </Box>
              </Stack>
            </Card>

            <Card
              sx={{
                height: "min(650px, calc(100vh - 360px))",
                minHeight: 520,
                width: "100%",
                maxWidth: "100%",
                overflow: "hidden",
                borderRadius: 3,
                border: "1px solid #e2e8f0",
                boxShadow: "0 20px 50px rgba(15,23,42,.05)",
                minWidth: 0,
              }}
            >
              <DataGrid
                rows={rows}
                columns={columns}
                loading={loading}
                disableRowSelectionOnClick
                pageSizeOptions={[10, 25, 50, 100]}
                initialState={{
                  pagination: {
                    paginationModel: { pageSize: 25, page: 0 },
                  },
                }}
                slots={{
                  toolbar: () => (
                    <CustomToolbar
                      onRefresh={loadReports}
                      exportUrl={exportUrl}
                    />
                  ),
                }}
                sx={{
                  border: "none",
                  width: "100%",
                  minWidth: 0,
                  "& .MuiDataGrid-columnHeaders": {
                    bgcolor: "#f8fafc",
                    fontWeight: 900,
                  },
                  "& .MuiDataGrid-cell": {
                    borderColor: "#eef2f6",
                    minWidth: 0,
                    alignItems: "center",
                  },
                  "& .MuiDataGrid-columnHeaderTitle": {
                    fontWeight: 900,
                    overflow: "visible",
                  },
                  "& .MuiDataGrid-virtualScroller": {
                    overflowX: "auto",
                  },
                }}
              />
            </Card>
          </Box>
        </Box>
      </AppShell>
    </ThemeProvider>
  );
}
