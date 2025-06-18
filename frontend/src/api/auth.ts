import api from "./index";

export async function register(data: { username: string; email: string; password: string }) {
  const res = await api.post("/auth/register", data);
  return res.data;
}

export async function login(data: { username: string; password: string }) {
  const params = new URLSearchParams();
  params.append("username", data.username);
  params.append("password", data.password);
  const res = await api.post("/auth/login", params, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return res.data;
}

export async function getMe() {
  const res = await api.get("/auth/me");
  return res.data;
} 