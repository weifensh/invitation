import React, { useState, useEffect } from "react";
import { Button, List, Dropdown, Menu, Input, Modal, message as antdMessage } from "antd";
import { PlusOutlined, MoreOutlined } from "@ant-design/icons";
import {
  getChatHistories,
  createChatHistory,
  updateChatHistory,
  deleteChatHistory,
} from "../api/chat";

interface ChatHistory {
  id: number;
  title: string;
}

interface SidebarProps {
  selectedHistory: number | null;
  setSelectedHistory: (id: number | null) => void;
  histories: ChatHistory[];
  fetchHistories: () => void;
  loading: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ selectedHistory, setSelectedHistory, histories, fetchHistories, loading }) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const handleEdit = (id: number, title: string) => {
    setEditingId(id);
    setEditTitle(title);
  };

  const handleEditOk = async () => {
    if (editingId !== null) {
      try {
        await updateChatHistory(editingId, editTitle);
        antdMessage.success("修改成功");
        fetchHistories();
      } catch {
        antdMessage.error("修改失败");
      }
    }
    setEditingId(null);
    setEditTitle("");
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteChatHistory(id);
      antdMessage.success("删除成功");
      fetchHistories();
      if (selectedHistory === id) setSelectedHistory(null);
    } catch {
      antdMessage.error("删除失败");
    }
  };

  const handleNewChat = async () => {
    try {
      const newTitle = `新对话 ${histories.length + 1}`;
      const res = await createChatHistory(newTitle);
      fetchHistories();
      setSelectedHistory(res.id);
    } catch {
      antdMessage.error("新建对话失败");
    }
  };

  const menu = (id: number, title: string) => (
    <Menu>
      <Menu.Item key="edit" onClick={() => handleEdit(id, title)}>修改标题名</Menu.Item>
      <Menu.Item key="delete" onClick={() => handleDelete(id)}>删除</Menu.Item>
    </Menu>
  );

  return (
    <div style={{ padding: 16, height: "100vh", display: "flex", flexDirection: "column" }}>
      <Button type="primary" icon={<PlusOutlined />} block style={{ marginBottom: 16 }} onClick={handleNewChat}>
        New chat
      </Button>
      <List
        dataSource={histories}
        loading={loading}
        renderItem={item => (
          <List.Item
            style={{ cursor: "pointer", display: "flex", alignItems: "center", background: selectedHistory === item.id ? "#e6f7ff" : undefined }}
            actions={[
              <Dropdown overlay={menu(item.id, item.title)} trigger={["hover"]} key="more">
                <MoreOutlined style={{ fontSize: 18 }} />
              </Dropdown>
            ]}
            onClick={() => setSelectedHistory(item.id)}
          >
            <span>{item.title}</span>
          </List.Item>
        )}
      />
      <Modal
        title="修改标题名"
        open={editingId !== null}
        onOk={handleEditOk}
        onCancel={() => setEditingId(null)}
      >
        <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} />
      </Modal>
    </div>
  );
};

export default Sidebar; 