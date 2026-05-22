"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  CssBaseline,
  Divider,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  ThemeProvider,
  Typography,
} from "@mui/material";
import {
  Search,
  MoreVert,
  CheckCircle,
  Send,
  EmojiEmotions,
  AttachFile,
  Mic,
  DoneAll,
  FilterList,
  Add,
  History,
  Notes,
  Person,
  WhatsApp,
  Bolt,
} from "@mui/icons-material";
import AppShell from "@/components/AppShell";
import { theme } from "@/theme";

function formatPhone(phone?: string) {
  if (!phone) return "Sem número";
  const clean = String(phone).replace(/\D/g, "");

  if (clean.startsWith("55") && clean.length >= 12) {
    return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(
      4,
      9
    )}-${clean.slice(9, 13)}`;
  }

  return phone;
}

function getContactName(contact?: string) {
  if (!contact) return "Contato sem número";
  return formatPhone(contact);
}

function normalizePhone(phone?: string) {
  return String(phone || "").replace(/\D/g, "");
}

type ClientNumber = {
  id: string;
  number: string;
  label?: string | null;
};

type Client = {
  id: string;
  name: string;
  numbers?: ClientNumber[];
};

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [numberFilter, setNumberFilter] = useState("");
  const [selectedContact, setSelectedContact] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [sendError, setSendError] = useState("");
  const [selectedFrom, setSelectedFrom] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  async function load(keepSelected = true) {
    try {
      const params = new URLSearchParams();
      if (numberFilter) params.set("number", numberFilter);

      const res = await fetch(`/api/conversations?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Falha ao carregar conversas");
      }

      const list = Array.isArray(data) ? data : [];
      setLoadError("");
      setConversations(list);

      if ((!keepSelected || !selectedContact) && list?.[0]?.contact) {
        setSelectedContact(list[0].contact);
        setSelectedFrom(list[0].businessNumber || "");
      }
    } catch (err: any) {
      setLoadError(err?.message || "Falha ao carregar conversas");
      setConversations([]);
    }
  }

  async function loadClients() {
    const res = await fetch("/api/clients", { cache: "no-store" });
    const data = await res.json();
    setClients(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    setSelectedContact("");
    setSelectedFrom("");
    load(false);

    const timer = setInterval(() => load(true), 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numberFilter]);

  useEffect(() => {
    const events = new EventSource("/api/realtime");

    events.onmessage = () => {
      load(true);
    };

    return () => {
      events.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numberFilter]);

  const filterNumbers = useMemo(() => {
    const map = new Map<string, { number: string; label: string }>();

    for (const client of clients) {
      for (const item of client.numbers || []) {
        const number = normalizePhone(item.number);
        if (!number) continue;

        map.set(number, {
          number,
          label: item.label
            ? `${item.label} • ${formatPhone(number)}`
            : `${client.name} • ${formatPhone(number)}`,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      a.label.localeCompare(b.label, "pt-BR")
    );
  }, [clients]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();

    return conversations.filter((conv) => {
      return (
        String(conv.contact || "").toLowerCase().includes(q) ||
        String(conv.lastMessage || "").toLowerCase().includes(q) ||
        String(conv.clientName || "").toLowerCase().includes(q)
      );
    });
  }, [conversations, search]);

  const selected = useMemo(
    () => conversations.find((c) => c.contact === selectedContact),
    [conversations, selectedContact]
  );

  const messages = useMemo(
    () =>
      selected?.messages
        ? [...selected.messages].sort(
            (a: any, b: any) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          )
        : [],
    [selected?.messages]
  );

  const lastMessage = messages[messages.length - 1];

  const availableNumbers = useMemo(() => {
    const set = new Set<string>();

    if (selected?.businessNumber) set.add(normalizePhone(selected.businessNumber));

    for (const msg of messages) {
      if (msg.direction === "inbound") {
        const n = normalizePhone(msg.to);
        if (n) set.add(n);
      } else {
        const n = normalizePhone(msg.from);
        if (n) set.add(n);
      }
    }

    return Array.from(set);
  }, [selected?.businessNumber, messages]);

  useEffect(() => {
    const nextFrom = selected?.businessNumber
      ? normalizePhone(selected.businessNumber)
      : availableNumbers[0] || "";

    if (nextFrom && nextFrom !== selectedFrom) {
      setSelectedFrom(nextFrom);
      return;
    }
  }, [selected?.businessNumber, availableNumbers, selectedFrom]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedContact, messages.length]);

  async function sendMessage() {
    const text = message.trim();

    if (!text || !selectedContact || sending) return;

    setSending(true);
    setSendError("");

    try {
      const res = await fetch("/api/conversations/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: selectedContact,
          from: selectedFrom || selected?.businessNumber,
          text,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Falha ao enviar mensagem");
      }

      setMessage("");
      await load(true);
    } catch (err: any) {
      setSendError(err?.message || "Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppShell>
        <Box
          sx={{
            height: "100vh",
            overflow: "hidden",
            bgcolor: "#f8fafc",
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              lg: "360px minmax(0, 1fr) 380px",
              xl: "380px minmax(0, 1fr) 410px",
            },
          }}
        >
          <Box
            sx={{
              bgcolor: "#fff",
              borderRight: "1px solid #e5e7eb",
              display: { xs: "none", lg: "flex" },
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            <Box sx={{ p: 2 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <TextField
                  fullWidth
                  placeholder="Pesquise seus contatos"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  size="small"
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <Search fontSize="small" />
                        </InputAdornment>
                      ),
                    },
                  }}
                />

                <TextField
                  select
                  size="small"
                  value={numberFilter}
                  onChange={(e) => setNumberFilter(e.target.value)}
                  sx={{ minWidth: 170 }}
                >
                  <MenuItem value="">Todos</MenuItem>
                  {filterNumbers.map((item) => (
                    <MenuItem key={item.number} value={item.number}>
                      {item.label}
                    </MenuItem>
                  ))}
                </TextField>

                <IconButton>
                  <FilterList />
                </IconButton>

                <IconButton>
                  <MoreVert />
                </IconButton>
              </Stack>
            </Box>

            <Divider />

            <Box sx={{ px: 2, py: 1.5 }}>
              {loadError && (
                <Alert severity="error" sx={{ mb: 1.5 }}>
                  {loadError}
                </Alert>
              )}

              <Stack
                direction="row"
                sx={{ alignItems: "center", justifyContent: "space-between" }}
              >
                <Typography sx={{ fontWeight: 950 }}>Conversas</Typography>
                <Chip
                  size="small"
                  label={`${filtered.length || 0}`}
                  sx={{
                    bgcolor: "#dbeafe",
                    color: "#2563eb",
                    fontWeight: 900,
                  }}
                />
              </Stack>
            </Box>

            <Box sx={{ overflow: "auto", flex: 1 }}>
              {filtered.map((conv) => {
                const active = selectedContact === conv.contact;

                return (
                  <Box
                    key={conv.contact}
                    onClick={() => {
                      setSelectedContact(conv.contact);
                      setSelectedFrom(normalizePhone(conv.businessNumber || ""));
                    }}
                    sx={{
                      p: 1.7,
                      cursor: "pointer",
                      borderBottom: "1px solid #eef2f6",
                      bgcolor: active ? "#eff6ff" : "#fff",
                      "&:hover": {
                        bgcolor: active ? "#eff6ff" : "#f8fafc",
                      },
                    }}
                  >
                    <Stack direction="row" spacing={1.5}>
                      <Avatar
                        sx={{
                          bgcolor: "#fce7f3",
                          color: "#db2777",
                          width: 46,
                          height: 46,
                          fontWeight: 950,
                        }}
                      >
                        {String(conv.contact || "?").slice(-1)}
                      </Avatar>

                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Stack
                          direction="row"
                          sx={{ justifyContent: "space-between", gap: 1 }}
                        >
                          <Typography sx={{ fontWeight: 900 }} noWrap>
                            {getContactName(conv.contact)}
                          </Typography>

                          <Typography
                            color="text.secondary"
                            sx={{ fontSize: 12, whiteSpace: "nowrap" }}
                          >
                            {conv.lastDate
                              ? new Date(conv.lastDate).toLocaleTimeString(
                                  "pt-BR",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )
                              : ""}
                          </Typography>
                        </Stack>

                        <Typography
                          color="text.secondary"
                          noWrap
                          sx={{ mt: 0.3, fontSize: 13 }}
                        >
                          {conv.lastMessage || "Sem mensagem"}
                        </Typography>

                        <Stack direction="row" spacing={0.7} sx={{ mt: 0.8 }}>
                          <Chip
                            size="small"
                            icon={<WhatsApp sx={{ fontSize: 14 }} />}
                            label="WhatsApp"
                            sx={{
                              height: 20,
                              fontSize: 11,
                              bgcolor: "#dcfce7",
                              color: "#16a34a",
                            }}
                          />

                          <Chip
                            size="small"
                            label={conv.clientName || "Sem cliente"}
                            sx={{
                              height: 20,
                              fontSize: 11,
                              bgcolor: "#eef2ff",
                              color: "#4f46e5",
                              maxWidth: 130,
                            }}
                          />

                          <Chip
                            size="small"
                            label={conv.lastStatus || "Novo"}
                            sx={{
                              height: 20,
                              fontSize: 11,
                              bgcolor: "#ffedd5",
                              color: "#ea580c",
                              maxWidth: 130,
                            }}
                          />
                        </Stack>
                      </Box>
                    </Stack>
                  </Box>
                );
              })}
            </Box>
          </Box>

          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              minWidth: 0,
              bgcolor: "#f8fafc",
            }}
          >
            <Box
              sx={{
                px: 2.5,
                py: 1.5,
                bgcolor: "#fff",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={1.5}
                sx={{
                  justifyContent: "space-between",
                  alignItems: { xs: "flex-start", md: "center" },
                }}
              >
                <Stack
                  direction="row"
                  spacing={1.5}
                  sx={{ alignItems: "center" }}
                >
                  <Avatar sx={{ bgcolor: "#fce7f3", color: "#db2777" }}>
                    {selected?.contact ? String(selected.contact).slice(-1) : "?"}
                  </Avatar>

                  <Box>
                    <Typography sx={{ fontWeight: 950 }}>
                      {getContactName(selected?.contact)}
                    </Typography>
                    <Typography
                      color="text.secondary"
                      sx={{ fontSize: 13 }}
                    >
                      WhatsApp • {selected?.clientName || "Sem cliente"} • Última interação{" "}
                      {lastMessage?.createdAt
                        ? new Date(lastMessage.createdAt).toLocaleString("pt-BR")
                        : "-"}
                    </Typography>
                  </Box>
                </Stack>

                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ flexWrap: "wrap", gap: 1 }}
                >
                  <Button variant="outlined" startIcon={<DoneAll />}>
                    Marcar como lida
                  </Button>

                  <Button variant="outlined" startIcon={<CheckCircle />}>
                    Finalizar
                  </Button>

                  <IconButton>
                    <MoreVert />
                  </IconButton>
                </Stack>
              </Stack>
            </Box>

            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                overflow: "auto",
                px: { xs: 2, md: 4 },
                py: 3,
                bgcolor: "#f8fafc",
                backgroundImage:
                  "radial-gradient(#dbe1ea 0.7px, transparent 0.7px)",
                backgroundSize: "18px 18px",
              }}
            >
              {messages.length === 0 ? (
                <Box
                  sx={{
                    height: "100%",
                    display: "grid",
                    placeItems: "center",
                    textAlign: "center",
                  }}
                >
                  <Box>
                    <Person sx={{ fontSize: 70, color: "#94a3b8" }} />
                    <Typography sx={{ fontWeight: 950, mt: 1 }}>
                      Nenhuma conversa selecionada
                    </Typography>
                    <Typography color="text.secondary">
                      As respostas da Infobip aparecerão aqui.
                    </Typography>
                  </Box>
                </Box>
              ) : (
                <Stack spacing={2}>
                  <Chip
                    label="Hoje"
                    size="small"
                    sx={{
                      alignSelf: "center",
                      bgcolor: "#e5e7eb",
                      color: "#475569",
                      fontWeight: 800,
                    }}
                  />

                  {messages.map((msg: any) => {
                    const inbound = msg.direction === "inbound";

                    return (
                      <Box
                        key={msg.id}
                        sx={{
                          display: "flex",
                          justifyContent: inbound ? "flex-start" : "flex-end",
                        }}
                      >
                        <Stack
                          direction="row"
                          spacing={1}
                          sx={{
                            alignItems: "flex-start",
                            maxWidth: { xs: "92%", md: "72%" },
                          }}
                        >
                          {inbound && (
                            <Avatar
                              sx={{
                                bgcolor: "#fce7f3",
                                color: "#db2777",
                                width: 34,
                                height: 34,
                              }}
                            >
                              {String(msg.from || "?").slice(-1)}
                            </Avatar>
                          )}

                          <Box>
                            {inbound && (
                              <Typography
                                sx={{
                                  color: "#db2777",
                                  mb: 0.5,
                                  fontSize: 13,
                                  fontWeight: 950,
                                }}
                              >
                                {getContactName(msg.from)}
                              </Typography>
                            )}

                            <Box
                              sx={{
                                px: 1.5,
                                py: 1.2,
                                borderRadius: inbound
                                  ? "6px 18px 18px 18px"
                                  : "18px 6px 18px 18px",
                                bgcolor: inbound ? "#fff" : "#dbeafe",
                                border: "1px solid #e5e7eb",
                                boxShadow: "0 10px 25px rgba(15,23,42,.04)",
                                whiteSpace: "pre-wrap",
                              }}
                            >
                              <Typography sx={{ fontSize: 14.5 }}>
                                {msg.text || msg.status || "Mensagem sem texto"}
                              </Typography>

                              <Stack
                                direction="row"
                                spacing={1}
                                sx={{ mt: 0.7, justifyContent: "flex-end" }}
                              >
                                <Typography
                                  color="text.secondary"
                                  sx={{ fontSize: 11 }}
                                >
                                  {msg.createdAt
                                    ? new Date(msg.createdAt).toLocaleTimeString(
                                        "pt-BR",
                                        {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        }
                                      )
                                    : ""}
                                </Typography>

                                {!inbound && (
                                  <Typography
                                    sx={{ fontSize: 11, color: "#2563eb" }}
                                  >
                                    {msg.status || "enviado"}
                                  </Typography>
                                )}
                              </Stack>
                            </Box>
                          </Box>
                        </Stack>
                      </Box>
                    );
                  })}

                  <div ref={messagesEndRef} />
                </Stack>
              )}
            </Box>

            <Box
              sx={{
                bgcolor: "#fff",
                borderTop: "1px solid #e5e7eb",
                px: 2,
                py: 1.3,
              }}
            >
              {sendError && (
                <Alert severity="error" sx={{ mb: 1 }}>
                  {sendError}
                </Alert>
              )}

              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <IconButton>
                  <Add />
                </IconButton>

                <IconButton disabled title="Envio de arquivo será ativado na próxima etapa">
                  <AttachFile />
                </IconButton>

                <IconButton disabled title="Áudio será ativado na próxima etapa">
                  <Mic />
                </IconButton>

                {availableNumbers.length > 1 && (
                  <TextField
                    select
                    size="small"
                    label="Remetente"
                    value={selectedFrom}
                    onChange={(e) => setSelectedFrom(e.target.value)}
                    sx={{ width: 210 }}
                  >
                    {availableNumbers.map((number) => (
                      <MenuItem key={number} value={number}>
                        {formatPhone(number)}
                      </MenuItem>
                    ))}
                  </TextField>
                )}

                <TextField
                  fullWidth
                  size="small"
                  placeholder={
                    selectedContact
                      ? "Digite uma mensagem..."
                      : "Selecione uma conversa..."
                  }
                  value={message}
                  disabled={!selectedContact || sending}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />

                <IconButton>
                  <EmojiEmotions />
                </IconButton>

                <IconButton
                  color="primary"
                  disabled={!message.trim() || !selectedContact || sending}
                  onClick={sendMessage}
                  sx={{
                    bgcolor: "#2563eb",
                    color: "#fff",
                    "&:hover": { bgcolor: "#1d4ed8" },
                    "&.Mui-disabled": {
                      bgcolor: "#e5e7eb",
                      color: "#94a3b8",
                    },
                  }}
                >
                  {sending ? <CircularProgress size={20} /> : <Send />}
                </IconButton>
              </Stack>
            </Box>
          </Box>

          <Box
            sx={{
              bgcolor: "#fff",
              borderLeft: "1px solid #e5e7eb",
              overflow: "auto",
              display: { xs: "none", lg: "block" },
            }}
          >
            <Box sx={{ p: 2 }}>
              <Stack
                direction="row"
                spacing={1.5}
                sx={{ alignItems: "center" }}
              >
                <Avatar sx={{ bgcolor: "#fce7f3", color: "#db2777" }}>
                  {selected?.contact ? String(selected.contact).slice(-1) : "?"}
                </Avatar>

                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 950 }} noWrap>
                    {getContactName(selected?.contact)}
                  </Typography>
                  <Typography
                    color="text.secondary"
                    noWrap
                    sx={{ fontSize: 12 }}
                  >
                    Lead monitorado
                  </Typography>
                </Box>
              </Stack>
            </Box>

            <Divider />

            <Box sx={{ p: 2 }}>
              <Typography sx={{ fontWeight: 950, mb: 1.5 }}>
                Ações
              </Typography>

              <Stack
                direction="row"
                spacing={1}
                sx={{ flexWrap: "wrap", gap: 1 }}
              >
                <Button size="small" variant="outlined" startIcon={<Bolt />}>
                  Executar automação
                </Button>
                <Button size="small" variant="outlined" startIcon={<Add />}>
                  Adicionar negócio
                </Button>
              </Stack>
            </Box>

            <Divider />

            <Box sx={{ p: 2 }}>
              <Typography sx={{ fontWeight: 950, mb: 1.5 }}>
                Perfil
              </Typography>

              <Stack spacing={1.5}>
                <Stack
                  direction="row"
                  sx={{ justifyContent: "space-between", gap: 2 }}
                >
                  <Typography color="text.secondary" sx={{ fontSize: 13 }}>
                    Nome
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: 13,
                      fontWeight: 800,
                      textAlign: "right",
                    }}
                  >
                    {getContactName(selected?.contact)}
                  </Typography>
                </Stack>

                <Stack
                  direction="row"
                  sx={{ justifyContent: "space-between", gap: 2 }}
                >
                  <Typography color="text.secondary" sx={{ fontSize: 13 }}>
                    Telefone
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: 13,
                      fontWeight: 800,
                      textAlign: "right",
                    }}
                  >
                    {formatPhone(selected?.contact)}
                  </Typography>
                </Stack>

                <Stack
                  direction="row"
                  sx={{ justifyContent: "space-between", gap: 2 }}
                >
                  <Typography color="text.secondary" sx={{ fontSize: 13 }}>
                    Cliente
                  </Typography>
                  <Typography
                    color="text.secondary"
                    sx={{ fontSize: 13, textAlign: "right" }}
                  >
                    {selected?.clientName || "Sem cliente"}
                  </Typography>
                </Stack>

                <Stack
                  direction="row"
                  sx={{ justifyContent: "space-between", gap: 2 }}
                >
                  <Typography color="text.secondary" sx={{ fontSize: 13 }}>
                    Remetente
                  </Typography>
                  <Typography
                    color="text.secondary"
                    sx={{ fontSize: 13, textAlign: "right" }}
                  >
                    {formatPhone(selected?.businessNumber)}
                  </Typography>
                </Stack>
              </Stack>
            </Box>

            <Divider />

            <Box sx={{ p: 2 }}>
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: "center", mb: 1 }}
              >
                <Notes fontSize="small" />
                <Typography sx={{ fontWeight: 950 }}>Notas</Typography>
              </Stack>

              <TextField
                fullWidth
                multiline
                minRows={4}
                placeholder="Anotações internas..."
              />
            </Box>

            <Divider />

            <Box sx={{ p: 2 }}>
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: "center", mb: 1.5 }}
              >
                <History fontSize="small" />
                <Typography sx={{ fontWeight: 950 }}>Histórico</Typography>
              </Stack>

              <Stack spacing={1.2}>
                <Card sx={{ p: 1.5, bgcolor: "#f8fafc" }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 800 }}>
                    Lead criado
                  </Typography>
                  <Typography color="text.secondary" sx={{ fontSize: 12 }}>
                    Evento recebido via webhook
                  </Typography>
                </Card>

                <Card sx={{ p: 1.5, bgcolor: "#f8fafc" }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 800 }}>
                    Última mensagem recebida
                  </Typography>
                  <Typography color="text.secondary" sx={{ fontSize: 12 }}>
                    {lastMessage?.createdAt
                      ? new Date(lastMessage.createdAt).toLocaleString("pt-BR")
                      : "-"}
                  </Typography>
                </Card>
              </Stack>
            </Box>
          </Box>
        </Box>
      </AppShell>
    </ThemeProvider>
  );
}
