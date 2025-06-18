import React, { useState, useEffect } from "react";
import { Select, Button, Input, Modal, List, Dropdown, Menu, message as antdMessage, Form } from "antd";
import { SettingOutlined, ToolOutlined, SendOutlined, PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import { getChatHistories, getChatMessages, sendChatMessage } from "../api/chat";
import {
  getModelProviders,
  createModelProvider,
  updateModelProvider,
  deleteModelProvider,
  getModels,
  createModel,
  deleteModel,
} from "../api/model";
import { getChatSettings, updateChatSettings } from "../api/settings";
import { marked } from "marked";
import axios from "axios";

interface Message {
  id: number;
  sender: string;
  content: string;
}

interface Provider {
  id: number;
  name: string;
  api_host: string;
  api_key: string;
}

interface Model {
  id: number;
  name: string;
  provider_id: number;
}

interface MainAreaProps {
  selectedHistory: number | null;
  setSelectedHistory: (id: number | null) => void;
}

const MainArea: React.FC<MainAreaProps> = ({ selectedHistory, setSelectedHistory }) => {
  const [selectedModel, setSelectedModel] = useState<number | undefined>(undefined);
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [histories, setHistories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [providerForm] = Form.useForm();
  const [modelName, setModelName] = useState("");
  const [selectedProviderId, setSelectedProviderId] = useState<number | undefined>(undefined);
  const [llmConfig, setLlmConfig] = useState({ temperature: 0.7, max_tokens: 2048, stream: true });
  const [llmConfigLoading, setLlmConfigLoading] = useState(false);

  // 加载对话历史
  useEffect(() => {
    getChatHistories().then(setHistories);
  }, []);

  // 选中对话后加载消息
  useEffect(() => {
    if (selectedHistory) {
      setLoading(true);
      getChatMessages(selectedHistory)
        .then(setMessages)
        .catch(() => antdMessage.error("加载消息失败"))
        .finally(() => setLoading(false));
    } else {
      setMessages([]);
    }
  }, [selectedHistory]);

  // 加载模型提供商
  const fetchProviders = async () => {
    try {
      const data = await getModelProviders();
      setProviders(data);
      if (data.length > 0 && selectedProviderId === undefined) {
        setSelectedProviderId(data[0].id);
      }
    } catch {
      antdMessage.error("获取模型提供商失败");
    }
  };
  useEffect(() => {
    fetchProviders();
  }, []);

  // 加载模型
  const fetchModels = async (providerId: number) => {
    try {
      const data = await getModels(providerId);
      setModels(data);
      if (data.length > 0) {
        setSelectedModel(data[0].id);
      } else {
        setSelectedModel(undefined);
      }
    } catch {
      antdMessage.error("获取模型失败");
    }
  };
  useEffect(() => {
    if (selectedProviderId) {
      fetchModels(selectedProviderId);
    } else {
      setModels([]);
      setSelectedModel(undefined);
    }
  }, [selectedProviderId]);

  // 加载 LLM 配置
  useEffect(() => {
    getChatSettings().then(setLlmConfig);
  }, []);

  useEffect(() => {
    if (showTools) {
      providerForm.setFieldsValue(llmConfig);
    }
  }, [showTools, llmConfig, providerForm]);

  const handleSend = async () => {
    if (!input.trim() || !selectedHistory) return;
    if (!selectedProviderId || !selectedModel) {
      antdMessage.warning("请先选择模型供应商和模型");
      return;
    }
    const currentHistory = selectedHistory;
    const currentInput = input;
    setInput("");

    if (llmConfig.stream) {
      // 立即本地插入用户消息
      const userMsg = { id: Date.now(), sender: "user", content: currentInput };
      setMessages(msgs => [...msgs, userMsg]);
      await fetchStreamLLMReply(currentInput, currentHistory);
    } else {
      try {
        await sendMessage(currentHistory, currentInput, llmConfig, selectedModel!, selectedProviderId!);
        setLoading(true);
        getChatMessages(currentHistory)
          .then(setMessages)
          .catch(() => antdMessage.error("加载消息失败"))
          .finally(() => setLoading(false));
      } catch {
        antdMessage.error("发送失败");
      }
    }
  };

  const fetchStreamLLMReply = async (input: string, historyId: number) => {
    // 插入AI占位符
    const aiMsgId = Date.now() + 1;
    setMessages(msgs => [...msgs, { id: aiMsgId, sender: "ai", content: "" }]);
    try {
      const es = getStreamEventSource(historyId, input, llmConfig, selectedModel!, selectedProviderId!);
      let aiContent = "";
      es.onmessage = (event) => {
        console.log('SSE onmessage:', event.data);
        if (event.data === "[DONE]") {
          es.close();
          console.log('SSE closed on [DONE]');
          return;
        }
        try {
          const payload = JSON.parse(event.data);
          const delta = payload.choices?.[0]?.delta?.content ?? payload.choices?.[0]?.content ?? "";
          aiContent += delta;
          console.log('AI流式累计内容:', aiContent);
          // 始终更新最后一条AI消息内容，确保流式渲染
          setMessages(msgs => {
            const lastAiIdx = [...msgs].reverse().findIndex(m => m.sender === "ai");
            if (lastAiIdx === -1) {
              console.log('未找到AI消息占位符');
              return msgs;
            }
            const idx = msgs.length - 1 - lastAiIdx;
            const newMsgs = msgs.map((m, i) => i === idx ? { ...m, content: aiContent } : m);
            console.log('setMessages更新:', newMsgs);
            return newMsgs;
          });
        } catch (e) {
          console.error("Error parsing SSE message:", e, event.data);
        }
      };
      es.onerror = async (error) => {
        console.error('SSE onerror:', error);
        es.close();
        setMessages(msgs => msgs.filter(m => m.id !== aiMsgId)); // 移除AI占位符
        antdMessage.warning('流式调用失败，尝试使用非流式调用');
        try {
          await sendMessage(historyId, input, llmConfig, selectedModel!, selectedProviderId!);
          setLoading(true);
          getChatMessages(historyId)
            .then(setMessages)
            .catch(() => antdMessage.error("加载消息失败"))
            .finally(() => setLoading(false));
        } catch (error) {
          antdMessage.error('LLM调用失败');
        }
      };
    } catch (e) {
      setMessages(msgs => msgs.filter(m => m.id !== aiMsgId));
      antdMessage.error(`LLM流式调用失败: ${e}`);
    }
  };

  // 1. 普通消息发送
  const sendMessage = async (
    historyId: number,
    message: string,
    llmConfig: { temperature: number; max_tokens: number; stream: boolean },
    selectedModel: number,
    selectedProviderId: number
  ) => {
    await sendChatMessage(historyId, "user", message, selectedModel, selectedProviderId);
  };

  // 2. 流式消息发送
  const getStreamEventSource = (
    historyId: number,
    message: string,
    llmConfig: { temperature: number; max_tokens: number; stream: boolean },
    selectedModel: number,
    selectedProviderId: number
  ): EventSource => {
    const params = new URLSearchParams({
      stream: "true",
      sender: "user",
      content: message,
      model_id: String(selectedModel),
      provider_id: String(selectedProviderId),
      temperature: String(llmConfig.temperature),
      max_tokens: String(llmConfig.max_tokens)
    });
    const token = localStorage.getItem("token");
    params.append('token', token || '');
    const url = `http://localhost:8000/chat/histories/${historyId}/messages?${params.toString()}`;
    return new EventSource(url);
  };

  // Provider 操作
  const handleEditProvider = (provider: Provider) => {
    setEditingProvider(provider);
    providerForm.setFieldsValue(provider);
  };
  const handleDeleteProvider = async (id: number) => {
    try {
      await deleteModelProvider(id);
      antdMessage.success("删除成功");
      fetchProviders();
    } catch {
      antdMessage.error("删除失败");
    }
  };
  const handleProviderOk = async () => {
    try {
      const values = await providerForm.validateFields();
      if (editingProvider) {
        await updateModelProvider(editingProvider.id, values);
        antdMessage.success("修改成功");
      } else {
        await createModelProvider(values);
        antdMessage.success("新增成功");
      }
      setEditingProvider(null);
      providerForm.resetFields();
      fetchProviders();
    } catch {}
  };
  const handleProviderCancel = () => {
    setEditingProvider(null);
    providerForm.resetFields();
  };

  // Model 操作
  const handleAddModel = async () => {
    if (!selectedProviderId || !modelName.trim()) return;
    try {
      await createModel({ provider_id: selectedProviderId, name: modelName });
      setModelName("");
      fetchModels(selectedProviderId);
      antdMessage.success("新增模型成功");
    } catch {
      antdMessage.error("新增模型失败");
    }
  };
  const handleDeleteModel = async (id: number) => {
    try {
      await deleteModel(id);
      fetchModels(selectedProviderId!);
      antdMessage.success("删除模型成功");
    } catch {
      antdMessage.error("删除模型失败");
    }
  };

  const handleLlmConfigOk = async (values: any) => {
    setLlmConfigLoading(true);
    try {
      await updateChatSettings(values);
      setLlmConfig(values);
      setShowTools(false);
      antdMessage.success("配置已保存");
    } catch {
      antdMessage.error("保存失败");
    }
    setLlmConfigLoading(false);
  };

  const toolsMenu = (
    <Menu>
      <Menu.Item key="llm-config" onClick={() => setShowTools(true)}>
        参数
      </Menu.Item>
    </Menu>
  );

  const renderMarkdown = (content: string) => {
    if (typeof marked.parse === 'function') {
      return marked.parse(content) as string;
    }
    return marked(content) as string;
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", padding: 16, borderBottom: "1px solid #eee" }}>
        <Select
          value={selectedProviderId}
          onChange={id => setSelectedProviderId(Number(id))}
          style={{ width: 180, marginRight: 8 }}
          placeholder="选择模型提供商"
        >
          {providers.map(p => (
            <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>
          ))}
        </Select>
        <Select
          value={selectedModel}
          onChange={id => setSelectedModel(Number(id))}
          style={{ width: 220, marginRight: 8 }}
          placeholder="选择模型"
        >
          {models.map(m => (
            <Select.Option key={m.id} value={m.id}>{m.name}</Select.Option>
          ))}
        </Select>
        <Button icon={<SettingOutlined />} style={{ marginRight: 8 }} onClick={() => setShowProviderModal(true)} />
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
        <List
          dataSource={messages}
          loading={loading}
          renderItem={msg => (
            <List.Item style={{ justifyContent: msg.sender === "user" ? "flex-end" : "flex-start" }}>
              <div
                style={{
                  background: msg.sender === "user" ? "#e6f7ff" : "#fff",
                  border: "1px solid #eee",
                  borderRadius: 8,
                  padding: 12,
                  maxWidth: 480
                }}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
              />
            </List.Item>
          )}
        />
      </div>
      <div style={{ padding: 16, borderTop: "1px solid #eee", display: "flex", alignItems: "center" }}>
        <Dropdown overlay={toolsMenu} trigger={["click"]}>
          <Button icon={<ToolOutlined />} style={{ marginRight: 8 }} />
        </Dropdown>
        <Input.TextArea
          value={input}
          onChange={e => setInput(e.target.value)}
          autoSize={{ minRows: 1, maxRows: 4 }}
          style={{ flex: 1, marginRight: 8 }}
          placeholder="请输入消息..."
          onPressEnter={e => { if (!e.shiftKey) { e.preventDefault(); handleSend(); } }}
          disabled={!selectedHistory}
        />
        <Button type="primary" icon={<SendOutlined />} onClick={handleSend} disabled={!selectedHistory}>
          发送
        </Button>
      </div>
      <Modal
        title="配置模型提供商"
        open={showProviderModal}
        onCancel={() => { setShowProviderModal(false); setEditingProvider(null); providerForm.resetFields(); }}
        footer={null}
        width={700}
      >
        <div style={{ display: "flex", gap: 32 }}>
          <div style={{ flex: 1 }}>
            <Button type="primary" icon={<PlusOutlined />} block style={{ marginBottom: 12 }} onClick={() => { setEditingProvider(null); providerForm.resetFields(); }}>
              新增模型提供商
            </Button>
            <List
              dataSource={providers}
              renderItem={item => (
                <List.Item
                  actions={[
                    <Button size="small" onClick={() => handleEditProvider(item)}>编辑</Button>,
                    <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteProvider(item.id)} />
                  ]}
                >
                  <div>
                    <b>{item.name}</b>
                    <div style={{ fontSize: 12, color: "#888" }}>{item.api_host}</div>
                  </div>
                </List.Item>
              )}
            />
          </div>
          <div style={{ flex: 1, borderLeft: "1px solid #eee", paddingLeft: 24 }}>
            <Form form={providerForm} layout="vertical">
              <Form.Item name="name" label="名称" rules={[{ required: true, message: "请输入名称" }]}>
                <Input />
              </Form.Item>
              <Form.Item name="api_host" label="API Host" rules={[{ required: true, message: "请输入API Host" }]}>
                <Input />
              </Form.Item>
              <Form.Item name="api_key" label="API Key" rules={[{ required: true, message: "请输入API Key" }]}>
                <Input.Password />
              </Form.Item>
              <Button type="primary" onClick={handleProviderOk} style={{ marginRight: 8 }}>保存</Button>
              <Button onClick={handleProviderCancel}>取消</Button>
            </Form>
            {editingProvider && (
              <div style={{ marginTop: 32 }}>
                <h4>模型管理</h4>
                <Input
                  placeholder="新模型名称"
                  value={modelName}
                  onChange={e => setModelName(e.target.value)}
                  style={{ width: 180, marginRight: 8 }}
                />
                <Button type="primary" size="small" onClick={handleAddModel}>新增模型</Button>
                <List
                  dataSource={models}
                  renderItem={m => (
                    <List.Item
                      actions={[
                        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteModel(m.id)} />
                      ]}
                    >
                      {m.name}
                    </List.Item>
                  )}
                />
              </div>
            )}
          </div>
        </div>
      </Modal>
      <Modal
        title="参数"
        open={showTools}
        onCancel={() => setShowTools(false)}
        footer={null}
      >
        <Form
          form={providerForm}
          layout="inline"
          initialValues={llmConfig}
          onFinish={handleLlmConfigOk}
          style={{ maxWidth: 600, display: 'flex', flexWrap: 'wrap', gap: 16 }}
        >
          <Form.Item name="temperature" label="Temperature" rules={[{ required: true }]}
            style={{ minWidth: 180 }}>
            <Input type="number" step={0.01} min={0} max={2} placeholder="0.7" />
          </Form.Item>
          <Form.Item name="max_tokens" label="Max Tokens" rules={[{ required: true }]}
            style={{ minWidth: 180 }}>
            <Input type="number" min={1} max={8192} placeholder="2048" />
          </Form.Item>
          <Form.Item name="stream" label="Stream" valuePropName="checked"
            style={{ minWidth: 120, display: 'flex', alignItems: 'center' }}>
            <Input type="checkbox" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={llmConfigLoading}>保存</Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MainArea; 