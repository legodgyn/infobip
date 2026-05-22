"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  CssBaseline,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  LinearProgress,
  Stack,
  TextField,
  ThemeProvider,
  Typography,
} from "@mui/material";
import {
  Add,
  CheckCircle,
  Close,
  Delete,
  Edit,
  Error,
  Forum,
  Key,
  Person,
  Phone,
  Search,
  Visibility,
} from "@mui/icons-material";
import AppShell from "@/components/AppShell";
import { theme } from "@/theme";

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

const emptyClient = {
  id: "",
  name: "",
  email: "",
  phone: "",
};

export default function ClientsPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const [openClient, setOpenClient] = useState(false);
  const [clientForm, setClientForm] = useState(emptyClient);

  const [openNumber, setOpenNumber] = useState(false);
  const [numberForm, setNumberForm] = useState({ number: "", label: "" });

  const [openUser, setOpenUser] = useState(false);
  const [userForm, setUserForm] = useState({
    id: "",
    name: "",
    email: "",
    password: "123456",
  });

  async function loadClients() {
    setLoading(true);

    try {
      const res = await fetch("/api/clients");
      const data = await res.json();

      setClients(Array.isArray(data) ? data : []);

      if (!selected && data?.[0]) {
        setSelected(data[0]);
      }

      if (selected) {
        const fresh = data.find((c: any) => c.id === selected.id);
        if (fresh) setSelected(fresh);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();

    return clients.filter((client) => {
      return (
        String(client.name || "").toLowerCase().includes(q) ||
        String(client.email || "").toLowerCase().includes(q) ||
        String(client.phone || "").toLowerCase().includes(q) ||
        client.numbers?.some((n: any) => String(n.number || "").includes(q))
      );
    });
  }, [clients, search]);

  function createClientModal() {
    setClientForm(emptyClient);
    setOpenClient(true);
  }

  function editClientModal(client: any) {
    setClientForm({
      id: client.id,
      name: client.name || "",
      email: client.email || "",
      phone: client.phone || "",
    });
    setOpenClient(true);
  }

  async function saveClient() {
    if (!clientForm.name.trim()) return;

    await fetch("/api/clients", {
      method: clientForm.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(clientForm),
    });

    setOpenClient(false);
    await loadClients();
  }

  function addNumberModal() {
    setNumberForm({ number: "", label: "" });
    setOpenNumber(true);
  }

  async function saveNumber() {
    if (!selected?.id || !numberForm.number.trim()) return;

    await fetch("/api/numbers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...numberForm, clientId: selected.id }),
    });

    setOpenNumber(false);
    await loadClients();
  }

  async function deleteNumber(id: string) {
    await fetch(`/api/numbers?id=${id}`, {
      method: "DELETE",
    });

    await loadClients();
  }

  function addUserModal() {
    setUserForm({
      id: "",
      name: selected?.name || "",
      email: selected?.email || "",
      password: "123456",
    });
    setOpenUser(true);
  }

  function editUserModal(user: any) {
    setUserForm({
      id: user.id,
      name: user.name || "",
      email: user.email || "",
      password: "",
    });
    setOpenUser(true);
  }

  async function saveUser() {
    if (!selected?.id || !userForm.name || !userForm.email) return;

    await fetch("/api/client-users", {
      method: userForm.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...userForm, clientId: selected.id }),
    });

    setOpenUser(false);
    await loadClients();
  }

  async function deleteUser(id: string) {
    if (!confirm("Excluir este acesso do cliente?")) return;

    await fetch(`/api/client-users?id=${id}`, {
      method: "DELETE",
    });

    await loadClients();
  }

  const summary = [
    {
      label: "Total",
      value: selected?.total || 0,
      icon: <CheckCircle />,
      color: "#2563eb",
    },
    {
      label: "Entregues",
      value: selected?.delivered || 0,
      icon: <CheckCircle />,
      color: "#22c55e",
    },
    {
      label: "Lidas",
      value: selected?.seen || 0,
      icon: <Visibility />,
      color: "#7c3aed",
    },
    {
      label: "Falhas",
      value: selected?.failed || 0,
      icon: <Error />,
      color: "#f97316",
    },
    {
      label: "Respostas",
      value: selected?.inbound || 0,
      icon: <Forum />,
      color: "#06b6d4",
    },
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
              "radial-gradient(circle at 10% 0%, rgba(37,99,235,.10), transparent 30%), radial-gradient(circle at 90% 0%, rgba(124,58,237,.10), transparent 30%), #f8fafc",
          }}
        >
          <Box sx={{ maxWidth: "1600px", mx: "auto", width: "100%" }}>
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
                  Clientes
                </Typography>
                <Typography color="text.secondary">
                  Gerencie clientes, acessos e números vinculados à Infobip
                </Typography>
              </Box>

              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={createClientModal}
                sx={{
                  px: 3,
                  height: 44,
                  background: "linear-gradient(135deg,#2563eb,#6d28d9)",
                  boxShadow: "0 16px 35px rgba(37,99,235,.25)",
                }}
              >
                Novo cliente
              </Button>
            </Stack>

            {loading && <LinearProgress sx={{ mb: 2 }} />}

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  lg: "360px 1fr",
                },
                gap: 3,
                alignItems: "start",
                width: "100%",
              }}
            >
              <Card sx={{ overflow: "hidden", minHeight: 520 }}>
                <Box sx={{ p: 2.5 }}>
                  <TextField
                    fullWidth
                    placeholder="Buscar cliente, e-mail ou número..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
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

                <Divider />

                <Box sx={{ maxHeight: "calc(100vh - 245px)", overflow: "auto" }}>
                  {filtered.map((client) => {
                    const active = selected?.id === client.id;

                    return (
                      <Box
                        key={client.id}
                        onClick={() => setSelected(client)}
                        sx={{
                          p: 2,
                          cursor: "pointer",
                          borderBottom: "1px solid #eef2f6",
                          bgcolor: active ? "#eff6ff" : "#fff",
                          transition: ".2s",
                          "&:hover": {
                            bgcolor: active ? "#eff6ff" : "#f8fafc",
                          },
                        }}
                      >
                        <Stack
                          direction="row"
                          spacing={1.5}
                          sx={{ alignItems: "center" }}
                        >
                          <Avatar
                            sx={{
                              bgcolor: active ? "#2563eb" : "#64748b",
                              width: 42,
                              height: 42,
                              fontWeight: 950,
                            }}
                          >
                            {String(client.name || "?")
                              .slice(0, 1)
                              .toUpperCase()}
                          </Avatar>

                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography sx={{ fontWeight: 950 }} noWrap>
                              {client.name}
                            </Typography>
                            <Typography
                              color="text.secondary"
                              sx={{ fontSize: 13 }}
                              noWrap
                            >
                              {client.email || "Sem e-mail"}
                            </Typography>
                          </Box>

                          <Chip
                            size="small"
                            label={`${client.numbers?.length || 0} nº`}
                            variant="outlined"
                          />
                        </Stack>

                        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                          <Chip
                            size="small"
                            label={`${client.deliveryRate || 0}% entrega`}
                            sx={{ fontSize: 11 }}
                          />
                          <Chip
                            size="small"
                            label={`${client.seenRate || 0}% leitura`}
                            sx={{ fontSize: 11 }}
                          />
                        </Stack>
                      </Box>
                    );
                  })}

                  {filtered.length === 0 && (
                    <Box sx={{ p: 4, textAlign: "center" }}>
                      <Person sx={{ fontSize: 48, color: "#98a2b3" }} />
                      <Typography sx={{ fontWeight: 950, mt: 1 }}>
                        Nenhum cliente encontrado
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Card>

              <Box>
                {!selected ? (
                  <Card sx={{ p: 5, textAlign: "center" }}>
                    <Person sx={{ fontSize: 70, color: "#98a2b3" }} />
                    <Typography sx={{ fontWeight: 950, mt: 2 }}>
                      Selecione um cliente
                    </Typography>
                  </Card>
                ) : (
                  <Stack spacing={2.5}>
                    <Card sx={{ p: 3 }}>
                      <Stack
                        direction={{ xs: "column", md: "row" }}
                        sx={{
                          justifyContent: "space-between",
                          alignItems: { xs: "flex-start", md: "center" },
                          gap: 2,
                        }}
                      >
                        <Stack
                          direction="row"
                          spacing={2}
                          sx={{ alignItems: "center" }}
                        >
                          <Avatar
                            sx={{
                              width: 64,
                              height: 64,
                              bgcolor: "#2563eb",
                              fontSize: 28,
                              fontWeight: 950,
                              boxShadow: "0 16px 35px rgba(37,99,235,.25)",
                            }}
                          >
                            {String(selected.name || "?")
                              .slice(0, 1)
                              .toUpperCase()}
                          </Avatar>

                          <Box>
                            <Typography sx={{ fontSize: 24, fontWeight: 950 }}>
                              {selected.name}
                            </Typography>
                            <Typography color="text.secondary">
                              {selected.email || "Sem e-mail"} •{" "}
                              {formatPhone(selected.phone)}
                            </Typography>
                          </Box>
                        </Stack>

                        <Stack
                          direction="row"
                          spacing={1}
                          sx={{ flexWrap: "wrap", gap: 1 }}
                        >
                          <Button
                            variant="outlined"
                            startIcon={<Edit />}
                            onClick={() => editClientModal(selected)}
                          >
                            Editar
                          </Button>

                          <Button
                            variant="outlined"
                            startIcon={<Key />}
                            onClick={addUserModal}
                          >
                            Acesso
                          </Button>

                          <Button
                            variant="contained"
                            startIcon={<Phone />}
                            onClick={addNumberModal}
                          >
                            Número
                          </Button>
                        </Stack>
                      </Stack>
                    </Card>

                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: {
                          xs: "1fr",
                          sm: "repeat(2,1fr)",
                          xl: "repeat(5,1fr)",
                        },
                        gap: 2,
                      }}
                    >
                      {summary.map((item) => (
                        <Card key={item.label} sx={{ p: 2 }}>
                          <Avatar
                            sx={{
                              width: 40,
                              height: 40,
                              bgcolor: `${item.color}18`,
                              color: item.color,
                            }}
                          >
                            {item.icon}
                          </Avatar>

                          <Typography
                            color="text.secondary"
                            sx={{ fontSize: 13, mt: 1 }}
                          >
                            {item.label}
                          </Typography>

                          <Typography sx={{ fontSize: 26, fontWeight: 950 }}>
                            {item.value}
                          </Typography>
                        </Card>
                      ))}
                    </Box>

                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: {
                          xs: "1fr",
                          lg: "1fr 1fr",
                        },
                        gap: 2.5,
                      }}
                    >
                      <Card sx={{ p: 3, minHeight: 260 }}>
                        <Stack
                          direction="row"
                          sx={{
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            mb: 2,
                            gap: 2,
                          }}
                        >
                          <Box>
                            <Typography sx={{ fontSize: 20, fontWeight: 950 }}>
                              Números Infobip
                            </Typography>
                            <Typography color="text.secondary" sx={{ fontSize: 14 }}>
                              Usados para identificar eventos no webhook
                            </Typography>
                          </Box>

                          <Button startIcon={<Add />} onClick={addNumberModal}>
                            Adicionar
                          </Button>
                        </Stack>

                        <Stack spacing={1.5}>
                          {selected.numbers?.map((number: any) => (
                            <Box
                              key={number.id}
                              sx={{
                                p: 2,
                                borderRadius: 4,
                                border: "1px solid #eef2f6",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                bgcolor: "#fff",
                                gap: 2,
                              }}
                            >
                              <Stack
                                direction="row"
                                spacing={1.5}
                                sx={{ alignItems: "center", minWidth: 0 }}
                              >
                                <Avatar
                                  sx={{
                                    bgcolor: "#eff6ff",
                                    color: "#2563eb",
                                  }}
                                >
                                  <Phone />
                                </Avatar>

                                <Box sx={{ minWidth: 0 }}>
                                  <Typography sx={{ fontWeight: 950 }} noWrap>
                                    {formatPhone(number.number)}
                                  </Typography>
                                  <Typography
                                    color="text.secondary"
                                    sx={{ fontSize: 13 }}
                                    noWrap
                                  >
                                    {number.label || "Sem identificação"}
                                  </Typography>
                                </Box>
                              </Stack>

                              <IconButton
                                color="error"
                                onClick={() => deleteNumber(number.id)}
                              >
                                <Delete />
                              </IconButton>
                            </Box>
                          ))}

                          {selected.numbers?.length === 0 && (
                            <Box
                              sx={{
                                p: 3,
                                borderRadius: 4,
                                bgcolor: "#f8fafc",
                                textAlign: "center",
                              }}
                            >
                              <Phone sx={{ fontSize: 42, color: "#98a2b3" }} />
                              <Typography sx={{ fontWeight: 950, mt: 1 }}>
                                Nenhum número vinculado
                              </Typography>
                              <Typography color="text.secondary" sx={{ fontSize: 14 }}>
                                Adicione o número usado como remetente na Infobip.
                              </Typography>
                            </Box>
                          )}
                        </Stack>
                      </Card>

                      <Card sx={{ p: 3, minHeight: 260 }}>
                        <Stack
                          direction="row"
                          sx={{
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            mb: 2,
                            gap: 2,
                          }}
                        >
                          <Box>
                            <Typography sx={{ fontSize: 20, fontWeight: 950 }}>
                              Usuários de acesso
                            </Typography>
                            <Typography color="text.secondary" sx={{ fontSize: 14 }}>
                              Quem pode acessar o painel desse cliente
                            </Typography>
                          </Box>

                          <Button startIcon={<Add />} onClick={addUserModal}>
                            Adicionar
                          </Button>
                        </Stack>

                        <Stack spacing={1.5}>
                          {selected.users?.map((u: any) => (
                            <Box
                              key={u.id}
                              sx={{
                                p: 2,
                                borderRadius: 4,
                                border: "1px solid #eef2f6",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 1.5,
                                bgcolor: "#fff",
                              }}
                            >
                              <Stack
                                direction="row"
                                spacing={1.5}
                                sx={{ alignItems: "center", minWidth: 0 }}
                              >
                                <Avatar
                                  sx={{
                                    bgcolor: "#f5f3ff",
                                    color: "#7c3aed",
                                  }}
                                >
                                  <Person />
                                </Avatar>

                                <Box sx={{ minWidth: 0 }}>
                                  <Typography sx={{ fontWeight: 950 }} noWrap>
                                    {u.name}
                                  </Typography>
                                  <Typography
                                    color="text.secondary"
                                    sx={{ fontSize: 13 }}
                                    noWrap
                                  >
                                    {u.email}
                                  </Typography>
                                </Box>
                              </Stack>

                              <Stack direction="row" spacing={0.5}>
                                <IconButton
                                  color="primary"
                                  onClick={() => editUserModal(u)}
                                >
                                  <Edit />
                                </IconButton>
                                <IconButton
                                  color="error"
                                  onClick={() => deleteUser(u.id)}
                                >
                                  <Delete />
                                </IconButton>
                              </Stack>
                            </Box>
                          ))}

                          {selected.users?.length === 0 && (
                            <Box
                              sx={{
                                p: 3,
                                borderRadius: 4,
                                bgcolor: "#f8fafc",
                                textAlign: "center",
                              }}
                            >
                              <Person sx={{ fontSize: 42, color: "#98a2b3" }} />
                              <Typography sx={{ fontWeight: 950, mt: 1 }}>
                                Nenhum acesso criado
                              </Typography>
                              <Typography color="text.secondary" sx={{ fontSize: 14 }}>
                                Crie um login para o cliente acessar o painel.
                              </Typography>
                            </Box>
                          )}
                        </Stack>
                      </Card>
                    </Box>
                  </Stack>
                )}
              </Box>
            </Box>
          </Box>

          <Dialog
            open={openClient}
            onClose={() => setOpenClient(false)}
            fullWidth
            maxWidth="sm"
          >
            <DialogTitle sx={{ fontWeight: 950 }}>
              {clientForm.id ? "Editar cliente" : "Novo cliente"}
            </DialogTitle>

            <DialogContent>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <TextField
                  label="Nome"
                  value={clientForm.name}
                  onChange={(e) =>
                    setClientForm((p) => ({ ...p, name: e.target.value }))
                  }
                  fullWidth
                />

                <TextField
                  label="E-mail"
                  value={clientForm.email}
                  onChange={(e) =>
                    setClientForm((p) => ({ ...p, email: e.target.value }))
                  }
                  fullWidth
                />

                <TextField
                  label="Telefone"
                  value={clientForm.phone}
                  onChange={(e) =>
                    setClientForm((p) => ({ ...p, phone: e.target.value }))
                  }
                  fullWidth
                />
              </Stack>
            </DialogContent>

            <DialogActions sx={{ p: 3 }}>
              <Button startIcon={<Close />} onClick={() => setOpenClient(false)}>
                Cancelar
              </Button>
              <Button variant="contained" onClick={saveClient}>
                Salvar
              </Button>
            </DialogActions>
          </Dialog>

          <Dialog
            open={openNumber}
            onClose={() => setOpenNumber(false)}
            fullWidth
            maxWidth="sm"
          >
            <DialogTitle sx={{ fontWeight: 950 }}>
              Vincular número Infobip
            </DialogTitle>

            <DialogContent>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <TextField
                  label="Número"
                  placeholder="5562999999999"
                  value={numberForm.number}
                  onChange={(e) =>
                    setNumberForm((p) => ({ ...p, number: e.target.value }))
                  }
                  fullWidth
                />

                <TextField
                  label="Identificação"
                  placeholder="Ex: número principal"
                  value={numberForm.label}
                  onChange={(e) =>
                    setNumberForm((p) => ({ ...p, label: e.target.value }))
                  }
                  fullWidth
                />
              </Stack>
            </DialogContent>

            <DialogActions sx={{ p: 3 }}>
              <Button onClick={() => setOpenNumber(false)}>Cancelar</Button>
              <Button variant="contained" onClick={saveNumber}>
                Vincular
              </Button>
            </DialogActions>
          </Dialog>

          <Dialog
            open={openUser}
            onClose={() => setOpenUser(false)}
            fullWidth
            maxWidth="sm"
          >
            <DialogTitle sx={{ fontWeight: 950 }}>
              {userForm.id ? "Editar acesso do cliente" : "Criar acesso do cliente"}
            </DialogTitle>

            <DialogContent>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <TextField
                  label="Nome"
                  value={userForm.name}
                  onChange={(e) =>
                    setUserForm((p) => ({ ...p, name: e.target.value }))
                  }
                  fullWidth
                />

                <TextField
                  label="E-mail de login"
                  value={userForm.email}
                  onChange={(e) =>
                    setUserForm((p) => ({ ...p, email: e.target.value }))
                  }
                  fullWidth
                />

                <TextField
                  label="Senha inicial"
                  placeholder={userForm.id ? "Deixe em branco para manter a atual" : ""}
                  value={userForm.password}
                  onChange={(e) =>
                    setUserForm((p) => ({ ...p, password: e.target.value }))
                  }
                  fullWidth
                />
              </Stack>
            </DialogContent>

            <DialogActions sx={{ p: 3 }}>
              <Button onClick={() => setOpenUser(false)}>Cancelar</Button>
              <Button variant="contained" onClick={saveUser}>
                {userForm.id ? "Salvar acesso" : "Criar acesso"}
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      </AppShell>
    </ThemeProvider>
  );
}
