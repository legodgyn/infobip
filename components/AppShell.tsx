"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  Stack,
  Typography,
} from "@mui/material";
import {
  BarChart,
  Dashboard,
  Forum,
  Groups,
  Logout,
  Settings,
} from "@mui/icons-material";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const drawerWidth = 280;

const menu = [
  { label: "Dashboard", href: "/", icon: <Dashboard />, adminOnly: false },
  { label: "Relatórios", href: "/reports", icon: <BarChart />, adminOnly: false },
  { label: "Conversas", href: "/conversations", icon: <Forum />, adminOnly: false },
  { label: "Clientes", href: "/clients", icon: <Groups />, adminOnly: true },
  { label: "Configurações", href: "/settings", icon: <Settings />, adminOnly: false },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    async function loadUser() {
      const res = await fetch("/api/auth/me");
      if (!res.ok) return;

      const data = await res.json();
      setUser(data?.user || data);
    }

    loadUser();
  }, []);

  const isAdmin = user?.role === "admin";

  const visibleMenu = useMemo(() => {
    return menu.filter((item) => !item.adminOnly || isAdmin);
  }, [isAdmin]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <Box
      sx={{
        display: "flex",
        width: "100vw",
        minHeight: "100vh",
        bgcolor: "#f8fafc",
        overflowX: "hidden",
      }}
    >
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            border: "none",
            bgcolor: "#07111f",
            color: "#fff",
            p: 2.5,
            overflowX: "hidden",
          },
        }}
      >
        <Stack sx={{ height: "100%" }}>
          <Box>
            <Typography sx={{ fontSize: 19, fontWeight: 950 }}>
              Infobip Monitor
            </Typography>

            <Typography sx={{ mt: 0.5, color: "#94a3b8", fontSize: 14 }}>
              Performance Center Pro
            </Typography>

            <Chip
              label={isAdmin ? "Admin ativo" : "Cliente ativo"}
              size="small"
              sx={{
                mt: 2,
                bgcolor: "rgba(34,197,94,.15)",
                color: "#86efac",
                fontWeight: 900,
              }}
            />
          </Box>

          <Stack spacing={1.2} sx={{ mt: 5 }}>
            {visibleMenu.map((item) => {
              const active = pathname === item.href;

              return (
                <Link key={item.href} href={item.href} style={{ textDecoration: "none" }}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      px: 2,
                      py: 1.45,
                      borderRadius: 4,
                      color: active ? "#fff" : "#cbd5e1",
                      bgcolor: active ? "#2563eb" : "transparent",
                      fontWeight: 900,
                      transition: ".2s",
                      boxShadow: active
                        ? "0 14px 35px rgba(37,99,235,.35)"
                        : "none",
                      "&:hover": {
                        bgcolor: active ? "#2563eb" : "rgba(255,255,255,.06)",
                      },
                    }}
                  >
                    {item.icon}
                    {item.label}
                  </Box>
                </Link>
              );
            })}
          </Stack>

          <Box sx={{ mt: "auto" }}>
            <Divider sx={{ borderColor: "rgba(255,255,255,.08)", mb: 3 }} />

            <Box
              sx={{
                p: 1.5,
                borderRadius: 4,
                bgcolor: "rgba(255,255,255,.06)",
                display: "flex",
                alignItems: "center",
                gap: 1.5,
              }}
            >
              <Avatar sx={{ bgcolor: "#2563eb" }}>
                {String(user?.name || user?.email || "A").slice(0, 1).toUpperCase()}
              </Avatar>

              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 950 }} noWrap>
                  {user?.name || (isAdmin ? "Admin" : "Cliente")}
                </Typography>

                <Typography sx={{ fontSize: 13, color: "#94a3b8" }} noWrap>
                  {isAdmin ? "Conta principal" : "Portal do cliente"}
                </Typography>
              </Box>
            </Box>

            <Button
              fullWidth
              startIcon={<Logout />}
              onClick={logout}
              sx={{
                mt: 1.5,
                py: 1.2,
                color: "#fff",
                bgcolor: "rgba(255,255,255,.08)",
                "&:hover": {
                  bgcolor: "rgba(255,255,255,.14)",
                },
              }}
            >
              Sair
            </Button>
          </Box>
        </Stack>
      </Drawer>

      <Box
        component="main"
        sx={{
          flex: 1,
          minWidth: 0,
          width: `calc(100vw - ${drawerWidth}px)`,
          maxWidth: `calc(100vw - ${drawerWidth}px)`,
          minHeight: "100vh",
          overflowX: "hidden",
        }}
      >
        <Box sx={{ width: "100%", maxWidth: "100%", minHeight: "100vh" }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
