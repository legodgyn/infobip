"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  CircularProgress,
  CssBaseline,
  FormControl,
  InputAdornment,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  ThemeProvider,
  Typography,
} from "@mui/material";
import {
  CheckCircle,
  CloudSync,
  Link as LinkIcon,
  Phone,
  Search,
} from "@mui/icons-material";
import AppShell from "@/components/AppShell";
import { theme } from "@/theme";

type ClientNumber = {
  id: string;
  number: string;
  label: string | null;
};

type Client = {
  id: string;
  name: string;
  numbers?: ClientNumber[];
};

type Sender = {
  sender: string;
  displayName: string | null;
  status: string | null;
};

function formatPhone(value: string) {
  const clean = String(value || "").replace(/\D/g, "");

  if (clean.startsWith("55") && clean.length >= 12) {
    return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9, 13)}`;
  }

  return clean || "-";
}

async function readJsonResponse(res: Response, label: string) {
  const text = await res.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    const excerpt = text.replace(/\s+/g, " ").slice(0, 120);
    throw new Error(
      `${label} respondeu texto/HTML em vez de JSON (HTTP ${res.status}). Trecho: ${excerpt}`
    );
  }
}

export default function SettingsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [senders, setSenders] = useState<Sender[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loadingClients, setLoadingClients] = useState(false);
  const [loadingSenders, setLoadingSenders] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  async function loadClients() {
    setLoadingClients(true);
    try {
      const res = await fetch("/api/settings/clients", { cache: "no-store" });
      const data = await readJsonResponse(res, "Clientes");

      if (!res.ok) {
        throw new Error(data?.error || "Nao foi possivel carregar os clientes.");
      }

      const list = Array.isArray(data) ? data : [];
      setClients(list);
      setClientId((current) => current || list[0]?.id || "");
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar os clientes.",
      });
    } finally {
      setLoadingClients(false);
    }
  }

  async function loadSenders(refresh = false) {
    setLoadingSenders(true);
    setMessage(null);

    try {
      const res = await fetch(
        refresh
          ? "/api/settings/infobip/senders?refresh=1"
          : "/api/settings/infobip/senders",
        {
          cache: "no-store",
        }
      );
      const data = await readJsonResponse(res, "Numeros Infobip");

      if (!res.ok) {
        throw new Error(data?.error || "Nao foi possivel buscar os numeros.");
      }

      setSenders(Array.isArray(data.senders) ? data.senders : []);
      if (data.warning) {
        setMessage({ type: "error", text: data.warning });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Nao foi possivel buscar os numeros.",
      });
    } finally {
      setLoadingSenders(false);
    }
  }

  useEffect(() => {
    loadClients();
    loadSenders(false);
  }, []);

  const currentClient = clients.find((client) => client.id === clientId);
  const linkedNumbers = useMemo(() => {
    return new Set((currentClient?.numbers || []).map((item) => item.number));
  }, [currentClient]);

  const filteredSenders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return senders;

    return senders.filter((sender) => {
      return (
        sender.sender.includes(q) ||
        String(sender.displayName || "").toLowerCase().includes(q)
      );
    });
  }, [search, senders]);

  const selectedSenders = useMemo(() => {
    const selectedSet = new Set(selected);
    return senders.filter((sender) => selectedSet.has(sender.sender));
  }, [selected, senders]);

  function toggleSender(sender: string) {
    setSelected((current) =>
      current.includes(sender)
        ? current.filter((item) => item !== sender)
        : [...current, sender]
    );
  }

  function toggleVisible() {
    const visible = filteredSenders.map((sender) => sender.sender);
    const selectedSet = new Set(selected);
    const allVisibleSelected = visible.every((sender) => selectedSet.has(sender));

    if (allVisibleSelected) {
      setSelected((current) => current.filter((sender) => !visible.includes(sender)));
      return;
    }

    setSelected(Array.from(new Set([...selected, ...visible])));
  }

  async function importSelected() {
    if (!clientId || selectedSenders.length === 0) return;

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/settings/infobip/import-numbers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          numbers: selectedSenders,
        }),
      });
      const data = await readJsonResponse(res, "Vinculo de numeros");

      if (!res.ok) {
        throw new Error(data?.error || "Nao foi possivel vincular os numeros.");
      }

      setMessage({
        type: "success",
        text: `${data.message} ${data.linkedMessages || 0} mensagem(ns) antigas atualizada(s).`,
      });
      setSelected([]);
      await loadClients();
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Nao foi possivel vincular os numeros.",
      });
    } finally {
      setSaving(false);
    }
  }

  const allVisibleSelected =
    filteredSenders.length > 0 &&
    filteredSenders.every((sender) => selected.includes(sender.sender));

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppShell>
        <Box
          sx={{
            p: 3,
            minHeight: "100vh",
            background:
              "radial-gradient(circle at 10% 0%, rgba(37,99,235,.10), transparent 30%), radial-gradient(circle at 90% 0%, rgba(124,58,237,.10), transparent 30%), #f8fafc",
          }}
        >
          <Box sx={{ maxWidth: 1400, mx: "auto" }}>
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
                <Typography sx={{ fontSize: 32, fontWeight: 950 }}>
                  Configuracoes
                </Typography>
                <Typography color="text.secondary">
                  Busque os numeros da Infobip e vincule ao cliente correto.
                </Typography>
              </Box>

              <Button
                variant="outlined"
                startIcon={loadingSenders ? <CircularProgress size={18} /> : <CloudSync />}
                onClick={() => loadSenders(true)}
                disabled={loadingSenders}
                sx={{ height: 44 }}
              >
                Atualizar numeros
              </Button>
            </Stack>

            {(loadingClients || loadingSenders) && <LinearProgress sx={{ mb: 2 }} />}

            {message && (
              <Alert severity={message.type} sx={{ mb: 2 }}>
                {message.text}
              </Alert>
            )}

            <Card sx={{ p: 3 }}>
              <Stack spacing={3}>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
                    gap: 2,
                  }}
                >
                  <FormControl fullWidth>
                    <InputLabel>Cliente</InputLabel>
                    <Select
                      label="Cliente"
                      value={clientId}
                      onChange={(event) => setClientId(String(event.target.value))}
                    >
                      {clients.map((client) => (
                        <MenuItem key={client.id} value={client.id}>
                          {client.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <TextField
                    label="Filtrar numeros"
                    placeholder="Nome ou numero"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <Search />
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                </Box>

                <Box
                  sx={{
                    p: 2,
                    border: "1px solid #e2e8f0",
                    borderRadius: 4,
                    bgcolor: "#f8fafc",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 2,
                    flexWrap: "wrap",
                  }}
                >
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                    <Checkbox
                      checked={allVisibleSelected}
                      indeterminate={
                        !allVisibleSelected &&
                        filteredSenders.some((sender) => selected.includes(sender.sender))
                      }
                      onChange={toggleVisible}
                    />
                    <Box>
                      <Typography sx={{ fontWeight: 950 }}>Selecionar visiveis</Typography>
                      <Typography color="text.secondary" sx={{ fontSize: 13 }}>
                        {selected.length} selecionado(s) de {senders.length} numero(s)
                      </Typography>
                    </Box>
                  </Stack>

                  <Button
                    variant="contained"
                    startIcon={saving ? <CircularProgress color="inherit" size={18} /> : <LinkIcon />}
                    disabled={!clientId || selectedSenders.length === 0 || saving}
                    onClick={importSelected}
                    sx={{
                      px: 3,
                      background: "linear-gradient(135deg,#2563eb,#6d28d9)",
                      boxShadow: "0 16px 35px rgba(37,99,235,.25)",
                    }}
                  >
                    Vincular selecionados
                  </Button>
                </Box>

                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      md: "repeat(2, minmax(0, 1fr))",
                      xl: "repeat(3, minmax(0, 1fr))",
                    },
                    gap: 1.5,
                  }}
                >
                  {filteredSenders.map((sender) => {
                    const checked = selected.includes(sender.sender);
                    const linked = linkedNumbers.has(sender.sender);

                    return (
                      <Box
                        key={sender.sender}
                        onClick={() => toggleSender(sender.sender)}
                        sx={{
                          p: 2,
                          border: "1px solid",
                          borderColor: checked ? "#2563eb" : "#e2e8f0",
                          borderRadius: 4,
                          bgcolor: checked ? "#eff6ff" : "#fff",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 1.5,
                          minWidth: 0,
                        }}
                      >
                        <Checkbox checked={checked} />
                        <Avatar sx={{ bgcolor: linked ? "#dcfce7" : "#eff6ff", color: linked ? "#16a34a" : "#2563eb" }}>
                          {linked ? <CheckCircle /> : <Phone />}
                        </Avatar>

                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography sx={{ fontWeight: 950 }} noWrap>
                            {sender.displayName || formatPhone(sender.sender)}
                          </Typography>
                          <Typography color="text.secondary" sx={{ fontSize: 13 }} noWrap>
                            {formatPhone(sender.sender)}
                          </Typography>
                        </Box>

                        {linked && (
                          <Chip size="small" color="success" variant="outlined" label="Ja vinculado" />
                        )}
                      </Box>
                    );
                  })}
                </Box>

                {filteredSenders.length === 0 && (
                  <Box
                    sx={{
                      p: 5,
                      borderRadius: 4,
                      bgcolor: "#f8fafc",
                      textAlign: "center",
                    }}
                  >
                    <Phone sx={{ fontSize: 52, color: "#98a2b3" }} />
                    <Typography sx={{ fontWeight: 950, mt: 1 }}>
                      Nenhum numero encontrado
                    </Typography>
                    <Typography color="text.secondary">
                      Atualize a lista ou altere o filtro de busca.
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Card>
          </Box>
        </Box>
      </AppShell>
    </ThemeProvider>
  );
}
