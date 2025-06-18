import api from "./index";

export async function getChatSettings() {
  const res = await api.get("/settings");
  return res.data;
}

export async function updateChatSettings(data: { temperature: number; max_tokens: number; stream: boolean }) {
  const res = await api.put("/settings", data);
  return res.data;
} 