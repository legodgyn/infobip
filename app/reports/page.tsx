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

function statusChip(status?: string) {
  const s = String(status || "").toLowerCase();

  if (s.includes("delivered")) {
    return (
      <Chip
        size="small"
        icon={<CheckCircle />}
        label="Entregue"
        color="success"
      />
    );
  }

  if (s.includes("seen") || s.includes("read")) {
    return (
      <Chip
        size="small"
        icon={<Visibility />}
        label="Lida"
        color="primary"
      />
    );
  }

  if (s.includes("failed") || s.includes("rejected")) {
    return (
      <Chip
        size="small"
        icon={<Error />}
        label="Falhou"
        color="error"
      />
    );
  }

  if (s.includes("sent")) {
    return (
      <Chip
        size="small"
        icon={<Send />}
        label="Enviada"
        color="info"
      />
    );
  }

  return <Chip size="small" label={status || "Pendente"} variant="outlined" />;
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
        p: 2,
        display: "flex",
        justifyContent: "space-between",
        borderBottom: "1px solid #eef2f6",
      }}
    >
     <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <FilterAlt fontSize="small" />
        <Typography sx={{ fontWeight: 900 }}>Dados monitorados</Typography>
      </Stack>

      <Stack direction="row" spacing={1}>
        <Button startIcon={<Refresh />} onClick={onRefresh}>
          Atualizar
        </Button>

        <Button variant="contained" startIcon={<Download />} href={exportUrl}>
          Exportar CSV
        </Button>
      </Stack>
    </GridToolbarContainer>
  );
}

export default function ReportsPage() {
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

  const query = useMemo(() => buildQuery(filters), [filters]);

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
    loadClients();
  }, []);

  useEffect(() => {
    loadReports();

    const timer = setInterval(loadReports, 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    const events = new EventSource("/api/realtime");

    events.onmessage = () => {
      loadClients();
      loadReports();
    };

    return () => {
      events.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const availableNumbers = useMemo(() => {
    const map = new Map<string, any>();

    for (const client of clients) {
      if (filters.clientId && client.id !== filters.clientId) continue;

      for (const item of client.numbers || []) {
        const number = String(item.number || "").replace(/\D/g, "");
        if (!number) continue;

        map.set(number, {
          ...item,
          number,
          label: item.label || client.name || "Infobip",
        });
      }
    }

    return Array.from(map.values());
  }, [clients, filters.clientId]);

  const total = rows.length;

  const delivered = rows.filter((r) =>
    String(r.status || "").toLowerCase().includes("delivered")
  ).length;

  const seen = rows.filter((r) => {
    const s = String(r.status || "").toLowerCase();
    return s.includes("seen") || s.includes("read");
  }).length;

  const failed = rows.filter((r) => {
    const s = String(r.status || "").toLowerCase();
    return s.includes("failed") || s.includes("rejected");
  }).length;

  const inbound = rows.filter((r) => r.direction === "inbound").length;

  const columns: GridColDef[] = [
    {
      field: "client",
      headerName: "Cliente",
      width: 180,
      valueGetter: (_value, row: any) => row.client?.name || "Sem cliente",
    },
    {
      field: "direction",
      headerName: "Direção",
      width: 120,
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
      width: 180,
      valueFormatter: (value) => formatPhone(String(value || "")),
    },
    {
      field: "to",
      headerName: "Para",
      width: 180,
      valueFormatter: (value) => formatPhone(String(value || "")),
    },
    {
      field: "status",
      headerName: "Status",
      width: 160,
      renderCell: (params) => statusChip(params.value),
    },
    {
      field: "text",
      headerName: "Mensagem",
      flex: 1,
      minWidth: 260,
      valueGetter: (_value, row: any) => row.text || "-",
    },
    {
      field: "createdAt",
      headerName: "Data",
      width: 180,
      valueFormatter: (value) =>
        value ? new Date(String(value)).toLocaleString("pt-BR") : "-",
    },
    {
      field: "failureReason",
      headerName: "Motivo da falha",
      width: 220,
      valueGetter: (_value, row: any) => row.failureReason || "-",
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
            background:
              "radial-gradient(circle at 12% 0%, rgba(37,99,235,.10), transparent 30%), radial-gradient(circle at 90% 0%, rgba(124,58,237,.10), transparent 30%), #f8fafc",
          }}
        >
          <Box sx={{ width: "100%", maxWidth: "1680px", mx: "auto" }}>
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
                Exportar CSV
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
                    p: 2.2,
                    borderRadius: 4,
                    border: "1px solid #eef2f6",
                    boxShadow: "0 18px 45px rgba(15,23,42,.06)",
                    background: "#fff",
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
                p: 3,
                mb: 3,
                borderRadius: 4,
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
                      md: "1.2fr 1.2fr 1fr 1fr 1fr auto",
                    },
                    gap: 2,
                    alignItems: "end",
                  }}
                >
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
                      disabled={!availableNumbers.length}
                    >
                      <MenuItem value="">Todos os números</MenuItem>
                      {availableNumbers.map((item: any) => (
                        <MenuItem key={item.number} value={item.number}>
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
                height: 650,
                overflow: "hidden",
                borderRadius: 4,
                border: "1px solid #e2e8f0",
                boxShadow: "0 20px 50px rgba(15,23,42,.05)",
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
                  "& .MuiDataGrid-columnHeaders": {
                    bgcolor: "#f8fafc",
                    fontWeight: 900,
                  },
                  "& .MuiDataGrid-cell": {
                    borderColor: "#eef2f6",
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
