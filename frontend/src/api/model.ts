import api from "./index";

export async function getModelProviders() {
  const res = await api.get("/model_providers");
  return res.data;
}

export async function createModelProvider(data: { name: string; api_host: string; api_key: string }) {
  const res = await api.post("/model_providers", data);
  return res.data;
}

export async function updateModelProvider(id: number, data: { name: string; api_host: string; api_key: string }) {
  const res = await api.put(`/model_providers/${id}`, data);
  return res.data;
}

export async function deleteModelProvider(id: number) {
  const res = await api.delete(`/model_providers/${id}`);
  return res.data;
}

export async function getModels(providerId: number) {
  const res = await api.get(`/model_providers/models?provider_id=${providerId}`);
  return res.data;
}

export async function createModel(data: { provider_id: number; name: string }) {
  const res = await api.post("/model_providers/models", data);
  return res.data;
}

export async function deleteModel(id: number) {
  const res = await api.delete(`/model_providers/models/${id}`);
  return res.data;
} 