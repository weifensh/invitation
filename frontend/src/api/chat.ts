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

export async function sendChatMessage(historyId: number, sender: string, content: string, model_id?: number, provider_id?: number, temperature?: number, max_tokens?: number, stream?: boolean) {
  const message: any = { sender, content };
  if (typeof model_id === 'number') message.model_id = model_id;
  if (typeof provider_id === 'number') message.provider_id = provider_id;
  const data: any = { message };
  if (typeof temperature === 'number') data.temperature = temperature;
  if (typeof max_tokens === 'number') data.max_tokens = max_tokens;
  if (typeof stream === 'boolean') data.stream = stream;
  console.log('[sendChatMessage] POST /chat/histories/' + historyId + '/messages', {
    historyId, sender, content, model_id, provider_id, temperature, max_tokens, stream, data
  });
  const res = await api.post(`/chat/histories/${historyId}/messages`, data);
  return res.data;
} 