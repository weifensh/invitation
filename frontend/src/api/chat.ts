import api from "./index";

export async function getChatHistories() {
  const res = await api.get("/chat/histories");
  return res.data;
}

export async function createChatHistory(title: string) {
  const res = await api.post("/chat/histories", { title });
  return res.data;
}

export async function updateChatHistory(id: number, title: string) {
  const res = await api.put(`/chat/histories/${id}`, { title });
  return res.data;
}

export async function deleteChatHistory(id: number) {
  const res = await api.delete(`/chat/histories/${id}`);
  return res.data;
}

export async function getChatMessages(historyId: number) {
  const res = await api.get(`/chat/histories/${historyId}/messages`);
  return res.data;
}

export async function sendChatMessage(historyId: number, sender: string, content: string, model_id?: number, provider_id?: number) {
  const data: any = { sender, content };
  if (typeof model_id === 'number') data.model_id = model_id;
  if (typeof provider_id === 'number') data.provider_id = provider_id;
  const res = await api.post(`/chat/histories/${historyId}/messages`, data);
  return res.data;
} 