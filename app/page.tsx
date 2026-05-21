"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Avatar,
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
  CheckCircle,
  Download,
  Error,
  Forum,
  Refresh,
  Send,
  TrendingUp,
  Visibility,
} from "@mui/icons-material";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AppShell from "@/components/AppShell";
import { theme } from "@/theme";

const emptyChart = [
  {
    name: "Sem dados",
    enviados: 0,
    entregues: 0,
    lidas: 0,
    falhas: 0,
    respostas: 0,
  },
];

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value || 0);
}

function formatDateTime(value?: string | null) {
  if (!value) return "Sem registro";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

export default function DashboardPage() {
  const [user, setUser] = useState<any>(undefined);
  const [data, setData] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>(emptyChart);
  const [clients, setClients] = useState<any[]>([]);
  const [senders, setSenders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState({
    clientId: "",
    number: "",
    start: "",
    end: "",
  });

  const isAdmin = user?.role === "admin";

  const selectedClient = isAdmin
    ? clients.find((client) => client.id === filters.clientId)
    : clients.find((client) => client.id === user?.clientId);

  const allClientNumbers = useMemo(() => {
    const map = new Map<string, any>();

    for (const client of clients) {
      for (const item of client.numbers || []) {
        const number = String(item.number || "").replace(/\D/g, "");
        if (!number) continue;

        map.set(number, {
          ...item,
          id: item.id || number,
          number,
          label: item.label || client.name || "Infobip",
        });
      }
    }

    for (const sender of senders) {
      const number = String(sender.sender || "").replace(/\D/g, "");
      if (!number || map.has(number)) continue;

      map.set(number, {
        id: number,
        number,
        label: sender.displayName || sender.status || "Infobip",
      });
    }

    return Array.from(map.values());
  }, [clients, senders]);

  const clientNumbers = selectedClient?.numbers?.length
    ? selectedClient.numbers
    : allClientNumbers;

  const query = useMemo(() => {
    const params = new URLSearchParams();

    const effectiveClientId = isAdmin ? filters.clientId : user?.clientId;

    if (effectiveClientId) params.set("clientId", effectiveClientId);
    if (filters.number) params.set("number", filters.number);
    if (filters.start) params.set("start", filters.start);
    if (filters.end) params.set("end", filters.end);

    return params.toString();
  }, [filters, isAdmin, user?.clientId]);

  async function load() {
    setLoading(true);

    try {
      const [dashboardRes, chartsRes] = await Promise.all([
        fetch(`/api/dashboard?${query}`, { cache: "no-store" }),
        fetch(`/api/charts?${query}`, { cache: "no-store" }),
      ]);

      const dashboard = await dashboardRes.json();
      const charts = await chartsRes.json();

      setData(dashboard);
      setChartData(charts?.length ? charts : emptyChart);
    } finally {
      setLoading(false);
    }
  }

  async function loadUser() {
    const res = await fetch("/api/auth/me");

    if (!res.ok) {
      setUser(null);
      return;
    }

    const data = await res.json();
    setUser(data?.user || null);
  }

  async function loadClients() {
    const res = await fetch("/api/clients");
    if (!res.ok) return;

    const data = await res.json();
    setClients(Array.isArray(data) ? data : []);
  }

  async function loadSenders() {
    const res = await fetch("/api/infobip-senders");
    if (!res.ok) return;

    const data = await res.json();
    setSenders(Array.isArray(data?.senders) ? data.senders : []);
  }

  useEffect(() => {
    loadUser();
    loadClients();
    loadSenders();
  }, []);

  useEffect(() => {
    if (user === undefined) return;

    load();

    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, user]);

  useEffect(() => {
    if (user === undefined) return;

    const handleFocus = () => load();
    const handleVisibility = () => {
      if (!document.hidden) load();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, user]);

  useEffect(() => {
    if (user === undefined) return;

    const events = new EventSource("/api/realtime");

    events.onmessage = () => {
      load();
      loadClients();
      loadSenders();
    };

    return () => {
      events.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, user]);

  const cards = [
    {
      title: "Total monitorado",
      value: data?.total || 0,
      helper: "Mensagens no período",
      icon: <Send />,
      color: "#2563eb",
      bg: "linear-gradient(135deg,#ffffff,#eff6ff)",
    },
    {
      title: "Entregues",
      value: data?.delivered || 0,
      helper: `${data?.deliveryRate || 0}% de entrega`,
      icon: <CheckCircle />,
      color: "#22c55e",
      bg: "linear-gradient(135deg,#ffffff,#ecfdf5)",
    },
    {
      title: "Lidas",
      value: data?.seen || 0,
      helper: `${data?.seenRate || 0}% de leitura`,
      icon: <Visibility />,
      color: "#7c3aed",
      bg: "linear-gradient(135deg,#ffffff,#f5f3ff)",
    },
    {
      title: "Falhas",
      value: data?.failed || 0,
      helper: `${data?.failureRate || 0}% de falha`,
      icon: <Error />,
      color: "#f97316",
      bg: "linear-gradient(135deg,#ffffff,#fff7ed)",
    },
    {
      title: "Msg Recebidas",
      value: data?.inbound || 0,
      helper: `${data?.responseRate || 0}% de resposta`,
      icon: <Forum />,
      color: "#06b6d4",
      bg: "linear-gradient(135deg,#ffffff,#ecfeff)",
    },
  ];

  const pieData = [
    { name: "Entregues", value: data?.deliveryRate || 0, color: "#22c55e" },
    { name: "Lidas", value: data?.seenRate || 0, color: "#7c3aed" },
    { name: "Falhas", value: data?.failureRate || 0, color: "#f97316" },
    { name: "Msg Recebidas", value: data?.responseRate || 0, color: "#06b6d4" },
  ];

  const hasData = Boolean(
    data?.total || data?.delivered || data?.seen || data?.failed || data?.inbound
  );

  function clearFilters() {
    setFilters({
      clientId: "",
      number: "",
      start: "",
      end: "",
    });
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppShell>
        <Box
          sx={{
            minHeight: "100vh",
            width: "100%",
            p: 3,
            overflowX: "hidden",
            background:
              "radial-gradient(circle at 12% 0%, rgba(37,99,235,.10), transparent 30%), radial-gradient(circle at 90% 0%, rgba(124,58,237,.10), transparent 30%), #f8fafc",
          }}
        >
          <Box sx={{ width: "100%", maxWidth: "1680px", mx: "auto" }}>
            <Stack
              direction={{ xs: "column", lg: "row" }}
              sx={{
                justifyContent: "space-between",
                alignItems: { xs: "flex-start", lg: "center" },
                gap: 2,
                mb: 3,
              }}
            >
              <Box>
                <Typography sx={{ fontSize: 34, fontWeight: 950, color: "#0f172a" }}>
                  Dashboard
                </Typography>
                <Typography color="text.secondary">
                  Visão geral dos disparos realizados pela Infobip
                </Typography>
              </Box>

              <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap" }}>
                <Chip
                  icon={<TrendingUp />}
                  label="Performance em tempo real"
                  sx={{
                    height: 44,
                    bgcolor: "#fff",
                    color: "#4f46e5",
                    border: "1px solid #e0e7ff",
                    boxShadow: "0 12px 30px rgba(15,23,42,.06)",
                    fontWeight: 900,
                  }}
                />

                <Button variant="outlined" startIcon={<Refresh />} onClick={load}>
                  Atualizar
                </Button>

                <Button
                  variant="contained"
                  startIcon={<Download />}
                  href={`/api/export?${query}`}
                  sx={{
                    px: 3,
                    height: 44,
                    background: "linear-gradient(135deg,#2563eb,#6d28d9)",
                    boxShadow: "0 16px 35px rgba(37,99,235,.24)",
                  }}
                >
                  Exportar CSV
                </Button>
              </Stack>
            </Stack>

            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1.5}
              sx={{ mb: 2 }}
            >
              <Chip
                label={`Último webhook: ${formatDateTime(data?.lastWebhookAt)}`}
                sx={{
                  bgcolor: "#fff",
                  border: "1px solid #dbeafe",
                  color: "#1d4ed8",
                  fontWeight: 800,
                }}
              />
              <Chip
                label={`Última mensagem: ${formatDateTime(data?.lastMessage?.createdAt)}`}
                sx={{
                  bgcolor: "#fff",
                  border: "1px solid #dcfce7",
                  color: "#15803d",
                  fontWeight: 800,
                }}
              />
            </Stack>

            <Card sx={{ p: 2.5, mb: 3 }}>
              <Stack
                direction={{ xs: "column", xl: "row" }}
                spacing={2}
                sx={{ alignItems: { xs: "stretch", xl: "center" } }}
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
                      setFilters((prev) => ({ ...prev, number: e.target.value }))
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

                <TextField
                  fullWidth
                  type="date"
                  label="Data inicial"
                  value={filters.start}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, start: e.target.value }))
                  }
                  slotProps={{
                    inputLabel: {
                      shrink: true,
                    },
                  }}
                />

                <TextField
                  fullWidth
                  type="date"
                  label="Data final"
                  value={filters.end}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, end: e.target.value }))
                  }
                  slotProps={{
                    inputLabel: {
                      shrink: true,
                    },
                  }}
                />

                <Button
                  variant="outlined"
                  onClick={clearFilters}
                  sx={{ height: 56, minWidth: 130 }}
                >
                  Limpar
                </Button>
              </Stack>
            </Card>

            {!hasData && !loading && (
              <Card
                sx={{
                  p: 2.5,
                  mb: 3,
                  background: "linear-gradient(135deg,#fff7ed,#eff6ff)",
                  border: "1px solid #fed7aa",
                }}
              >
                <Typography sx={{ fontWeight: 950 }}>
                  Ainda não chegaram dados reais da Infobip
                </Typography>
                <Typography color="text.secondary">
                  Quando o webhook receber eventos, os cards e gráficos serão preenchidos automaticamente.
                </Typography>
              </Card>
            )}

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2,1fr)",
                  lg: "repeat(5,1fr)",
                },
                gap: 2.5,
                mb: 3,
              }}
            >
              {cards.map((card) => (
                <Card
                  key={card.title}
                  sx={{
                    p: 2.5,
                    minHeight: 180,
                    background: card.bg,
                    border: "1px solid rgba(226,232,240,.9)",
                    boxShadow: "0 20px 55px rgba(15,23,42,.07)",
                  }}
                >
                  <Avatar
                    sx={{
                      bgcolor: card.color,
                      color: "#fff",
                      width: 48,
                      height: 48,
                      boxShadow: `0 14px 30px ${card.color}40`,
                    }}
                  >
                    {card.icon}
                  </Avatar>

                  <Typography sx={{ mt: 2, color: "#334155", fontWeight: 800 }}>
                    {card.title}
                  </Typography>
                  <Typography sx={{ fontSize: 34, fontWeight: 950, color: "#0f172a" }}>
                    {formatNumber(card.value)}
                  </Typography>

                  <Typography sx={{ fontSize: 13, color: card.color, fontWeight: 800 }}>
                    {card.helper}
                  </Typography>
                </Card>
              ))}
            </Box>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  lg: "2fr 1fr 1fr",
                },
                gap: 2.5,
                mb: 3,
              }}
            >
              <Card sx={{ p: 3, minHeight: 360 }}>
                <Typography sx={{ fontSize: 20, fontWeight: 950, mb: 0.5 }}>
                  Evolução de performance
                </Typography>

                <Box sx={{ height: 270 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="enviados" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="entregues" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.22} />
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="enviados"
                        stroke="#2563eb"
                        fill="url(#enviados)"
                        strokeWidth={3}
                      />
                      <Area
                        type="monotone"
                        dataKey="entregues"
                        stroke="#22c55e"
                        fill="url(#entregues)"
                        strokeWidth={3}
                      />
                      <Area
                        type="monotone"
                        dataKey="lidas"
                        stroke="#7c3aed"
                        fill="transparent"
                        strokeWidth={3}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </Box>
              </Card>

              <Card sx={{ p: 3, minHeight: 360 }}>
                <Typography color="text.secondary" sx={{ fontSize: 14, mb: 2 }}>
                  Falhas no período
                </Typography>

                <Box sx={{ height: 270 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="falhas" fill="#f97316" radius={[12, 12, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </Card>

              <Card sx={{ p: 3, minHeight: 360 }}>
                <Typography sx={{ fontSize: 20, fontWeight: 950, mb: 0.5 }}>
                  Status geral
                </Typography>

                <Box sx={{ height: 170 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                      >
                        {pieData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </Box>

                <Stack spacing={1}>
                  {pieData.map((item) => (
                    <Stack
                      key={item.name}
                      direction="row"
                      sx={{ justifyContent: "space-between" }}
                    >
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            bgcolor: item.color,
                          }}
                        />
                        <Typography sx={{ fontSize: 14 }}>{item.name}</Typography>
                      </Stack>

                      <Typography sx={{ fontWeight: 950 }}>{item.value}%</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Card>
            </Box>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  lg: "1fr 2fr",
                },
                gap: 2.5,
              }}
            >
              <Card
                sx={{
                  p: 3,
                  minHeight: 230,
                  background: "linear-gradient(135deg,#ecfdf5,#eff6ff)",
                }}
              >
                <Typography sx={{ mt: 3, color: "#0f766e" }}>
                  Taxa de entrega
                </Typography>
                <Typography sx={{ fontSize: 32, fontWeight: 950, color: "#064e3b" }}>
                  {data?.deliveryRate || 0}%
                </Typography>

                <Box sx={{ height: 10, bgcolor: "#dbeafe", borderRadius: 99, mt: 1 }}>
                  <Box
                    sx={{
                      width: `${data?.deliveryRate || 0}%`,
                      height: "100%",
                      borderRadius: 99,
                      background: "linear-gradient(90deg,#22c55e,#14b8a6)",
                    }}
                  />
                </Box>

                <Typography sx={{ mt: 1, color: "#22c55e", fontWeight: 800 }}>
                  Meta: 85%
                </Typography>
              </Card>

              <Card sx={{ p: 3, minHeight: 230 }}>
                <Typography sx={{ fontSize: 21, fontWeight: 950, mb: 2 }}>
                  Volume monitorado
                </Typography>

                <Box sx={{ height: 170 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.28} />
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="enviados"
                        stroke="#2563eb"
                        fill="url(#volumeGradient)"
                        strokeWidth={3}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </Box>
              </Card>
            </Box>
          </Box>
        </Box>
      </AppShell>
    </ThemeProvider>
  );
}
