import React, { useState, useEffect, useRef } from "react";
import { Select, Button, Input, Modal, List, Dropdown, Menu, message as antdMessage, Form } from "antd";
import type { InputRef } from 'antd';
import { SettingOutlined, ToolOutlined, SendOutlined, PlusOutlined, DeleteOutlined, StopOutlined, UserOutlined, LogoutOutlined } from "@ant-design/icons";
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
import { useNavigate } from "react-router-dom";

interface Message {
  id: number;
  sender: string;
  content: string;
  reasoning_content?: string;
  reasoning_done?: boolean;
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

const MainArea = ({ selectedHistory, setSelectedHistory }: MainAreaProps) => {
  const [selectedModel, setSelectedModel] = useState<number | undefined>(() => {
    const saved = localStorage.getItem('selectedModel');
    const val = saved !== null && !isNaN(Number(saved)) ? Number(saved) : undefined;
    console.log('[INIT] selectedModel from localStorage:', val);
    return val;
  });
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [providerForm] = Form.useForm();
  const nameInputRef = useRef<InputRef | null>(null);
  const [modelName, setModelName] = useState("");
  const [selectedProviderId, setSelectedProviderId] = useState<number | undefined>(() => {
    const saved = localStorage.getItem('selectedProviderId');
    const val = saved !== null && !isNaN(Number(saved)) ? Number(saved) : undefined;
    console.log('[INIT] selectedProviderId from localStorage:', val);
    return val;
  });
  const DEFAULT_LLM_CONFIG = { temperature: 0.7, max_tokens: 2048, stream: true };
  const [llmConfig, setLlmConfig] = useState(() => {
    console.log('[DEBUG] useState init llmConfig', DEFAULT_LLM_CONFIG);
    return DEFAULT_LLM_CONFIG;
  });
  const [llmConfigLoading, setLlmConfigLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const inputRef = useRef<any>(null);
  const [userInfo, setUserInfo] = useState<{ username: string } | null>(null);
  const [userMenuVisible, setUserMenuVisible] = useState(false);
  const navigate = useNavigate();
  const [isSending, setIsSending] = useState(false);
  const token = localStorage.getItem('token');

  // 加载对话历史
  useEffect(() => {
    getChatHistories().then(hs => {
      if (hs.length > 0) {
        setSelectedHistory(hs[0].id);
      }
    });
  }, [setSelectedHistory]);

  // 选中对话后加载消息
  useEffect(() => {
    // 切换历史前先停止流式输出
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsStreaming(false);
    }
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

  // 聊天主区域自动滚动到底部
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    // eslint-disable-next-line
    return undefined;
  }, [messages]);

  // 聊天历史切换后自动聚焦输入框
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [selectedHistory]);

  // 只在providers为空时fetch
  useEffect(() => {
    if (providers.length === 0) {
      fetchProviders();
    }
  }, []);

  // providers变化时，只有当前选中项不在列表中时才自动选中localStorage或第一个
  useEffect(() => {
    if (providers.length > 0) {
      // 只在 state 为 undefined 时才尝试 localStorage
      if (selectedProviderId === undefined) {
        const savedProviderId = localStorage.getItem('selectedProviderId');
        const savedProviderIdNum = savedProviderId !== null && !isNaN(Number(savedProviderId)) ? Number(savedProviderId) : undefined;
        if (savedProviderIdNum && providers.some((p: any) => p.id === savedProviderIdNum)) {
          setSelectedProviderId(savedProviderIdNum);
          return;
        }
        setSelectedProviderId(providers[0].id);
        localStorage.setItem('selectedProviderId', String(providers[0].id));
      } else if (!providers.some((p: any) => p.id === selectedProviderId)) {
        // 只有当前选择项不在列表中时才自动切换
        setSelectedProviderId(providers[0].id);
        localStorage.setItem('selectedProviderId', String(providers[0].id));
      }
    }
    // eslint-disable-next-line
  }, [providers]);

  // 加载模型
  const fetchModels = async (providerId: number) => {
    try {
      const data = await getModels(providerId);
      setModels(data);
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

  // models变化时，只有当前选中项不在列表中时才自动选中localStorage或第一个
  useEffect(() => {
    if (models.length > 0) {
      // 只在 state 为 undefined 时才尝试 localStorage
      if (selectedModel === undefined) {
        const savedModelId = localStorage.getItem('selectedModel');
        const savedModelIdNum = savedModelId !== null && !isNaN(Number(savedModelId)) ? Number(savedModelId) : undefined;
        if (savedModelIdNum && models.some((m: any) => m.id === savedModelIdNum)) {
          setSelectedModel(savedModelIdNum);
          return;
        }
        setSelectedModel(models[0].id);
        localStorage.setItem('selectedModel', String(models[0].id));
      } else if (!models.some((m: any) => m.id === selectedModel)) {
        // 只有当前选择项不在列表中时才自动切换
        setSelectedModel(models[0].id);
        localStorage.setItem('selectedModel', String(models[0].id));
      }
    }
    // eslint-disable-next-line
  }, [models]);

  // 加载 LLM 配置
  useEffect(() => {
    getChatSettings().then(cfg => {
      const isFirst = !localStorage.getItem('llmConfigInited');
      if (isFirst) {
        setLlmConfig(DEFAULT_LLM_CONFIG);
        localStorage.setItem('llmConfigInited', '1');
        updateChatSettings(DEFAULT_LLM_CONFIG); // 强制保存到后端
        console.log('[DEBUG] 强制用DEFAULT_LLM_CONFIG并保存', DEFAULT_LLM_CONFIG);
      } else {
        setLlmConfig({
          temperature: typeof cfg?.temperature === 'number' ? cfg.temperature : 0.7,
          max_tokens: typeof cfg?.max_tokens === 'number' ? cfg.max_tokens : 2048,
          stream: typeof cfg?.stream === 'boolean' ? cfg.stream : true
        });
        console.log('[DEBUG] setLlmConfig after getChatSettings', {
          temperature: typeof cfg?.temperature === 'number' ? cfg.temperature : 0.7,
          max_tokens: typeof cfg?.max_tokens === 'number' ? cfg.max_tokens : 2048,
          stream: typeof cfg?.stream === 'boolean' ? cfg.stream : true
        });
      }
    }).catch(() => {
      setLlmConfig(DEFAULT_LLM_CONFIG);
      console.log('[DEBUG] setLlmConfig catch, use DEFAULT_LLM_CONFIG', DEFAULT_LLM_CONFIG);
    });
  }, []);

  useEffect(() => {
    if (showTools) {
      providerForm.setFieldsValue(llmConfig);
      console.log('[DEBUG] showTools open, setFieldsValue', llmConfig);
    }
  }, [showTools, llmConfig, providerForm]);

  // 获取当前用户信息（假设token中有username，或可从后端获取）
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        // 假设JWT结构，payload为第二段
        const payload = JSON.parse(atob(token.split(".")[1]));
        setUserInfo({ username: payload.sub || payload.username || "User" });
      } catch {
        setUserInfo({ username: "User" });
      }
    }
  }, []);

  // 监听token变化，切换用户时清除模型选择缓存并刷新页面
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "token") {
        localStorage.removeItem("selectedProviderId");
        localStorage.removeItem("selectedModel");
        window.location.reload();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // 用户登录后（token变化）主动清除本地模型选择缓存并刷新页面
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    let username = "";
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      username = payload.sub || payload.username || "User";
    } catch {}
    if (userInfo?.username && userInfo.username !== username) {
      // 只有切换用户时才清除
      localStorage.removeItem("selectedProviderId");
      localStorage.removeItem("selectedModel");
      setSelectedProviderId(undefined);
      setSelectedModel(undefined);
    }
  }, [userInfo?.username, localStorage.getItem("token")]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const handleSend = async () => {
    if (isSending) return;
    if (!input.trim() || !selectedHistory) return;
    if (!selectedProviderId || !selectedModel) {
      antdMessage.warning("请先选择模型供应商和模型");
      return;
    }
    setIsSending(true);
    const currentHistory = selectedHistory;
    const currentInput = input;
    setInput("");

    // 立即本地插入用户消息
    const userMsg = { id: Date.now(), sender: "user", content: currentInput };
    setMessages(msgs => [...msgs, userMsg]);
    try {
      if (llmConfig.stream) {
        await fetchStreamLLMReply(currentInput, currentHistory);
      } else {
        // 先插入AI占位符
        const aiMsgId = Date.now() + 1;
        setMessages(msgs => [...msgs, { id: aiMsgId, sender: "ai", content: "回复准备中，请稍候...", reasoning_content: "", reasoning_done: false }]);
        try {
          await sendMessage(currentHistory, currentInput, llmConfig, selectedModel!, selectedProviderId!);
          setLoading(true);
          getChatMessages(currentHistory)
            .then(serverMsgs => {
              // 找到AI消息，替换最后一条AI消息内容
              setMessages(msgs => {
                const lastAiIdx = [...msgs].reverse().findIndex(m => m.sender === "ai");
                if (lastAiIdx === -1) return msgs;
                const idx = msgs.length - 1 - lastAiIdx;
                // 取最新AI消息内容
                const serverAiMsg = [...serverMsgs].reverse().find(m => m.sender === "ai");
                if (!serverAiMsg) return msgs;
                return msgs.map((m, i) => i === idx ? { ...m, ...serverAiMsg } : m);
              });
            })
            .catch(() => antdMessage.error("加载消息失败"))
            .finally(() => setLoading(false));
        } catch {
          setMessages(msgs => msgs.filter(m => m.id !== aiMsgId));
          antdMessage.error("发送失败");
        }
      }
    } finally {
      setIsSending(false);
    }
  };

  const fetchStreamLLMReply = async (input: string, historyId: number) => {
    // 插入AI占位符
    const aiMsgId = Date.now() + 1;
    setMessages(msgs => [...msgs, { id: aiMsgId, sender: "ai", content: "", reasoning_content: "", reasoning_done: false }]);
    try {
      const es = getStreamEventSource(historyId, input, llmConfig, selectedModel!, selectedProviderId!);
      eventSourceRef.current = es;
      setIsStreaming(true);
      let aiContent = "";
      let aiReasoning = "";
      let reasoningDone = false;
      es.onmessage = (event) => {
        console.log('SSE onmessage:', event.data);
        if (event.data === "[DONE]") {
          es.close();
          eventSourceRef.current = null;
          setIsStreaming(false);
          reasoningDone = true;
          // 标记reasoning_content已完成
          setMessages(msgs => {
            const lastAiIdx = [...msgs].reverse().findIndex(m => m.sender === "ai");
            if (lastAiIdx === -1) return msgs;
            const idx = msgs.length - 1 - lastAiIdx;
            const newMsgs = msgs.map((m, i) => i === idx ? { ...m, reasoning_done: true } : m);
            return newMsgs;
          });
          return;
        }
        try {
          const payload = JSON.parse(event.data);
          // 处理reasoning_content
          const deltaReasoning = payload.choices?.[0]?.delta?.reasoning_content ?? payload.choices?.[0]?.reasoning_content ?? "";
          if (deltaReasoning) {
            aiReasoning += deltaReasoning;
          }
          // 处理content
          const deltaContent = payload.choices?.[0]?.delta?.content ?? payload.choices?.[0]?.content ?? "";
          if (deltaContent) {
            aiContent += deltaContent;
          }
          // 更新消息
          setMessages(msgs => {
            const lastAiIdx = [...msgs].reverse().findIndex(m => m.sender === "ai");
            if (lastAiIdx === -1) return msgs;
            const idx = msgs.length - 1 - lastAiIdx;
            const newMsgs = msgs.map((m, i) => {
              if (i !== idx) return m;
              return {
                ...m,
                reasoning_content: aiReasoning,
                content: aiContent,
                reasoning_done: reasoningDone || !!payload.choices?.[0]?.delta?.content // 一旦content开始输出，reasoning_done为true
              };
            });
            return newMsgs;
          });
        } catch (e) {
          console.error("Error parsing SSE message:", e, event.data);
        }
      };
      es.onerror = async (error) => {
        console.error('SSE onerror:', error);
        es.close();
        eventSourceRef.current = null;
        setIsStreaming(false);
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
      eventSourceRef.current = null;
      setIsStreaming(false);
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
    await sendChatMessage(historyId, "user", message, selectedModel, selectedProviderId, llmConfig.temperature, llmConfig.max_tokens, llmConfig.stream);
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
    } catch (e: any) {
      antdMessage.error(e?.message || "新增失败");
    }
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
    if (!content) return '';
    if (typeof marked.parse === 'function') {
      return marked.parse(content) as string;
    }
    return marked(content) as string;
  };

  const handleStopStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsStreaming(false);
  };

  const fetchProviders = async () => {
    try {
      const data = await getModelProviders();
      setProviders(data);
    } catch {
      antdMessage.error("获取模型提供商失败");
    }
  };

  useEffect(() => {
    console.log('[DEBUG] selectedProviderId:', selectedProviderId, 'localStorage:', localStorage.getItem('selectedProviderId'));
  }, [selectedProviderId]);
  useEffect(() => {
    console.log('[DEBUG] selectedModel:', selectedModel, 'localStorage:', localStorage.getItem('selectedModel'));
  }, [selectedModel]);

  useEffect(() => {
    localStorage.removeItem('selectedProviderId');
    localStorage.removeItem('selectedModel');
    setSelectedProviderId(undefined);
    setSelectedModel(undefined);
  }, [token]);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", padding: 16, borderBottom: "1px solid #eee", position: 'relative' }}>
        <Select
          value={selectedProviderId}
          onChange={id => {
            setSelectedProviderId(Number(id));
            localStorage.setItem('selectedProviderId', String(id));
            console.log('[USER] setSelectedProviderId:', id, 'localStorage now:', localStorage.getItem('selectedProviderId'));
          }}
          style={{ width: 180, marginRight: 8 }}
          placeholder="选择模型提供商"
        >
          {providers.map(p => (
            <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>
          ))}
        </Select>
        <Select
          value={selectedModel}
          onChange={id => {
            setSelectedModel(Number(id));
            localStorage.setItem('selectedModel', String(id));
            console.log('[USER] setSelectedModel:', id, 'localStorage now:', localStorage.getItem('selectedModel'));
          }}
          style={{ width: 220, marginRight: 8 }}
          placeholder="选择模型"
        >
          {models.map(m => (
            <Select.Option key={m.id} value={m.id}>{m.name}</Select.Option>
          ))}
        </Select>
        <Button icon={<SettingOutlined />} style={{ marginRight: 8 }} onClick={() => setShowProviderModal(true)} />
        <div style={{ position: 'absolute', right: 16, top: 0 }}>
          <Dropdown
            menu={{
              items: [
                {
                  key: 'user',
                  label: <span style={{ cursor: 'default', fontWeight: 'bold' }}>{userInfo?.username || 'User'}</span>,
                  disabled: true
                },
                { type: 'divider' },
                {
                  key: 'logout',
                  icon: <LogoutOutlined />, 
                  label: 'Logout',
                  onClick: handleLogout
                }
              ]
            }}
            trigger={["click"]}
            open={userMenuVisible}
            onOpenChange={setUserMenuVisible}
          >
            <Button icon={<UserOutlined />} shape="circle" />
          </Dropdown>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
        <List
          dataSource={messages}
          loading={loading}
          renderItem={msg => (
            <List.Item style={{ justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{ width: '100%' }}>
                {msg.sender === 'ai' && msg.reasoning_content && !msg.reasoning_done && (
                  <div
                    style={{
                      background: '#fffbe6',
                      border: '1px solid #ffe58f',
                      borderRadius: 8,
                      padding: 12,
                      marginBottom: 8,
                      fontStyle: 'italic',
                      color: '#ad8b00',
                    }}
                  >
                    <div style={{ fontWeight: 'bold', marginBottom: 6 }}>思考中...</div>
                    <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.reasoning_content) }} />
                  </div>
                )}
                {msg.sender === 'ai' && msg.reasoning_content && msg.reasoning_done && msg.reasoning_content && (
                  <div
                    style={{
                      background: '#fffbe6',
                      border: '1px solid #ffe58f',
                      borderRadius: 8,
                      padding: 12,
                      marginBottom: 8,
                      fontStyle: 'italic',
                      color: '#ad8b00',
                    }}
                  >
                    <div style={{ fontWeight: 'bold', marginBottom: 6 }}>思考完成</div>
                    <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.reasoning_content) }} />
                  </div>
                )}
                {(msg.sender !== 'ai' || (msg.sender === 'ai' && msg.content)) && (
                  <div
                    style={{
                      background: msg.sender === 'user' ? '#e6f7ff' : '#fff',
                      border: '1px solid #eee',
                      borderRadius: 8,
                      padding: 12,
                      marginTop: msg.sender === 'ai' && msg.reasoning_content ? 0 : undefined,
                      display: msg.sender === 'ai' && !msg.content ? 'none' : undefined,
                    }}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                  />
                )}
              </div>
            </List.Item>
          )}
        />
        <div ref={messagesEndRef} />
      </div>
      <div style={{ padding: 16, borderTop: "1px solid #eee", display: "flex", alignItems: "center" }}>
        <Dropdown overlay={toolsMenu} trigger={["click"]}>
          <Button icon={<ToolOutlined />} style={{ marginRight: 8 }} />
        </Dropdown>
        <Input.TextArea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          autoSize={{ minRows: 1, maxRows: 4 }}
          style={{ flex: 1, marginRight: 8 }}
          placeholder="请输入消息..."
          onPressEnter={e => { if (!e.shiftKey) { e.preventDefault(); handleSend(); } }}
          disabled={!selectedHistory}
        />
        {llmConfig.stream && isStreaming ? (
          <Button type="primary" icon={<StopOutlined />} onClick={handleStopStream} danger disabled={!selectedHistory} />
        ) : (
          <Button type="primary" icon={<SendOutlined />} onClick={handleSend} disabled={!selectedHistory} />
        )}
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
            <Button type="primary" icon={<PlusOutlined />} block style={{ marginBottom: 12 }} onClick={() => { setEditingProvider(null); providerForm.resetFields(); setTimeout(() => { nameInputRef.current?.focus(); }, 0); }}>
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
            <Form form={providerForm} layout="vertical" onFinish={handleProviderOk}>
              <Form.Item name="name" label="名称" rules={[{ required: true, message: "请输入名称" }]}>
                <Input ref={nameInputRef} />
              </Form.Item>
              <Form.Item name="api_host" label="API Host" rules={[{ required: true, message: "请输入API Host" }]}>
                <Input />
              </Form.Item>
              <Form.Item name="api_key" label="API Key" rules={[{ required: true, message: "请输入API Key" }]}>
                <Input.Password />
              </Form.Item>
              <Button type="primary" htmlType="submit" style={{ marginRight: 8 }}>保存</Button>
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
          key={showTools ? JSON.stringify(llmConfig) : 'closed'}
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