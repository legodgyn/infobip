"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CssBaseline,
  Stack,
  TextField,
  ThemeProvider,
  Typography,
} from "@mui/material";
import { theme } from "@/theme";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

 async function login() {
  setLoading(true);
  setError("");

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const text = await res.text();

    let data: any = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }

    setLoading(false);

    if (!res.ok) {
      setError(data.error || `Erro ao entrar. Status: ${res.status}`);
      return;
    }

    router.push("/");
    router.refresh();
  } catch (err: any) {
    setLoading(false);
    setError(err.message || "Erro inesperado ao fazer login");
  }
}

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      <Box
        sx={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          p: 3,
          background:
            "radial-gradient(circle at 20% 0%, rgba(37,99,235,.20), transparent 32%), radial-gradient(circle at 80% 0%, rgba(124,58,237,.20), transparent 30%), #f8fafc",
        }}
      >
        <Card sx={{ width: "100%", maxWidth: 440, p: 4 }}>
                    <Typography sx={{ fontSize: 30, fontWeight: 950 }}>
            Infobip Monitor
          </Typography>

          <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
            Acesse sua central de monitoramento
          </Typography>

          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}

            <TextField
              label="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
              fullWidth
            />

            <TextField
              label="Senha"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              fullWidth
            />

            <Button
              variant="contained"
              size="large"
              onClick={login}
              disabled={loading}
              sx={{
                py: 1.4,
                background: "linear-gradient(135deg,#2563eb,#6d28d9)",
              }}
            >
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </Stack>
        </Card>
      </Box>
    </ThemeProvider>
  );
}
