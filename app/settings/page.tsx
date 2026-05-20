"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  CircularProgress,
  CssBaseline,
  Divider,
  InputAdornment,
  Stack,
  TextField,
  ThemeProvider,
  Typography,
} from "@mui/material";
import {
  CheckCircle,
  CloudDone,
  Error as ErrorIcon,
  Key,
  Link as LinkIcon,
  Phone,
  Refresh,
  Save,
  Search,
  Settings,
  Science,
} from "@mui/icons-material";
import AppShell from "@/components/AppShell";
import { theme } from "@/theme";

function sourceLabel(source?: string) {
  if (source === "database") return "Banco de dados";
  if (source === "env") return ".env";
  if (source === "mixed") return "Banco + .env";
  return "Não configurado";
}

async function readApiResponse(res: Response) {
  const text = await res.text();
  const contentType = res.headers.get("content-type") || "";

  if (!text) return {};

  if (contentType.includes("application/json")) {
    return JSON.parse(text);
  }

  if (text.trim().startsWith("<")) {
    throw new Error(
      `O servidor retornou uma página HTML em vez de JSON. Status: ${res.status}. Reinicie o npm run dev e confira o terminal do Next.`
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text.slice(0, 240));
  }
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [testResult, setTestResult] = useState<any>(null);
  const [senders, setSenders] = useState<any[]>([]);
  const [selectedSenderNumbers, setSelectedSenderNumbers] = useState<string[]>([]);
  const [senderSearch, setSenderSearch] = useState("");
  const [syncingSenders, setSyncingSenders] = useState(false);
  const [importingNumbers, setImportingNumbers] = useState(false);
  const [form, setForm] = useState({
    baseUrl: "",
    apiKey: "",
    apiKeyPreview: "",
    apiKeyConfigured: false,
    source: "none",
  });
  const configured = Boolean(form.baseUrl && form.apiKeyConfigured);

  async function loadSenders(search = senderSearch) {
    const params = new URLSearchParams({ limit: "300" });
    if (search.trim()) params.set("search", search.trim());

    const res = await fetch(`/api/settings/infobip/senders?${params}`, {
      cache: "no-store",
    });
    const data = await readApiResponse(res);

    if (res.ok) {
      const list = Array.isArray(data?.senders) ? data.senders : [];
      setSenders(list);
    }
  }

  async function loadConfig() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/settings/infobip", { cache: "no-store" });
      const data = await readApiResponse(res);

      if (!res.ok) {
        throw new Error(data?.error || "Erro ao carregar configurações.");
      }

      setForm({
        baseUrl: data.baseUrl || "",
        apiKey: "",
        apiKeyPreview: data.apiKeyPreview || "",
        apiKeyConfigured: Boolean(data.apiKeyConfigured),
        source: data.source || "none",
      });
      await loadSenders();
    } catch (err: any) {
      setError(err?.message || "Erro ao carregar configurações.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!configured) return;

    const timeout = window.setTimeout(() => {
      loadSenders(senderSearch);
    }, 350);

    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [senderSearch, configured]);

  async function saveConfig() {
    setSaving(true);
    setMessage("");
    setError("");
    setTestResult(null);

    try {
      const res = await fetch("/api/settings/infobip", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: form.baseUrl,
          apiKey: form.apiKey,
        }),
      });

      const data = await readApiResponse(res);

      if (!res.ok) {
        throw new Error(data?.error || "Erro ao salvar configuração.");
      }

      setForm((prev) => ({
        ...prev,
        apiKey: "",
        apiKeyPreview: data.apiKeyPreview || prev.apiKeyPreview,
        apiKeyConfigured: Boolean(data.apiKeyConfigured),
        source: data.source || "database",
      }));
      setMessage("Configurações salvas com sucesso.");
      await loadSenders();
    } catch (err: any) {
      setError(err?.message || "Erro ao salvar configuração.");
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setMessage("");
    setError("");
    setTestResult(null);

    try {
      const res = await fetch("/api/settings/infobip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: form.baseUrl,
          apiKey: form.apiKey,
        }),
      });

      const data = await readApiResponse(res);
      setTestResult(data);
      if (Array.isArray(data?.senders)) {
        setSenders(data.senders);
        setSelectedSenderNumbers([]);
      }

      if (!res.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            `Teste de conexão falhou. Status: ${res.status}`
        );
      }

      if (Array.isArray(data?.senders)) {
        setSenders(data.senders);
        setSelectedSenderNumbers([]);
      }
      setMessage(data?.message || "Conexão validada com sucesso.");
    } catch (err: any) {
      setError(err?.message || "Teste de conexão falhou.");
    } finally {
      setTesting(false);
    }
  }

  async function refreshSenders() {
    setSyncingSenders(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/settings/infobip/senders", {
        method: "POST",
      });
      const data = await readApiResponse(res);

      if (!res.ok) {
        throw new Error(data?.message || "Não foi possível atualizar os números.");
      }

      const list = Array.isArray(data?.senders) ? data.senders : [];
      setSenders(list);
      setSelectedSenderNumbers((prev) =>
        prev.filter((number) =>
          list.some((sender: any) => String(sender.sender) === String(number))
        )
      );
      setMessage(data?.message || "Números atualizados.");
    } catch (err: any) {
      setError(err?.message || "Não foi possível atualizar os números.");
    } finally {
      setSyncingSenders(false);
    }
  }

  async function importNumbers() {
    setImportingNumbers(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/settings/infobip/import-numbers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numbers: selectedSenderNumbers,
        }),
      });
      const data = await readApiResponse(res);

      if (!res.ok) {
        throw new Error(data?.message || "Não foi possível importar os números.");
      }

      if (Array.isArray(data?.senders)) setSenders(data.senders);
      setMessage(data?.message || "Números importados para o dashboard.");
    } catch (err: any) {
      setError(err?.message || "Não foi possível importar os números.");
    } finally {
      setImportingNumbers(false);
    }
  }

  const senderSearchTerm = senderSearch.trim().toLowerCase();
  const filteredSenders = senderSearchTerm
    ? senders.filter((sender) =>
        [
          sender.sender,
          sender.displayName,
          sender.status,
          sender.name,
          sender.description,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value).toLowerCase().includes(senderSearchTerm)
          )
      )
    : senders;
  const allSendersSelected =
    filteredSenders.length > 0 &&
    filteredSenders.every((sender) =>
      selectedSenderNumbers.includes(String(sender.sender))
    );

  function toggleSender(number: string) {
    setSelectedSenderNumbers((prev) =>
      prev.includes(number)
        ? prev.filter((item) => item !== number)
        : [...prev, number]
    );
  }

  function toggleAllSenders() {
    const visibleNumbers = filteredSenders.map((sender) => String(sender.sender));

    setSelectedSenderNumbers((prev) => {
      if (allSendersSelected) {
        return prev.filter((number) => !visibleNumbers.includes(number));
      }

      return Array.from(new Set([...prev, ...visibleNumbers]));
    });
  }

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
          <Box sx={{ width: "100%", maxWidth: 1180, mx: "auto" }}>
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
                  Configurações
                </Typography>
                <Typography color="text.secondary">
                  Configure a integração com a Infobip sem editar arquivos do servidor.
                </Typography>
              </Box>

              <Chip
                icon={configured ? <CloudDone /> : <Settings />}
                label={configured ? "Infobip configurada" : "Configuração pendente"}
                color={configured ? "success" : "warning"}
                variant="outlined"
                sx={{
                  height: 44,
                  bgcolor: "#fff",
                  fontWeight: 900,
                }}
              />
            </Stack>

            {message && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {message}
              </Alert>
            )}

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", lg: "1.4fr .8fr" },
                gap: 2.5,
                alignItems: "start",
              }}
            >
              <Card sx={{ p: 3 }}>
                <Stack spacing={2.5}>
                  <Box>
                    <Typography sx={{ fontSize: 22, fontWeight: 950 }}>
                      Integração Infobip
                    </Typography>
                    <Typography color="text.secondary">
                      Informe a URL base da sua conta e a API key usada para enviar WhatsApp.
                    </Typography>
                  </Box>

                  <Divider />

                  {loading ? (
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                      <CircularProgress size={22} />
                      <Typography color="text.secondary">
                        Carregando configurações...
                      </Typography>
                    </Stack>
                  ) : (
                    <>
                      <TextField
                        label="URL base da Infobip"
                        placeholder="https://xxxxx.api.infobip.com"
                        value={form.baseUrl}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, baseUrl: e.target.value }))
                        }
                        fullWidth
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start">
                                <LinkIcon />
                              </InputAdornment>
                            ),
                          },
                        }}
                      />

                      <TextField
                        label="API key"
                        type="password"
                        placeholder={
                          form.apiKeyConfigured
                            ? `Já configurada (${form.apiKeyPreview})`
                            : "Cole a API key da Infobip"
                        }
                        value={form.apiKey}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, apiKey: e.target.value }))
                        }
                        helperText={
                          form.apiKeyConfigured
                            ? "Deixe em branco para manter a chave atual."
                            : "A chave será salva criptografada no banco."
                        }
                        fullWidth
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start">
                                <Key />
                              </InputAdornment>
                            ),
                          },
                        }}
                      />

                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1.5}
                        sx={{ justifyContent: "flex-end" }}
                      >
                        <Button
                          variant="outlined"
                          startIcon={
                            testing ? <CircularProgress size={18} /> : <Science />
                          }
                          onClick={testConnection}
                          disabled={testing || saving || !form.baseUrl}
                          sx={{ height: 44 }}
                        >
                          Testar conexão
                        </Button>

                        <Button
                          variant="contained"
                          startIcon={
                            saving ? <CircularProgress size={18} /> : <Save />
                          }
                          onClick={saveConfig}
                          disabled={saving || testing || !form.baseUrl}
                          sx={{
                            height: 44,
                            px: 3,
                            background: "linear-gradient(135deg,#2563eb,#6d28d9)",
                          }}
                        >
                          Salvar
                        </Button>
                      </Stack>
                    </>
                  )}
                </Stack>
              </Card>

              <Stack spacing={2.5}>
                <Card sx={{ p: 3 }}>
                  <Stack spacing={2}>
                    <Box
                      sx={{
                        width: 46,
                        height: 46,
                        borderRadius: "50%",
                        display: "grid",
                        placeItems: "center",
                        bgcolor: configured ? "#dcfce7" : "#fee2e2",
                        color: configured ? "#16a34a" : "#dc2626",
                      }}
                    >
                      {configured ? <CheckCircle /> : <ErrorIcon />}
                    </Box>

                    <Box>
                      <Typography sx={{ fontSize: 20, fontWeight: 950 }}>
                        Status
                      </Typography>
                      <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                        Origem atual: {sourceLabel(form.source)}.
                      </Typography>
                    </Box>

                    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                      <Chip
                        label={form.baseUrl ? "URL configurada" : "URL pendente"}
                        color={form.baseUrl ? "success" : "error"}
                        variant="outlined"
                      />
                      <Chip
                        label={
                          form.apiKeyConfigured ? "API key configurada" : "API key pendente"
                        }
                        color={form.apiKeyConfigured ? "success" : "error"}
                        variant="outlined"
                      />
                    </Stack>
                  </Stack>
                </Card>

                {testResult && (
                  <Card sx={{ p: 3 }}>
                    <Typography sx={{ fontSize: 20, fontWeight: 950, mb: 1 }}>
                      Último teste
                    </Typography>
                    <Stack spacing={1}>
                      <Chip
                        label={testResult.ok ? "Conectado" : "Falhou"}
                        color={testResult.ok ? "success" : "error"}
                        sx={{ alignSelf: "flex-start", fontWeight: 900 }}
                      />
                      <Typography color="text.secondary">
                        Status HTTP: {testResult.status || "-"}
                      </Typography>
                      {testResult.message && (
                        <Typography color="text.secondary">
                          {testResult.message}
                        </Typography>
                      )}
                      {typeof testResult.latencyMs === "number" && (
                        <Typography color="text.secondary">
                          Latência: {testResult.latencyMs}ms
                        </Typography>
                      )}
                      {Array.isArray(testResult.attempts) && (
                        <Box
                          component="pre"
                          sx={{
                            m: 0,
                            p: 1.5,
                            maxHeight: 220,
                            overflow: "auto",
                            borderRadius: 2,
                            bgcolor: "#0f172a",
                            color: "#e2e8f0",
                            fontSize: 12,
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {JSON.stringify(testResult.attempts, null, 2)}
                        </Box>
                      )}
                    </Stack>
                  </Card>
                )}
              </Stack>
            </Box>

            <Card sx={{ p: 3, mt: 2.5 }}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                sx={{
                  justifyContent: "space-between",
                  alignItems: { xs: "flex-start", md: "center" },
                  mb: 2,
                }}
              >
                <Box>
                  <Typography sx={{ fontSize: 22, fontWeight: 950 }}>
                    Números Infobip
                  </Typography>
                  <Typography color="text.secondary">
                    Números retornados pela API da Infobip para essa conta.
                  </Typography>
                </Box>

                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Button
                  variant="outlined"
                  startIcon={
                    syncingSenders ? <CircularProgress size={18} /> : <Refresh />
                  }
                  onClick={refreshSenders}
                  disabled={syncingSenders || !configured}
                  sx={{ height: 44 }}
                >
                  Atualizar números
                </Button>
                <Button
                  variant="contained"
                  startIcon={
                    importingNumbers ? <CircularProgress size={18} /> : <Save />
                  }
                  onClick={importNumbers}
                  disabled={
                    importingNumbers ||
                    syncingSenders ||
                    !configured ||
                    !selectedSenderNumbers.length
                  }
                  sx={{
                    height: 44,
                    background: "linear-gradient(135deg,#2563eb,#6d28d9)",
                  }}
                >
                  Importar selecionados
                </Button>
                </Stack>
              </Stack>

              {senders.length > 0 && (
                <Stack
                  spacing={1.5}
                  sx={{
                    mb: 2,
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <TextField
                    fullWidth
                    size="small"
                    label="Filtrar números"
                    placeholder="Digite nome, número ou status"
                    value={senderSearch}
                    onChange={(event) => setSenderSearch(event.target.value)}
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
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.5}
                    sx={{
                      alignItems: { xs: "flex-start", sm: "center" },
                      justifyContent: "space-between",
                    }}
                  >
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      <Checkbox
                        checked={allSendersSelected}
                        indeterminate={
                          filteredSenders.some((sender) =>
                            selectedSenderNumbers.includes(String(sender.sender))
                          ) && !allSendersSelected
                        }
                        onChange={toggleAllSenders}
                        disabled={!filteredSenders.length}
                      />
                      <Typography sx={{ fontWeight: 900 }}>
                        Selecionar visíveis
                      </Typography>
                    </Stack>
                    <Typography color="text.secondary" sx={{ fontSize: 14 }}>
                      {selectedSenderNumbers.length} selecionado(s) de{" "}
                      {senders.length} número(s)
                      {senderSearchTerm
                        ? ` · ${filteredSenders.length} visível(eis)`
                        : ""}
                    </Typography>
                  </Stack>
                </Stack>
              )}

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
                {filteredSenders.map((sender) => (
                  <Box
                    key={sender.sender}
                    onClick={() => toggleSender(String(sender.sender))}
                    sx={{
                      p: 2,
                      borderRadius: 3,
                      border: "1px solid #e2e8f0",
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      minWidth: 0,
                      bgcolor: "#fff",
                      cursor: "pointer",
                      transition: "border-color .15s ease, box-shadow .15s ease",
                      "&:hover": {
                        borderColor: "#93c5fd",
                        boxShadow: "0 12px 28px rgba(15,23,42,.08)",
                      },
                    }}
                  >
                    <Checkbox
                      checked={selectedSenderNumbers.includes(String(sender.sender))}
                      onClick={(event) => event.stopPropagation()}
                      onChange={() => toggleSender(String(sender.sender))}
                    />
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        display: "grid",
                        placeItems: "center",
                        bgcolor: "#dcfce7",
                        color: "#16a34a",
                        flexShrink: 0,
                      }}
                    >
                      <Phone />
                    </Box>

                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 950 }} noWrap>
                        {sender.displayName || "Número Infobip"}
                      </Typography>
                      <Typography color="text.secondary" sx={{ fontSize: 13 }} noWrap>
                        {sender.sender}
                      </Typography>
                      {sender.status && (
                        <Chip
                          size="small"
                          label={sender.status}
                          variant="outlined"
                          sx={{ mt: 1 }}
                        />
                      )}
                    </Box>
                  </Box>
                ))}

                {!senders.length && (
                  <Box
                    sx={{
                      p: 3,
                      borderRadius: 3,
                      border: "1px dashed #cbd5e1",
                      bgcolor: "#fff",
                    }}
                  >
                    <Typography sx={{ fontWeight: 950 }}>
                      Nenhum número sincronizado
                    </Typography>
                    <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                      Clique em Testar conexão ou Atualizar números depois de salvar a API key.
                    </Typography>
                  </Box>
                )}

                {senders.length > 0 && !filteredSenders.length && (
                  <Box
                    sx={{
                      p: 3,
                      borderRadius: 3,
                      border: "1px dashed #cbd5e1",
                      bgcolor: "#fff",
                    }}
                  >
                    <Typography sx={{ fontWeight: 950 }}>
                      Nenhum número encontrado
                    </Typography>
                    <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                      Ajuste o filtro para localizar outro nome ou número.
                    </Typography>
                  </Box>
                )}
              </Box>
            </Card>
          </Box>
        </Box>
      </AppShell>
    </ThemeProvider>
  );
}
